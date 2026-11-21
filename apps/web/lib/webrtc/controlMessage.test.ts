import { describe, expect, it } from "vitest";
import { assertFitsMessageLimit, MessageTooLargeError, maxMessageBytes, parseControlMessage } from "./controlMessage";

const offer = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "file-offer", transferId: "t1", name: "a.txt", size: 10, mime: "text/plain", ...overrides });

describe("parseControlMessage", () => {
  it("accepts a valid file offer", () => {
    expect(parseControlMessage(offer())).toEqual({
      type: "file-offer",
      transferId: "t1",
      name: "a.txt",
      size: 10,
      mime: "text/plain",
    });
  });

  it("accepts 0-byte files but rejects invalid sizes", () => {
    expect(parseControlMessage(offer({ size: 0 }))).not.toBeNull();
    expect(parseControlMessage(offer({ size: -1 }))).toBeNull();
    expect(parseControlMessage(offer({ size: 1.5 }))).toBeNull();
    expect(parseControlMessage(offer({ size: "10" }))).toBeNull();
    expect(parseControlMessage(offer({ size: null }))).toBeNull();
  });

  it("strips path separators and control characters from file names", () => {
    const msg = parseControlMessage(offer({ name: "../../etc/passwd" }));
    expect(msg).toMatchObject({ type: "file-offer" });
    expect((msg as { name: string }).name).not.toMatch(/[\\/]/);
    expect(parseControlMessage(offer({ name: "   " }))).toMatchObject({ name: "download" });
  });

  it("limits file name length", () => {
    const msg = parseControlMessage(offer({ name: "a".repeat(1000) }));
    expect((msg as { name: string }).name.length).toBeLessThanOrEqual(255);
  });

  it("validates accept/reject/cancel and text messages", () => {
    expect(parseControlMessage(JSON.stringify({ type: "file-accept", transferId: "t" }))).toEqual({
      type: "file-accept",
      transferId: "t",
    });
    expect(parseControlMessage(JSON.stringify({ type: "file-cancel" }))).toBeNull();
    expect(parseControlMessage(JSON.stringify({ type: "text", text: "hi", textId: "x" }))).not.toBeNull();
    expect(parseControlMessage(JSON.stringify({ type: "text", text: "x".repeat(100_001), textId: "x" }))).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseControlMessage("nope")).toBeNull();
    expect(parseControlMessage(123)).toBeNull();
    expect(parseControlMessage("null")).toBeNull();
    expect(parseControlMessage(JSON.stringify({ type: "unknown" }))).toBeNull();
  });
});

describe("file-accept acks flag", () => {
  it("keeps acks only when it is exactly true", () => {
    const accept = (extra: object) => parseControlMessage(JSON.stringify({ type: "file-accept", transferId: "t", ...extra }));
    expect(accept({ acks: true })).toEqual({ type: "file-accept", transferId: "t", acks: true });
    expect(accept({ acks: "yes" })).toEqual({ type: "file-accept", transferId: "t" });
    expect(accept({})).toEqual({ type: "file-accept", transferId: "t" });
  });
});

describe("message size limits", () => {
  it("uses the negotiated size but never more than 256 KiB, with a safe default", () => {
    expect(maxMessageBytes({ sctp: { maxMessageSize: 100_000 } })).toBe(100_000);
    expect(maxMessageBytes({ sctp: { maxMessageSize: 1_073_741_823 } })).toBe(256 * 1024);
    expect(maxMessageBytes({ sctp: { maxMessageSize: Infinity } })).toBe(256 * 1024);
    expect(maxMessageBytes({ sctp: null })).toBe(64 * 1024);
    expect(maxMessageBytes({})).toBe(64 * 1024);
  });

  it("measures encoded bytes, not characters", () => {
    // 30k CJK characters are 90k bytes in UTF-8.
    const cjk = JSON.stringify({ text: "字".repeat(30_000) });
    expect(() => assertFitsMessageLimit(cjk, 64 * 1024)).toThrow(MessageTooLargeError);
    expect(() => assertFitsMessageLimit(cjk, 128 * 1024)).not.toThrow();
    expect(() => assertFitsMessageLimit("a".repeat(1000), 1000)).not.toThrow();
  });
});
