import { describe, expect, it } from "vitest";
import { computeChangeOverWindow, type PricePoint } from "../src/market/snapshotService.js";

function pointsAgo(minutesAgoList: number[], nowMs: number, priceFn: (minutesAgo: number) => number): PricePoint[] {
  return minutesAgoList
    .map((m) => ({ fetchedAt: new Date(nowMs - m * 60_000).toISOString(), priceUsd: priceFn(m) }))
    .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)); // ascending, oldest first — matches listRecentSnapshots' ordering
}

describe("computeChangeOverWindow", () => {
  it("computes a real % change from the closest observation at or before the requested window", () => {
    const nowMs = Date.now();
    const history = pointsAgo([10, 5, 2, 1], nowMs, () => 1); // flat price of $1 at every point
    const currentPrice = 1.1; // +10% from $1
    const change = computeChangeOverWindow(history, currentPrice, 1, nowMs);
    expect(change).not.toBeNull();
    expect(change as number).toBeCloseTo(10, 5);
  });

  it("returns null when there is no observation old enough for the requested window", () => {
    const nowMs = Date.now();
    const history = pointsAgo([0.1], nowMs, () => 1); // only a 6-second-old observation
    const change = computeChangeOverWindow(history, 1.5, 15, nowMs); // asking for 15m history
    expect(change).toBeNull();
  });

  it("refuses to use a reference point far outside the requested window rather than silently using stale data", () => {
    const nowMs = Date.now();
    const history = pointsAgo([40], nowMs, () => 1); // only a 40-minute-old observation
    const change = computeChangeOverWindow(history, 1.5, 1, nowMs); // asking for a 1-minute window
    expect(change).toBeNull();
  });

  it("returns null on empty history rather than fabricating a value", () => {
    expect(computeChangeOverWindow([], 1, 5)).toBeNull();
  });
});
