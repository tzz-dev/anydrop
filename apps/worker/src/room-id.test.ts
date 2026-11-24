import { describe, expect, it } from "vitest";
import { hashIpToRoomId, isValidRoomCode, resolveRoomId, verifyRoomId } from "./room-id";

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

const request = (query: string, ip = "1.2.3.4") =>
  new Request(`https://signal.test/connect${query}`, { headers: { "cf-connecting-ip": ip } });

describe("private rooms", () => {
  it("validates room codes strictly", () => {
    expect(isValidRoomCode("ABCD2345")).toBe(true);
    expect(isValidRoomCode("SHORT")).toBe(false);
    expect(isValidRoomCode("abcd2345")).toBe(false);
    expect(isValidRoomCode("ABCD-2345")).toBe(false);
    expect(isValidRoomCode("A".repeat(33))).toBe(false);
  });

  it("puts everyone with the same code in one room, whatever their network", async () => {
    const a = await resolveRoomId(request("?room=ABCD2345", "1.1.1.1"), "salt");
    const b = await resolveRoomId(request("?room=ABCD2345", "9.9.9.9"), "salt");
    const other = await resolveRoomId(request("?room=ZZZZ2345", "1.1.1.1"), "salt");
    expect(a).toBe(b);
    expect(a).not.toBe(other);
  });

  it("keeps private rooms apart from the network room of the same caller", async () => {
    const network = await resolveRoomId(request(""), "salt");
    const priv = await resolveRoomId(request("?room=ABCD2345"), "salt");
    expect(network).toBe(await hashIpToRoomId("1.2.3.4", "salt"));
    expect(priv).not.toBe(network);
  });

  it("rejects a malformed code instead of falling back to the network room", async () => {
    expect(await resolveRoomId(request("?room=bad"), "salt")).toBeNull();
    expect(await resolveRoomId(request("?room="), "salt")).toBeNull();
  });

  it("depends on the salt and verifies against the same request", async () => {
    const req = request("?room=ABCD2345");
    const id = (await resolveRoomId(req, "salt"))!;
    expect(id).not.toBe(await resolveRoomId(req, "other"));
    expect(await verifyRoomId(req, "salt", id)).toBe(true);
    expect(await verifyRoomId(request("?room=ZZZZ2345"), "salt", id)).toBe(false);
    expect(await verifyRoomId(request(""), "salt", id)).toBe(false);
  });
});
