import { describe, expect, it } from "vitest";
import { nextMonthlyRun } from "./monthly";

const from = Date.UTC(2026, 10, 18, 12, 0, 0); // 18 Nov 2026, 12:00 UTC

describe("nextMonthlyRun", () => {
  it("uses this month when the day is still ahead", () => {
    expect(nextMonthlyRun(25, from)).toBe(Date.UTC(2026, 10, 25, 9, 0, 0));
  });

  it("rolls to next month when the day has passed", () => {
    expect(nextMonthlyRun(10, from)).toBe(Date.UTC(2026, 11, 10, 9, 0, 0));
  });

  it("clamps to days 1–28 so every month works", () => {
    expect(nextMonthlyRun(31, from)).toBe(Date.UTC(2026, 10, 28, 9, 0, 0));
    expect(nextMonthlyRun(0, from)).toBe(Date.UTC(2026, 11, 1, 9, 0, 0));
  });
});
