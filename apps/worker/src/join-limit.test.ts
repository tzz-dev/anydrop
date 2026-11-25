import { describe, expect, it } from "vitest";
import { allowJoin } from "./join-limit";

function fakeLimiter(allowed: boolean) {
  const keys: string[] = [];
  const limiter: RateLimit = {
    async limit({ key }) {
      keys.push(key);
      return { success: allowed };
    },
  };
  return { limiter, keys };
}

const req = (qs: string, ip = "203.0.113.7") =>
  new Request(`https://x.test/connect${qs}`, { headers: { "cf-connecting-ip": ip } });

describe("allowJoin", () => {
  it("does not touch the limiter for the nearby room", async () => {
    const { limiter, keys } = fakeLimiter(false);
    expect(await allowJoin(req(""), limiter)).toBe(true);
    expect(keys).toEqual([]);
  });

  it("allows everything without a limiter binding", async () => {
    expect(await allowJoin(req("?room=ABCDEFGH23"), undefined)).toBe(true);
  });

  it("follows the limiter for private-room joins", async () => {
    expect(await allowJoin(req("?room=ABCDEFGH23"), fakeLimiter(true).limiter)).toBe(true);
    expect(await allowJoin(req("?room=ABCDEFGH23"), fakeLimiter(false).limiter)).toBe(false);
  });

  it("keys by network: one IPv6 /64 is one client", async () => {
    const a = fakeLimiter(true);
    const b = fakeLimiter(true);
    await allowJoin(req("?room=ABCDEFGH23", "2001:db8:1:2:aaaa::1"), a.limiter);
    await allowJoin(req("?room=ABCDEFGH23", "2001:db8:1:2:bbbb::9"), b.limiter);
    expect(a.keys).toEqual(b.keys);
  });
});
