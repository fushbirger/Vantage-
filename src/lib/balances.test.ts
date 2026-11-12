import { describe, expect, it } from "vitest";
import { computeNetBalances, totalSpendCents } from "./balances";

describe("computeNetBalances", () => {
  it("nets paid amounts against owed splits", () => {
    const balances = computeNetBalances({
      memberIds: ["a", "b", "c"],
      expenses: [{ paidBy: "a", amountBndCents: 9000 }],
      splits: [
        { userId: "a", amountBndCents: 3000 },
        { userId: "b", amountBndCents: 3000 },
        { userId: "c", amountBndCents: 3000 },
      ],
      settlements: [],
    });
    expect(balances).toEqual([
      { userId: "a", amountCents: 6000 },
      { userId: "b", amountCents: -3000 },
      { userId: "c", amountCents: -3000 },
    ]);
  });

  it("applies only completed settlements", () => {
    const base = {
      memberIds: ["a", "b"],
      expenses: [{ paidBy: "a", amountBndCents: 2000 }],
      splits: [
        { userId: "a", amountBndCents: 1000 },
        { userId: "b", amountBndCents: 1000 },
      ],
    };
    const pending = computeNetBalances({
      ...base,
      settlements: [
        { fromUser: "b", toUser: "a", amountBndCents: 1000, status: "pending" },
      ],
    });
    expect(pending).toEqual([
      { userId: "a", amountCents: 1000 },
      { userId: "b", amountCents: -1000 },
    ]);

    const completed = computeNetBalances({
      ...base,
      settlements: [
        { fromUser: "b", toUser: "a", amountBndCents: 1000, status: "completed" },
      ],
    });
    expect(completed).toEqual([
      { userId: "a", amountCents: 0 },
      { userId: "b", amountCents: 0 },
    ]);
  });

  it("ignores rejected settlements", () => {
    const balances = computeNetBalances({
      memberIds: ["a", "b"],
      expenses: [{ paidBy: "a", amountBndCents: 2000 }],
      splits: [
        { userId: "a", amountBndCents: 1000 },
        { userId: "b", amountBndCents: 1000 },
      ],
      settlements: [
        { fromUser: "b", toUser: "a", amountBndCents: 1000, status: "rejected" },
      ],
    });
    expect(balances).toEqual([
      { userId: "a", amountCents: 1000 },
      { userId: "b", amountCents: -1000 },
    ]);
  });

  it("handles multi-currency canonical amounts", () => {
    const balances = computeNetBalances({
      memberIds: ["a", "b"],
      expenses: [{ paidBy: "b", amountBndCents: 7200 }], // MYR 240 @ 0.30
      splits: [
        { userId: "a", amountBndCents: 3600 },
        { userId: "b", amountBndCents: 3600 },
      ],
      settlements: [],
    });
    expect(balances).toEqual([
      { userId: "a", amountCents: -3600 },
      { userId: "b", amountCents: 3600 },
    ]);
  });

  it("sums total spend in BND", () => {
    expect(
      totalSpendCents([
        { paidBy: "a", amountBndCents: 9000 },
        { paidBy: "b", amountBndCents: 7200 },
      ]),
    ).toBe(16200);
  });
});
