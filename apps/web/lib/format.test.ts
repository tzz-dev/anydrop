import { describe, expect, it } from "vitest";
import { estimateTransfer, formatDuration } from "./format";

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(5)).toBe("5s");
    expect(formatDuration(80)).toBe("1m 20s");
    expect(formatDuration(7500)).toBe("2h 5m");
    expect(formatDuration(-3)).toBe("0s");
  });
});

describe("estimateTransfer", () => {
  it("needs at least a second of data", () => {
    expect(estimateTransfer(100, 1000, 0, 500)).toBeNull();
    expect(estimateTransfer(100, 1000, undefined, 5000)).toBeNull();
  });

  it("computes average speed and time remaining", () => {
    const estimate = estimateTransfer(1000, 5000, 0, 2000)!;
    expect(estimate.bytesPerSecond).toBe(500);
    expect(estimate.remainingSeconds).toBe(8);
  });
});
