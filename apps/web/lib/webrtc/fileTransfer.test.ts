import { describe, expect, it, vi } from "vitest";
import { receiveFile, sendFile, type FileSink } from "./fileTransfer";

class FakeChannel {
  binaryType = "blob";
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  send = vi.fn();
  push(bytes: number) {
    this.onmessage?.({ data: new ArrayBuffer(bytes) });
  }
}

function setup(totalBytes: number, sink?: FileSink) {
  const channel = new FakeChannel();
  const onProgress = vi.fn();
  const onComplete = vi.fn();
  const onError = vi.fn();
  const transfer = receiveFile(
    channel as unknown as RTCDataChannel,
    totalBytes,
    "text/plain",
    onProgress,
    onComplete,
    onError,
    sink,
  );
  return { channel, onProgress, onComplete, onError, transfer };
}

function fakeSink(overrides: Partial<FileSink> = {}) {
  const writes: number[] = [];
  const sink = {
    write: vi.fn(async (chunk: ArrayBuffer) => {
      writes.push(chunk.byteLength);
    }),
    close: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
    ...overrides,
  };
  return { sink, writes };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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

describe("receiveFile with a sink (streaming to disk)", () => {
  it("writes chunks in order, closes the sink, and completes without a blob", async () => {
    const { sink, writes } = fakeSink();
    const { channel, onComplete, onError } = setup(10, sink);
    channel.push(4);
    channel.push(6);
    await flush();

    expect(writes).toEqual([4, 6]);
    expect(sink.close).toHaveBeenCalledTimes(1);
    expect(sink.abort).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(null);
    expect(onError).not.toHaveBeenCalled();
  });

  it("fails and aborts the sink when a write fails", async () => {
    const { sink } = fakeSink({ write: vi.fn(async () => Promise.reject(new Error("disk full"))) });
    const { channel, onComplete, onError } = setup(10, sink);
    channel.push(4);
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(sink.abort).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("aborts the sink when the transfer is aborted or the channel closes early", async () => {
    const a = fakeSink();
    const first = setup(10, a.sink);
    first.channel.push(3);
    first.transfer.abort();
    await flush();
    expect(a.sink.abort).toHaveBeenCalled();
    expect(first.onComplete).not.toHaveBeenCalled();

    const b = fakeSink();
    const second = setup(10, b.sink);
    second.channel.push(3);
    second.channel.onclose?.();
    await flush();
    expect(b.sink.abort).toHaveBeenCalled();
    expect(second.onError).toHaveBeenCalledTimes(1);
  });

  it("does not close the sink when the sender overshoots the declared size", async () => {
    const { sink } = fakeSink();
    const { channel, onComplete, onError } = setup(5, sink);
    channel.push(3);
    channel.push(10);
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(sink.close).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("sendFile", () => {
  // A channel whose send buffer drains on its own but never fires
  // bufferedamountlow, like a flaky browser implementation.
  class SilentChannel {
    readyState = "open";
    bufferedAmount = 5 * 1024 * 1024;
    bufferedAmountLowThreshold = 0;
    sent: number[] = [];
    addEventListener() {}
    removeEventListener() {}
    send(chunk: ArrayBuffer) {
      this.sent.push(chunk.byteLength);
    }
  }

  it("does not hang when bufferedamountlow is never delivered", async () => {
    const channel = new SilentChannel();
    setTimeout(() => {
      channel.bufferedAmount = 0;
    }, 50);

    const file = new File([new Uint8Array(100)], "a.bin");
    await sendFile(channel as unknown as RTCDataChannel, file, () => {});
    expect(channel.sent).toEqual([100]);
  });
});

describe("receiver acknowledgements (disk backpressure)", () => {
  const MB = 1024 * 1024;

  it("acknowledges data only once it is written, in batches", async () => {
    const { sink } = fakeSink();
    const { channel } = setup(100 * MB, sink);
    for (let i = 0; i < 4; i++) channel.push(MB);
    await flush();
    expect(channel.send).toHaveBeenCalledWith(`ack:${4 * MB}`);
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it("holds back acknowledgements while the disk is slow", async () => {
    let finishWrite: () => void = () => {};
    const slow = new Promise<void>((resolve) => (finishWrite = resolve));
    const { sink } = fakeSink({ write: vi.fn(() => slow) });
    const { channel } = setup(100 * MB, sink);
    // A single chunk already reaches the acknowledgement interval.
    channel.push(4 * MB);
    await flush();
    expect(channel.send).not.toHaveBeenCalled();

    finishWrite();
    await flush();
    expect(channel.send).toHaveBeenCalled();
  });

  it("does not acknowledge when receiving into memory", async () => {
    const { channel } = setup(100 * MB);
    for (let i = 0; i < 8; i++) channel.push(MB);
    await flush();
    expect(channel.send).not.toHaveBeenCalled();
  });
});

describe("sendFile with an acknowledgement window", () => {
  class AckChannel {
    readyState = "open";
    bufferedAmount = 0;
    bufferedAmountLowThreshold = 0;
    sent = 0;
    private listeners = new Map<string, Set<(event: unknown) => void>>();
    addEventListener(type: string, fn: (event: unknown) => void) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(fn);
    }
    removeEventListener(type: string, fn: (event: unknown) => void) {
      this.listeners.get(type)?.delete(fn);
    }
    emit(type: string, event: unknown = {}) {
      for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event);
    }
    send(chunk: ArrayBuffer) {
      this.sent += chunk.byteLength;
    }
  }

  const KB = 1024;
  const file = () => new File([new Uint8Array(512 * KB)], "a.bin");

  it("stops at the window until the receiver acknowledges", async () => {
    const channel = new AckChannel();
    const done = sendFile(channel as unknown as RTCDataChannel, file(), () => {}, undefined, {
      ackWindowBytes: 128 * KB,
    });
    await flush();
    expect(channel.sent).toBe(128 * KB);

    channel.emit("message", { data: `ack:${128 * KB}` });
    await flush();
    expect(channel.sent).toBe(256 * KB);

    channel.emit("message", { data: `ack:${512 * KB}` });
    await done;
    expect(channel.sent).toBe(512 * KB);
  });

  it("fails instead of hanging when the channel closes while waiting", async () => {
    const channel = new AckChannel();
    const done = sendFile(channel as unknown as RTCDataChannel, file(), () => {}, undefined, {
      ackWindowBytes: 64 * KB,
    });
    await flush();
    channel.readyState = "closed";
    channel.emit("close");
    await expect(done).rejects.toThrow("data channel closed");
  });

  it("ignores malformed acknowledgements", async () => {
    const channel = new AckChannel();
    const done = sendFile(channel as unknown as RTCDataChannel, file(), () => {}, undefined, {
      ackWindowBytes: 64 * KB,
    });
    await flush();
    channel.emit("message", { data: "ack:not-a-number" });
    channel.emit("message", { data: new ArrayBuffer(4) });
    await flush();
    expect(channel.sent).toBe(64 * KB);

    channel.emit("message", { data: `ack:${512 * KB}` });
    await done;
  });
});
