import { describe, expect, it, vi } from "vitest";
import { throttleProgress } from "./throttle";

describe("throttleProgress", () => {
  it("passes the first call through and drops calls inside the interval", () => {
    let time = 1000;
    const callback = vi.fn();
    const throttled = throttleProgress(callback, 100, () => time);

    throttled(1);
    time += 30;
    throttled(2);
    time += 30;
    throttled(3);
    expect(callback.mock.calls).toEqual([[1]]);

    time += 50; // 110ms since the first call
    throttled(4);
    expect(callback.mock.calls).toEqual([[1], [4]]);
  });
});
