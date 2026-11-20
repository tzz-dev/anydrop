import { describe, expect, it, vi } from "vitest";
import { receiveFile } from "./fileTransfer";

class FakeChannel {
  binaryType = "blob";
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  push(bytes: number) {
    this.onmessage?.({ data: new ArrayBuffer(bytes) });
  }
}

function setup(totalBytes: number) {
  const channel = new FakeChannel();
  const onProgress = vi.fn();
  const onComplete = vi.fn();
  const onError = vi.fn();
  const transfer = receiveFile(channel as unknown as RTCDataChannel, totalBytes, "text/plain", onProgress, onComplete, onError);
  return { channel, onProgress, onComplete, onError, transfer };
}

describe("receiveFile", () => {
  it("completes exactly once when all bytes arrive", () => {
    const { channel, onComplete, onError } = setup(10);
    channel.push(4);
    channel.push(6);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect((onComplete.mock.calls[0][0] as Blob).size).toBe(10);
    expect(channel.close).toHaveBeenCalled();

    // Extra data after completion must not trigger another download.
    channel.push(5);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("completes empty files without any data", async () => {
    const { onComplete } = setup(0);
    await Promise.resolve();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect((onComplete.mock.calls[0][0] as Blob).size).toBe(0);
  });

  it("fails when the sender sends more than declared", () => {
    const { channel, onComplete, onError } = setup(5);
    channel.push(3);
    channel.push(10);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("fails if the channel closes before the transfer finishes", () => {
    const { channel, onComplete, onError } = setup(10);
    channel.push(3);
    channel.onclose?.();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("stops reporting after abort", () => {
    const { channel, transfer, onProgress, onComplete, onError } = setup(10);
    channel.push(3);
    transfer.abort();
    channel.onmessage?.({ data: new ArrayBuffer(7) });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
