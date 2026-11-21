import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "./origin";

describe("isOriginAllowed", () => {
  it("accepts anything when no list is configured", () => {
    expect(isOriginAllowed(null, undefined)).toBe(true);
    expect(isOriginAllowed("https://evil.test", "")).toBe(true);
  });

  it("requires an exact match when configured", () => {
    const allowed = "https://a.example, https://b.example";
    expect(isOriginAllowed("https://b.example", allowed)).toBe(true);
    expect(isOriginAllowed("https://c.example", allowed)).toBe(false);
    expect(isOriginAllowed("https://a.example.evil.test", allowed)).toBe(false);
    expect(isOriginAllowed(null, allowed)).toBe(false);
  });
});
