import { describe, expect, it } from "vitest";
import { computePairwiseTransfers } from "./pairwise";

const split = (userId: string, amountBndCents: number) => ({
  userId,
  amountBndCents,
});

describe("computePairwiseTransfers", () => {
  it("keeps chains as direct pairwise transfers", () => {
    const transfers = computePairwiseTransfers({
      expenses: [
        {
          paidBy: "a",
          splits: [split("a", 5000), split("b", 5000)],
        },
        {
          paidBy: "b",
          splits: [split("b", 5000), split("c", 5000)],
        },
      ],
      settlements: [],
    });

    // A→B→C must not be rerouted into A→C.
    expect(transfers).toEqual([
      { from: "b", to: "a", amountCents: 5000 },
      { from: "c", to: "b", amountCents: 5000 },
    ]);
  });

  it("applies owed minus paid for the same pair", () => {
    const transfers = computePairwiseTransfers({
      expenses: [
        {
          paidBy: "a",
          splits: [split("a", 5000), split("b", 5000)],
        },
        {
          paidBy: "b",
          splits: [split("a", 2000), split("b", 2000)],
        },
      ],
      settlements: [],
    });

    // B owed A 50, A owed B 20 => B pays A 30.
    expect(transfers).toEqual([{ from: "b", to: "a", amountCents: 3000 }]);
  });

  it("subtracts completed settlements and ignores pending ones", () => {
    const base = {
      expenses: [
        {
          paidBy: "a",
          splits: [split("a", 5000), split("b", 5000)],
        },
      ],
    };

    const pending = computePairwiseTransfers({
      ...base,
      settlements: [
        {
          fromUser: "b",
          toUser: "a",
          amountBndCents: 5000,
          status: "pending" as const,
        },
      ],
    });
    expect(pending).toEqual([{ from: "b", to: "a", amountCents: 5000 }]);

    const completed = computePairwiseTransfers({
      ...base,
      settlements: [
        {
          fromUser: "b",
          toUser: "a",
          amountBndCents: 5000,
          status: "completed" as const,
        },
      ],
    });
    expect(completed).toEqual([]);
  });

  it("reverses direction when a pair overpays", () => {
    const transfers = computePairwiseTransfers({
      expenses: [
        {
          paidBy: "a",
          splits: [split("a", 3000), split("b", 3000)],
        },
      ],
      settlements: [
        {
          fromUser: "b",
          toUser: "a",
          amountBndCents: 5000,
          status: "completed",
        },
      ],
    });

    expect(transfers).toEqual([{ from: "a", to: "b", amountCents: 2000 }]);
  });

  it("returns one deterministic transfer per pair", () => {
    const transfers = computePairwiseTransfers({
      expenses: [
        {
          paidBy: "c",
          splits: [split("a", 1000), split("b", 1000), split("c", 1000)],
        },
      ],
      settlements: [],
    });

    expect(transfers).toEqual([
      { from: "a", to: "c", amountCents: 1000 },
      { from: "b", to: "c", amountCents: 1000 },
    ]);
  });

  it("returns nothing when everyone is square", () => {
    expect(
      computePairwiseTransfers({
        expenses: [
          {
            paidBy: "a",
            splits: [split("a", 2500), split("b", 2500)],
          },
        ],
        settlements: [
          {
            fromUser: "b",
            toUser: "a",
            amountBndCents: 2500,
            status: "completed",
          },
        ],
      }),
    ).toEqual([]);
  });
});
