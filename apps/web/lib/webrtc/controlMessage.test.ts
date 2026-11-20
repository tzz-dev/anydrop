import { describe, expect, it } from "vitest";
import { parseControlMessage } from "./controlMessage";

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
