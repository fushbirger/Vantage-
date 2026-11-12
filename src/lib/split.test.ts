import { describe, expect, it } from "vitest";
import { computeSplits, allocateByWeights, SplitError } from "./split";

const participants = (values: number[]) =>
  values.map((value, i) => ({ userId: `u${i}`, value }));

describe("allocateByWeights", () => {
  it("always returns integer cents summing to the total", () => {
    const amounts = allocateByWeights(10000, [1, 1, 1]);
    expect(amounts).toEqual([3334, 3333, 3333]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(10000);
  });
});

describe("computeSplits", () => {
  it("splits equally with deterministic remainder", () => {
    const splits = computeSplits({
      rule: "equal",
      amountBndCents: 8760,
      amountCents: 8760,
      fxRateToBnd: 1,
      participants: participants([0, 0, 0]),
    });
    expect(splits.map((s) => s.amountBndCents)).toEqual([2920, 2920, 2920]);
  });

  it("splits by percentage", () => {
    const splits = computeSplits({
      rule: "percent",
      amountBndCents: 42000,
      amountCents: 42000,
      fxRateToBnd: 1,
      participants: participants([25, 25, 20, 15, 15]),
    });
    expect(splits.map((s) => s.amountBndCents)).toEqual([
      10500, 10500, 8400, 6300, 6300,
    ]);
  });

  it("rejects percentages that do not total 100", () => {
    expect(() =>
      computeSplits({
        rule: "percent",
        amountBndCents: 1000,
        amountCents: 1000,
        fxRateToBnd: 1,
        participants: participants([50, 40]),
      }),
    ).toThrow(SplitError);
  });

  it("splits by share units", () => {
    const splits = computeSplits({
      rule: "shares",
      amountBndCents: 12850,
      amountCents: 12850,
      fxRateToBnd: 1,
      participants: participants([2, 1, 1, 1, 1]),
    });
    expect(splits.map((s) => s.amountBndCents)).toEqual([
      4283, 2142, 2142, 2142, 2141,
    ]);
    expect(splits.reduce((sum, s) => sum + s.amountBndCents, 0)).toBe(12850);
  });

  it("converts exact MYR splits into BND", () => {
    const splits = computeSplits({
      rule: "exact",
      amountBndCents: 7200,
      amountCents: 24000,
      fxRateToBnd: 0.3,
      participants: participants([10000, 14000]),
    });
    expect(splits.map((s) => s.amountBndCents)).toEqual([3000, 4200]);
  });

  it("validates exact amounts against the expense total", () => {
    expect(() =>
      computeSplits({
        rule: "exact",
        amountBndCents: 10000,
        amountCents: 10000,
        fxRateToBnd: 1,
        participants: participants([5000, 4000]),
      }),
    ).toThrow("Exact amounts must add up to the expense total.");
  });

  it("deduplicates participants", () => {
    const splits = computeSplits({
      rule: "equal",
      amountBndCents: 1000,
      amountCents: 1000,
      fxRateToBnd: 1,
      participants: [
        { userId: "a" },
        { userId: "a" },
      ],
    });
    expect(splits).toHaveLength(1);
    expect(splits[0].amountBndCents).toBe(1000);
  });
});
