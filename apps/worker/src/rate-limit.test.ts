import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit within the window, then rejects", () => {
    const limiter = new RateLimiter(3, 1000);
    expect([0, 10, 20].map((t) => limiter.allow(t))).toEqual([true, true, true]);
    expect(limiter.allow(30)).toBe(false);
  });

  it("recovers once old events leave the window", () => {
    const limiter = new RateLimiter(2, 1000);
    limiter.allow(0);
    limiter.allow(100);
    expect(limiter.allow(500)).toBe(false);
    expect(limiter.allow(1000)).toBe(true);
  });
});
