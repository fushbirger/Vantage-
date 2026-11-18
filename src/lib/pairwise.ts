import type { Transfer } from "./types";

export interface PairwiseExpense {
  paidBy: string;
  splits: Array<{ userId: string; amountBndCents: number }>;
}

export interface PairwiseSettlement {
  fromUser: string;
  toUser: string;
  amountBndCents: number;
  status: "pending" | "completed" | "rejected";
}

export interface PairwiseInput {
  expenses: PairwiseExpense[];
  settlements: PairwiseSettlement[];
}

/**
 * Direct one-to-one ledger maths.
 *
 * For every expense we record "split user owes payer their share". Completed
 * settlements are subtracted from the same pair. We never route a debt through
 * a third person, so a chain A → B → C stays as two separate transfers.
 *
 * The result is the net of (owed − paid) for each pair, with at most one
 * transfer per pair. Pending claims are deliberately ignored until the
 * recipient confirms them.
 */
export function computePairwiseTransfers({
  expenses,
  settlements,
}: PairwiseInput): Transfer[] {
  // owed[from][to] = cents `from` still owes `to`.
  const owed = new Map<string, Map<string, number>>();

  const adjust = (from: string, to: string, delta: number) => {
    if (from === to || delta === 0) return;
    const row = owed.get(from) ?? new Map<string, number>();
    row.set(to, (row.get(to) ?? 0) + delta);
    owed.set(from, row);
  };

  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.amountBndCents <= 0) continue;
      adjust(split.userId, expense.paidBy, split.amountBndCents);
    }
  }

  for (const settlement of settlements) {
    if (settlement.status !== "completed") continue;
    adjust(settlement.fromUser, settlement.toUser, -settlement.amountBndCents);
  }

  const seen = new Set<string>();
  const transfers: Transfer[] = [];

  for (const [a, row] of owed) {
    for (const b of row.keys()) {
      const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const aOwesB = owed.get(a)?.get(b) ?? 0;
      const bOwesA = owed.get(b)?.get(a) ?? 0;
      const delta = aOwesB - bOwesA;
      if (delta > 0) {
        transfers.push({ from: a, to: b, amountCents: delta });
      } else if (delta < 0) {
        transfers.push({ from: b, to: a, amountCents: -delta });
      }
    }
  }

  return transfers.sort(
    (x, y) =>
      x.from.localeCompare(y.from) ||
      x.to.localeCompare(y.to) ||
      x.amountCents - y.amountCents,
  );
}

/** Convenience for UI: attach display metadata and skip unknowns. */
export function transfersWithPeople(
  transfers: Transfer[],
  people: Array<{
    userId: string;
    name: string;
    username: string;
    avatarColor: string;
  }>,
): Array<
  Transfer & {
    fromName: string;
    fromUsername: string;
    fromColor: string;
    toName: string;
    toUsername: string;
    toColor: string;
  }
> {
  const byId = new Map(people.map((p) => [p.userId, p]));
  return transfers.flatMap((t) => {
    const from = byId.get(t.from);
    const to = byId.get(t.to);
    if (!from || !to) return [];
    return [
      {
        ...t,
        fromName: from.name,
        fromUsername: from.username,
        fromColor: from.avatarColor,
        toName: to.name,
        toUsername: to.username,
        toColor: to.avatarColor,
      },
    ];
  });
}
