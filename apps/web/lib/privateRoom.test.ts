import { describe, expect, it } from "vitest";
import { buildRoomLink, formatRoomCode, generateRoomCode, normalizeRoomCode, parseRoomHash } from "./privateRoom";

describe("private room codes", () => {
  it("generates valid, distinct, unambiguous codes", () => {
    const codes = new Set(Array.from({ length: 200 }, generateRoomCode));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      expect(normalizeRoomCode(code)).toBe(code);
    }
  });

  it("normalizes typed codes and rejects bad ones", () => {
    expect(normalizeRoomCode(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(normalizeRoomCode("short")).toBeNull();
    expect(normalizeRoomCode("ABCDEFGH!!")).toBeNull();
    expect(normalizeRoomCode("A".repeat(33))).toBeNull();
  });

  it("round-trips through the link and URL hash", () => {
    const link = buildRoomLink("https://anydrop.jp", "ABCDEFGHJK");
    expect(link).toBe("https://anydrop.jp/#room=ABCDEFGHJK");
    expect(parseRoomHash(new URL(link).hash)).toBe("ABCDEFGHJK");
    expect(parseRoomHash("")).toBeNull();
    expect(parseRoomHash("#room=nope")).toBeNull();
    expect(parseRoomHash("#other=ABCDEFGHJK")).toBeNull();
  });

  it("formats codes in groups for reading", () => {
    expect(formatRoomCode("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
  });
});
