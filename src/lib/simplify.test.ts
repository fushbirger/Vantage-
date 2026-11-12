import { describe, expect, it } from "vitest";
import { simplifyDebts } from "./simplify";

describe("simplifyDebts", () => {
  it("nets out a chain: A owes B, B owes C => A pays C", () => {
    const transfers = simplifyDebts([
      { userId: "a", amountCents: -1000 },
      { userId: "b", amountCents: 0 },
      { userId: "c", amountCents: 1000 },
    ]);
    expect(transfers).toEqual([{ from: "a", to: "c", amountCents: 1000 }]);
  });

  it("respects intermediate balances when they do not cancel", () => {
    // A paid 30, B paid 0, C paid 0 for a 90 total => B and C each owe 30.
    const transfers = simplifyDebts([
      { userId: "a", amountCents: 6000 },
      { userId: "b", amountCents: -3000 },
      { userId: "c", amountCents: -3000 },
    ]);
    expect(transfers).toHaveLength(2);
    expect(transfers).toEqual(
      expect.arrayContaining([
        { from: "b", to: "a", amountCents: 3000 },
        { from: "c", to: "a", amountCents: 3000 },
      ]),
    );
  });

  it("reduces a complex web to the minimum practical transfers", () => {
    const balances = [
      { userId: "aiman", amountCents: 2450 },
      { userId: "nurul", amountCents: -1200 },
      { userId: "hakim", amountCents: 800 },
      { userId: "sofia", amountCents: -1050 },
      { userId: "faridah", amountCents: -1000 },
    ];
    const transfers = simplifyDebts(balances);

    expect(transfers).toHaveLength(4); // n - 1 upper bound, and all 3 debtors are used
    const net = new Map(balances.map((b) => [b.userId, b.amountCents]));
    for (const t of transfers) {
      net.set(t.from, (net.get(t.from) ?? 0) + t.amountCents);
      net.set(t.to, (net.get(t.to) ?? 0) - t.amountCents);
    }
    expect(Array.from(net.values()).every((n) => n === 0)).toBe(true);
    expect(transfers.reduce((s, t) => s + t.amountCents, 0)).toBe(3250);
  });

  it("returns nothing when everyone is square", () => {
    expect(
      simplifyDebts([
        { userId: "a", amountCents: 0 },
        { userId: "b", amountCents: 0 },
      ]),
    ).toEqual([]);
  });

  it("ignores zero balances and handles cent-level rounding", () => {
    const transfers = simplifyDebts([
      { userId: "a", amountCents: 3 },
      { userId: "b", amountCents: 1 },
      { userId: "c", amountCents: -2 },
      { userId: "d", amountCents: -2 },
      { userId: "e", amountCents: 0 },
    ]);
    expect(transfers).toEqual([
      { from: "c", to: "a", amountCents: 2 },
      { from: "d", to: "a", amountCents: 1 },
      { from: "d", to: "b", amountCents: 1 },
    ]);
  });

  it("is deterministic for equal-sized creditors and debtors", () => {
    const a = simplifyDebts([
      { userId: "z", amountCents: 500 },
      { userId: "a", amountCents: 500 },
      { userId: "m", amountCents: -500 },
      { userId: "b", amountCents: -500 },
    ]);
    const b = simplifyDebts([
      { userId: "b", amountCents: -500 },
      { userId: "m", amountCents: -500 },
      { userId: "a", amountCents: 500 },
      { userId: "z", amountCents: 500 },
    ]);
    expect(a).toEqual(b);
  });
});
