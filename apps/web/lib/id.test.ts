import { afterEach, describe, expect, it, vi } from "vitest";
import { randomId } from "./id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("randomId", () => {
  it("returns a v4 UUID", () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  it("still works where crypto.randomUUID is unavailable (non-secure contexts)", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const a = randomId();
    const b = randomId();
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});
