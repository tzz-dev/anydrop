// 64 KB is safe across browsers (the interoperable max message size is 256 KB)
// and gives far better throughput than tiny chunks.
const CHUNK_SIZE = 64 * 1024;
const HIGH_WATERMARK = 4 * 1024 * 1024;
const LOW_WATERMARK = 1024 * 1024;

export class TransferAbortedError extends Error {
  constructor() {
    super("transfer aborted");
    this.name = "TransferAbortedError";
  }
}

// Resolves once the channel's send buffer drops to its low threshold; rejects
// if the channel closes or the transfer is aborted while waiting, so a dead
// peer can never leave this promise hanging forever. The bufferedamountlow
// event is the primary signal, but some browsers deliver it unreliably, so a
// slow poll acts as a safety net.
const BUFFER_POLL_MS = 200;

function waitForBufferedLow(channel: RTCDataChannel, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let poll: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      clearInterval(poll);
      channel.removeEventListener("bufferedamountlow", onLow);
      channel.removeEventListener("close", onClose);
      signal?.removeEventListener("abort", onAbort);
    };
    const onLow = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("data channel closed"));
    };
    const onAbort = () => {
      cleanup();
      reject(new TransferAbortedError());
    };

    if (channel.readyState !== "open") return onClose();
    if (signal?.aborted) return onAbort();
    if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) return onLow();

    channel.addEventListener("bufferedamountlow", onLow);
    channel.addEventListener("close", onClose);
    signal?.addEventListener("abort", onAbort);
    poll = setInterval(() => {
      if (channel.readyState !== "open") onClose();
      else if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) onLow();
    }, BUFFER_POLL_MS);
  });
}

export async function sendFile(
  channel: RTCDataChannel,
  file: File,
  onProgress: (sentBytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  let offset = 0;
  while (offset < file.size) {
    if (signal?.aborted) throw new TransferAbortedError();
    if (channel.readyState !== "open") throw new Error("data channel closed");

    if (channel.bufferedAmount > HIGH_WATERMARK) {
      channel.bufferedAmountLowThreshold = LOW_WATERMARK;
      await waitForBufferedLow(channel, signal);
    }

    const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
    if (signal?.aborted) throw new TransferAbortedError();
    channel.send(chunk);
    offset += chunk.byteLength;
    onProgress(offset);
  }

  // Don't report success until everything has actually left the send buffer.
  if (channel.bufferedAmount > 0) {
    channel.bufferedAmountLowThreshold = 0;
    await waitForBufferedLow(channel, signal);
  }
}

export interface IncomingFileTransfer {
  abort: () => void;
}

// Destination for received data when the file is too big to hold in memory
// (e.g. a file picked through the File System Access API). Implementations
// must make close() and abort() safe to call more than once.
export interface FileSink {
  write(chunk: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

// Receives exactly `totalBytes` from the channel. Without a sink the data is
// assembled in memory and handed to onComplete as a Blob; with a sink it is
// streamed out as it arrives and onComplete receives null.
export function receiveFile(
  channel: RTCDataChannel,
  totalBytes: number,
  mime: string,
  onProgress: (receivedBytes: number) => void,
  onComplete: (blob: Blob | null) => void,
  onError: (message: string) => void,
  sink?: FileSink,
): IncomingFileTransfer {
  channel.binaryType = "arraybuffer";
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  // No more channel events are handled once all data arrived or we gave up.
  let receivingDone = false;
  // The outcome (complete / error / abort) has been reported.
  let settled = false;
  let writeQueue: Promise<void> = Promise.resolve();

  const detach = () => {
    channel.onmessage = null;
    channel.onclose = null;
    channel.onerror = null;
  };

  const fail = (message: string) => {
    if (settled) return;
    settled = true;
    receivingDone = true;
    detach();
    chunks.length = 0;
    void sink?.abort();
    onError(message);
    channel.close();
  };

  const complete = () => {
    if (receivingDone) return;
    receivingDone = true;
    detach();
    // Our side is done; release the channel.
    channel.close();

    if (!sink) {
      settled = true;
      onComplete(new Blob(chunks, { type: mime }));
      return;
    }
    // Let queued writes flush before closing the file.
    writeQueue
      .then(() => (settled ? undefined : sink.close()))
      .then(() => {
        if (settled) return;
        settled = true;
        onComplete(null);
      })
      .catch((error) => fail(`failed to finish writing file: ${String(error)}`));
  };

  channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    if (receivingDone) return;
    if (!(event.data instanceof ArrayBuffer)) {
      fail("unexpected non-binary data");
      return;
    }
    received += event.data.byteLength;
    // A sender that ships more than it declared is misbehaving; don't buffer it.
    if (received > totalBytes) {
      fail("received more data than declared");
      return;
    }

    if (sink) {
      const chunk = event.data;
      writeQueue = writeQueue
        .then(() => (settled ? undefined : sink.write(chunk)))
        .catch((error) => fail(`failed to write file: ${String(error)}`));
    } else {
      chunks.push(event.data);
    }
    onProgress(received);
    if (received === totalBytes) complete();
  };

  channel.onclose = () => fail("data channel closed before transfer finished");
  channel.onerror = () => fail("data channel error");

  // An empty file never produces a message, so there is nothing to wait for.
  // Defer so the caller finishes registering the transfer first.
  if (totalBytes === 0) queueMicrotask(complete);

  return {
    abort: () => {
      if (settled) return;
      settled = true;
      receivingDone = true;
      detach();
      chunks.length = 0;
      void sink?.abort();
      channel.close();
    },
  };
}
