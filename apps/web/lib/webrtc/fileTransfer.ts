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

// Resolves when `isReady()` becomes true after a bufferedamountlow event;
// rejects if the channel closes or the transfer is aborted while waiting, so a
// dead peer can never leave this promise hanging forever.
function waitForBufferedLow(channel: RTCDataChannel, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
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

    channel.addEventListener("bufferedamountlow", onLow);
    channel.addEventListener("close", onClose);
    signal?.addEventListener("abort", onAbort);
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

export function receiveFile(
  channel: RTCDataChannel,
  totalBytes: number,
  mime: string,
  onProgress: (receivedBytes: number) => void,
  onComplete: (blob: Blob) => void,
  onError: (message: string) => void,
): IncomingFileTransfer {
  channel.binaryType = "arraybuffer";
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  let finished = false;

  const finish = () => {
    finished = true;
    channel.onmessage = null;
    channel.onclose = null;
    channel.onerror = null;
  };

  const complete = () => {
    if (finished) return;
    finish();
    onComplete(new Blob(chunks, { type: mime }));
    // Our side is done; release the channel.
    channel.close();
  };

  const fail = (message: string) => {
    if (finished) return;
    finish();
    chunks.length = 0;
    onError(message);
    channel.close();
  };

  channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    if (finished) return;
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
    chunks.push(event.data);
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
      if (finished) return;
      finish();
      chunks.length = 0;
      channel.close();
    },
  };
}
