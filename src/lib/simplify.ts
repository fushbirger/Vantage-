import type { Balance, Transfer } from "./types";

export interface NetBalance {
  userId: string;
  amountCents: number;
}

/**
 * Greedy min-cash-flow debt simplification.
 *
 * Positive balance = the person is owed money. Negative = the person owes money.
 * At each step the largest debtor pays the largest creditor, which nets out
 * chains (A owes B, B owes C => A pays C) and produces at most n-1 transfers.
 *
 * This greedy algorithm is the standard practical solution; finding the true
 * minimum across arbitrary graphs is NP-hard.
 */
export function simplifyDebts(balances: NetBalance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.amountCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.amountCents - a.amountCents || a.userId.localeCompare(b.userId));

  const debtors = balances
    .filter((b) => b.amountCents < 0)
    .map((b) => ({ userId: b.userId, amountCents: -b.amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents || a.userId.localeCompare(b.userId));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amountCents = Math.min(creditor.amountCents, debtor.amountCents);

    if (amountCents > 0) {
      transfers.push({
        from: debtor.userId,
        to: creditor.userId,
        amountCents,
      });
    }

    creditor.amountCents -= amountCents;
    debtor.amountCents -= amountCents;

    if (creditor.amountCents === 0) ci += 1;
    if (debtor.amountCents === 0) di += 1;
  }

  return transfers;
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
): Array<Transfer & {
  fromName: string;
  fromUsername: string;
  fromColor: string;
  toName: string;
  toUsername: string;
  toColor: string;
}> {
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

export function balanceFor(balances: Balance[], userId: string): number {
  return balances.find((b) => b.userId === userId)?.amountCents ?? 0;
}
