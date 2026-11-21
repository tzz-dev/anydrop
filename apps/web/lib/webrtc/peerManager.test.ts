import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientSignalMessage } from "@anydrop/protocol";
import { PeerManager, type PeerManagerEvent } from "./peerManager";

class FakeChannel {
  binaryType = "blob";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: unknown[] = [];
  private listeners = new Map<string, Set<() => void>>();

  constructor(
    public label: string,
    public readyState = "open",
  ) {}

  send = vi.fn((data: unknown) => {
    this.sent.push(data);
  });
  close = vi.fn(() => {
    this.readyState = "closed";
  });
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
  controlMessages() {
    return this.sent.map((data) => JSON.parse(data as string) as { type: string; transferId?: string });
  }
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  connectionState = "new";
  signalingState = "stable";
  localDescription = { toJSON: () => ({ type: "answer", sdp: "fake" }) };
  onicecandidate: unknown = null;
  onconnectionstatechange: unknown = null;
  onnegotiationneeded: unknown = null;
  ondatachannel: ((event: { channel: FakeChannel }) => void) | null = null;
  created: FakeChannel[] = [];

  constructor() {
    FakePeerConnection.instances.push(this);
  }
  close = vi.fn();
  setRemoteDescription = vi.fn(async () => {});
  setLocalDescription = vi.fn(async () => {});
  addIceCandidate = vi.fn(async () => {});
  createDataChannel(label: string) {
    const channel = new FakeChannel(label, "connecting");
    this.created.push(channel);
    return channel;
  }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function setup(localId = "me") {
  FakePeerConnection.instances = [];
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  const events: PeerManagerEvent[] = [];
  const signals: ClientSignalMessage[] = [];
  const manager = new PeerManager(
    (msg) => signals.push(msg),
    (event) => events.push(event),
  );
  manager.handleServerMessage({ type: "welcome", connectionId: localId, roomId: "room" });
  return { manager, events, signals };
}

// A peer that connected to us: its offer arrived and it opened the control channel.
async function connectPeer(manager: PeerManager, id = "B") {
  manager.handleServerMessage({ type: "signal", from: id, data: { type: "offer", sdp: "v=0" } });
  await flush();
  const pc = FakePeerConnection.instances.at(-1)!;
  const control = new FakeChannel("control");
  pc.ondatachannel!({ channel: control });
  return { pc, control };
}

const remoteSends = (control: FakeChannel, message: object) =>
  control.onmessage!({ data: JSON.stringify(message) });

const offerMessage = (transferId: string, size: number) => ({
  type: "file-offer",
  transferId,
  name: "a.bin",
  size,
  mime: "application/octet-stream",
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PeerManager incoming files", () => {
  it("refuses file data until the user accepted the offer", async () => {
    const { manager, events } = setup();
    const { pc, control } = await connectPeer(manager);

    remoteSends(control, offerMessage("t1", 10));
    expect(events).toContainEqual(expect.objectContaining({ kind: "incoming-file-offer", transferId: "t1" }));

    // The peer tries to push data without waiting for the dialog.
    const early = new FakeChannel("file:t1");
    pc.ondatachannel!({ channel: early });
    expect(early.close).toHaveBeenCalled();
    expect(early.onmessage).toBeNull();

    expect(manager.acceptFileOffer("B", "t1")).toBe(true);
    expect(control.controlMessages()).toContainEqual({ type: "file-accept", transferId: "t1" });

    const accepted = new FakeChannel("file:t1");
    pc.ondatachannel!({ channel: accepted });
    expect(accepted.close).not.toHaveBeenCalled();
    accepted.onmessage!({ data: new ArrayBuffer(10) });

    const complete = events.find((e) => e.kind === "transfer-complete");
    expect(complete).toMatchObject({ transferId: "t1", direction: "receive" });
  });

  it("closes file channels for transfers it never heard of", async () => {
    const { manager } = setup();
    const { pc } = await connectPeer(manager);
    const stray = new FakeChannel("file:nope");
    pc.ondatachannel!({ channel: stray });
    expect(stray.close).toHaveBeenCalled();
  });

  it("auto-rejects offers beyond the pending limit", async () => {
    const { manager, events } = setup();
    const { control } = await connectPeer(manager);
    for (let i = 0; i < 12; i++) remoteSends(control, offerMessage(`t${i}`, 1));

    expect(events.filter((e) => e.kind === "incoming-file-offer")).toHaveLength(10);
    expect(control.controlMessages().filter((m) => m.type === "file-reject")).toHaveLength(2);
  });
});

describe("PeerManager incoming text", () => {
  it("drops texts from a peer that floods faster than the limit, then recovers", async () => {
    const { manager, events } = setup();
    const { control } = await connectPeer(manager);
    const send = (id: string) => remoteSends(control, { type: "text", text: "hi", textId: id });

    for (let i = 0; i < 15; i++) send(`a${i}`);
    expect(events.filter((e) => e.kind === "incoming-text")).toHaveLength(10);

    vi.advanceTimersByTime(10_001);
    send("later");
    expect(events.filter((e) => e.kind === "incoming-text")).toHaveLength(11);
  });
});

describe("PeerManager outgoing files", () => {
  it("does not start sending if the offer was canceled before the peer accepted", async () => {
    const { manager } = setup();
    const { pc, control } = await connectPeer(manager);

    const file = new File([new Uint8Array(10)], "a.bin");
    await manager.offerFile("B", file, "t9");
    expect(control.controlMessages()).toContainEqual(expect.objectContaining({ type: "file-offer", transferId: "t9" }));

    manager.cancelTransfer("B", "t9");
    remoteSends(control, { type: "file-accept", transferId: "t9" });
    expect(pc.created.find((c) => c.label === "file:t9")).toBeUndefined();
  });
});

describe("PeerManager.syncPeers", () => {
  it("drops an idle peer that left the room", async () => {
    const { manager, events } = setup();
    const { pc } = await connectPeer(manager);

    manager.syncPeers([]);
    expect(pc.close).toHaveBeenCalled();
    expect(events).toContainEqual({ kind: "peer-gone", connectionId: "B" });
  });

  it("keeps a peer with a transfer in flight, then releases it after a grace period", async () => {
    const { manager, events } = setup();
    const { pc, control } = await connectPeer(manager);

    remoteSends(control, offerMessage("t1", 10));
    manager.acceptFileOffer("B", "t1");
    const data = new FakeChannel("file:t1");
    pc.ondatachannel!({ channel: data });

    // The peer's signaling socket dropped: the P2P transfer must survive.
    manager.syncPeers([]);
    expect(pc.close).not.toHaveBeenCalled();

    data.onmessage!({ data: new ArrayBuffer(10) });
    expect(events).toContainEqual(expect.objectContaining({ kind: "transfer-complete", transferId: "t1" }));
    expect(events.find((e) => e.kind === "transfer-error")).toBeUndefined();

    vi.advanceTimersByTime(4_999);
    expect(pc.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(pc.close).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({ kind: "peer-gone", connectionId: "B" });
  });

  it("does not release a peer that came back into the roster", async () => {
    const { manager } = setup();
    const { pc, control } = await connectPeer(manager);

    remoteSends(control, offerMessage("t1", 10));
    manager.acceptFileOffer("B", "t1");
    const data = new FakeChannel("file:t1");
    pc.ondatachannel!({ channel: data });

    manager.syncPeers([]);
    data.onmessage!({ data: new ArrayBuffer(10) });
    manager.syncPeers(["B"]);

    vi.advanceTimersByTime(60_000);
    expect(pc.close).not.toHaveBeenCalled();
  });
});

describe("PeerManager offer collisions", () => {
  async function collide(localId: string) {
    const { manager } = setup(localId);
    manager.handleServerMessage({ type: "signal", from: "m", data: { type: "offer", sdp: "v=0" } });
    await flush();
    const pc = FakePeerConnection.instances.at(-1)!;
    pc.setRemoteDescription.mockClear();

    // We are mid-negotiation ourselves when the peer's offer arrives.
    pc.signalingState = "have-local-offer";
    manager.handleServerMessage({ type: "signal", from: "m", data: { type: "offer", sdp: "v=0" } });
    await flush();
    return pc;
  }

  it("the impolite side (smaller connection id) ignores the colliding offer", async () => {
    const pc = await collide("a");
    expect(pc.setRemoteDescription).not.toHaveBeenCalled();
  });

  it("the polite side (larger connection id) accepts it", async () => {
    const pc = await collide("z");
    expect(pc.setRemoteDescription).toHaveBeenCalledTimes(1);
  });

  it("uses the latest welcome id, so a reconnect can't leave a stale role", async () => {
    const { manager } = setup("a"); // impolite relative to "m"
    manager.handleServerMessage({ type: "welcome", connectionId: "z", roomId: "room" }); // now polite
    manager.handleServerMessage({ type: "signal", from: "m", data: { type: "offer", sdp: "v=0" } });
    await flush();
    const pc = FakePeerConnection.instances.at(-1)!;
    pc.setRemoteDescription.mockClear();
    pc.signalingState = "have-local-offer";
    manager.handleServerMessage({ type: "signal", from: "m", data: { type: "offer", sdp: "v=0" } });
    await flush();
    expect(pc.setRemoteDescription).toHaveBeenCalledTimes(1);
  });
});
