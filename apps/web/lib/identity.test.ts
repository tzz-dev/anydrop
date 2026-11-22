import { describe, expect, it, vi } from "vitest";
import { getIdentity, MAX_DISPLAY_NAME_LENGTH, renameIdentity, subscribeIdentity } from "./identity";

describe("renameIdentity", () => {
  it("updates the name, keeps the peer id and notifies subscribers", () => {
    const before = getIdentity();
    const listener = vi.fn();
    const unsubscribe = subscribeIdentity(listener);

    expect(renameIdentity("  My   laptop ")).toBe("My laptop");
    const after = getIdentity();
    expect(after.displayName).toBe("My laptop");
    expect(after.peerId).toBe(before.peerId);
    expect(after).not.toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    renameIdentity("Other");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("rejects empty names and caps the length", () => {
    const current = getIdentity();
    expect(renameIdentity("   ")).toBeNull();
    expect(getIdentity()).toBe(current);

    expect(Array.from(renameIdentity("字".repeat(100))!)).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
  });

  it("does not notify when the name is unchanged", () => {
    renameIdentity("Same");
    const listener = vi.fn();
    subscribeIdentity(listener);
    renameIdentity("Same");
    expect(listener).not.toHaveBeenCalled();
  });
});
