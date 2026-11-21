import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_CHARS, parseClientMessage } from "./messages";

describe("parseClientMessage", () => {
  it("accepts well-formed messages", () => {
    expect(parseClientMessage(JSON.stringify({ type: "hello", peerId: "p", displayName: "n" }))).toEqual({
      type: "hello",
      peerId: "p",
      displayName: "n",
    });
    expect(parseClientMessage(JSON.stringify({ type: "signal", to: "x", data: { type: "offer", sdp: "v=0" } }))).not.toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "ice", to: "x", data: { candidate: "candidate:1" } }))).not.toBeNull();
  });

  it("rejects malformed input instead of throwing", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage("null")).toBeNull();
    expect(parseClientMessage("42")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "nope" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "hello", peerId: 1, displayName: "n" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "signal", to: "x", data: { type: "bogus" } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "signal", to: 5, data: { type: "offer" } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "ice", to: "x", data: {} }))).toBeNull();
  });

  it("rejects oversized messages", () => {
    const big = JSON.stringify({ type: "hello", peerId: "p", displayName: "x".repeat(MAX_MESSAGE_CHARS) });
    expect(parseClientMessage(big)).toBeNull();
  });
});

describe("hello sanitizing", () => {
  it("strips control characters and caps display name length", () => {
    const msg = parseClientMessage(
      JSON.stringify({ type: "hello", peerId: "p", displayName: `  a‮b\n${"x".repeat(100)} ` }),
    );
    expect(msg?.type).toBe("hello");
    if (msg?.type === "hello") {
      expect(msg.displayName.startsWith("ab")).toBe(true);
      expect(Array.from(msg.displayName).length).toBeLessThanOrEqual(32);
    }
  });

  it("rejects empty names and oversized ids", () => {
    expect(parseClientMessage(JSON.stringify({ type: "hello", peerId: "p", displayName: " ​ " }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "hello", peerId: "p".repeat(65), displayName: "a" }))).toBeNull();
  });
});
