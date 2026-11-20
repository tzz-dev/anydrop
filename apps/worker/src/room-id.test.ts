import { describe, expect, it } from "vitest";
import { hashIpToRoomId } from "./room-id";

const sameRoom = async (a: string, b: string) => (await hashIpToRoomId(a, "salt")) === (await hashIpToRoomId(b, "salt"));

describe("hashIpToRoomId", () => {
  it("groups identical IPv4 addresses and separates different ones", async () => {
    expect(await sameRoom("1.2.3.4", "1.2.3.4")).toBe(true);
    expect(await sameRoom("1.2.3.4", "1.2.3.5")).toBe(false);
  });

  it("groups IPv6 addresses by /64 regardless of :: compression", async () => {
    expect(await sameRoom("2001:db8::1", "2001:db8:0:0:aaaa::2")).toBe(true);
    expect(await sameRoom("2001:db8:abcd:12::5", "2001:db8:abcd:12:1:2:3:4")).toBe(true);
    expect(await sameRoom("2001:db8:abcd:12::5", "2001:db8:abcd:13::5")).toBe(false);
  });

  it("treats IPv4-mapped IPv6 addresses like the plain IPv4 address", async () => {
    expect(await sameRoom("::ffff:1.2.3.4", "1.2.3.4")).toBe(true);
  });

  it("depends on the salt", async () => {
    expect(await hashIpToRoomId("1.2.3.4", "a")).not.toBe(await hashIpToRoomId("1.2.3.4", "b"));
  });

  it("does not throw on malformed IPv6 input", async () => {
    await expect(hashIpToRoomId("zzzz::::1", "salt")).resolves.toHaveLength(16);
  });
});
