const CHUNK_SIZE = 16 * 1024;
const HIGH_WATERMARK = 1024 * 1024;
const LOW_WATERMARK = 256 * 1024;

export class TransferAbortedError extends Error {
  constructor() {
    super("transfer aborted");
    this.name = "TransferAbortedError";
  }
}

export async function sendFile(
  channel: RTCDataChannel,
  file: File,
  onProgress: (sentBytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  channel.bufferedAmountLowThreshold = LOW_WATERMARK;

  const waitForDrain = () =>
    new Promise<void>((resolve) => {
      const handleLow = () => {
        channel.removeEventListener("bufferedamountlow", handleLow);
        resolve();
      };
      channel.addEventListener("bufferedamountlow", handleLow);
    });

  let offset = 0;
  while (offset < file.size) {
    if (signal?.aborted) throw new TransferAbortedError();
    if (channel.bufferedAmount > HIGH_WATERMARK) await waitForDrain();

    const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
    channel.send(chunk);
    offset += chunk.byteLength;
    onProgress(offset);
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
): IncomingFileTransfer {
  channel.binaryType = "arraybuffer";
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  let aborted = false;

  channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    if (aborted) return;
    chunks.push(event.data);
    received += event.data.byteLength;
    onProgress(received);
    if (received >= totalBytes) {
      onComplete(new Blob(chunks, { type: mime }));
    }
  };

  return {
    abort: () => {
      aborted = true;
      channel.onmessage = null;
    },
  };
}
