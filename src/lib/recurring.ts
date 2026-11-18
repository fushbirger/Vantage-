import "server-only";
import { db } from "./db";
import { addOneMonth, nextMonthlyRun, periodKey } from "./monthly";
import { computeSplits } from "./split";
import type { CurrencyCode, RecurringBill, SplitRule } from "./types";

export { nextMonthlyRun } from "./monthly";

export interface RecurringParticipant {
  userId: string;
  value?: number;
}

interface RecurringRow {
  id: string;
  groupId: string;
  title: string;
  category: string;
  amountCents: number;
  currency: CurrencyCode;
  fxRateToBnd: number;
  amountBndCents: number;
  paidBy: string;
  payerName: string;
  splitRule: SplitRule;
  participantsJson: string;
  dayOfMonth: number;
  nextRunAt: number;
  active: number;
  createdBy: string;
  createdAt: number;
}

/**
 * Post any monthly bills whose database date has arrived. This is intentionally
 * lazy: it runs when a group ledger is read, so the MVP needs no cron worker.
 * A unique (bill_id, period_key) row makes generation idempotent.
 */
export function materializeDueBills(now = Date.now()): number {
  const due = db
    .prepare(
      `SELECT id, group_id AS groupId, title, category, amount_cents AS amountCents,
              currency, fx_rate_to_bnd AS fxRateToBnd,
              amount_bnd_cents AS amountBndCents, paid_by AS paidBy,
              split_rule AS splitRule, participants_json AS participantsJson,
              day_of_month AS dayOfMonth, next_run_at AS nextRunAt, active
       FROM recurring_bills
       WHERE active = 1 AND next_run_at <= ?
       ORDER BY next_run_at`,
    )
    .all(now) as Array<
    Pick<
      RecurringRow,
      | "id"
      | "groupId"
      | "title"
      | "category"
      | "amountCents"
      | "currency"
      | "fxRateToBnd"
      | "amountBndCents"
      | "paidBy"
      | "splitRule"
      | "participantsJson"
      | "dayOfMonth"
      | "nextRunAt"
    >
  >;

  if (!due.length) return 0;

  let generated = 0;

  const run = db.transaction(() => {
    const insertExpense = db.prepare(
      `INSERT INTO expenses
         (id, group_id, paid_by, title, category, amount_cents, currency, fx_rate_to_bnd,
          amount_bnd_cents, split_rule, receipt_data, items_json, notes, spent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    );
    const insertSplit = db.prepare(
      `INSERT INTO expense_splits
         (id, expense_id, user_id, amount_bnd_cents, share_units, percent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertRun = db.prepare(
      `INSERT OR IGNORE INTO recurring_bill_runs
         (id, bill_id, period_key, expense_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const advance = db.prepare(
      "UPDATE recurring_bills SET next_run_at = ? WHERE id = ?",
    );

    for (const bill of due) {
      let next = bill.nextRunAt;
      let posted = 0;

      // Catch up on missed months, but cap a single sweep at 24 months.
      while (next <= now && posted < 24) {
        const key = periodKey(next);
        const participants = JSON.parse(
          bill.participantsJson,
        ) as RecurringParticipant[];
        const splits = computeSplits({
          rule: bill.splitRule,
          amountBndCents: bill.amountBndCents,
          amountCents: bill.amountCents,
          fxRateToBnd: bill.fxRateToBnd,
          participants,
        });
        const expenseId = `exp_${crypto.randomUUID()}`;

        insertExpense.run(
          expenseId,
          bill.groupId,
          bill.paidBy,
          bill.title,
          bill.category,
          bill.amountCents,
          bill.currency,
          bill.fxRateToBnd,
          bill.amountBndCents,
          bill.splitRule,
          `Recurring monthly bill (${key})`,
          next,
          Date.now(),
        );
        for (const split of splits) {
          insertSplit.run(
            `sp_${crypto.randomUUID()}`,
            expenseId,
            split.userId,
            split.amountBndCents,
            split.shareUnits,
            split.percent,
          );
        }
        insertRun.run(
          `run_${crypto.randomUUID()}`,
          bill.id,
          key,
          expenseId,
          Date.now(),
        );

        generated += 1;
        posted += 1;
        next = addOneMonth(next);
      }

      advance.run(next, bill.id);
    }
  });

  run();
  return generated;
}

function rowToBill(row: RecurringRow): RecurringBill {
  return {
    id: row.id,
    groupId: row.groupId,
    title: row.title,
    category: row.category,
    amountCents: row.amountCents,
    currency: row.currency,
    fxRateToBnd: row.fxRateToBnd,
    amountBndCents: row.amountBndCents,
    paidBy: row.paidBy,
    payerName: row.payerName,
    splitRule: row.splitRule,
    participantIds: (
      JSON.parse(row.participantsJson) as RecurringParticipant[]
    ).map((participant) => participant.userId),
    dayOfMonth: row.dayOfMonth,
    nextRunAt: row.nextRunAt,
    active: row.active,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export function getRecurringBill(id: string): RecurringBill | null {
  const row = db
    .prepare(
      `SELECT rb.id, rb.group_id AS groupId, rb.title, rb.category,
              rb.amount_cents AS amountCents, rb.currency,
              rb.fx_rate_to_bnd AS fxRateToBnd,
              rb.amount_bnd_cents AS amountBndCents, rb.paid_by AS paidBy,
              u.name AS payerName, rb.split_rule AS splitRule,
              rb.participants_json AS participantsJson,
              rb.day_of_month AS dayOfMonth, rb.next_run_at AS nextRunAt,
              rb.active, rb.created_by AS createdBy, rb.created_at AS createdAt
       FROM recurring_bills rb JOIN users u ON u.id = rb.paid_by
       WHERE rb.id = ?`,
    )
    .get(id) as RecurringRow | undefined;
  return row ? rowToBill(row) : null;
}

export function getRecurringBills(groupId: string): RecurringBill[] {
  const rows = db
    .prepare(
      `SELECT rb.id, rb.group_id AS groupId, rb.title, rb.category,
              rb.amount_cents AS amountCents, rb.currency,
              rb.fx_rate_to_bnd AS fxRateToBnd,
              rb.amount_bnd_cents AS amountBndCents, rb.paid_by AS paidBy,
              u.name AS payerName, rb.split_rule AS splitRule,
              rb.participants_json AS participantsJson,
              rb.day_of_month AS dayOfMonth, rb.next_run_at AS nextRunAt,
              rb.active, rb.created_by AS createdBy, rb.created_at AS createdAt
       FROM recurring_bills rb JOIN users u ON u.id = rb.paid_by
       WHERE rb.group_id = ?
       ORDER BY rb.next_run_at`,
    )
    .all(groupId) as RecurringRow[];
  return rows.map(rowToBill);
}

export function createRecurringBill(input: {
  groupId: string;
  title: string;
  category: string;
  amountCents: number;
  currency: CurrencyCode;
  fxRateToBnd: number;
  amountBndCents: number;
  paidBy: string;
  splitRule: SplitRule;
  participants: RecurringParticipant[];
  dayOfMonth: number;
  createdBy: string;
}): RecurringBill {
  const id = `rb_${crypto.randomUUID()}`;
  const now = Date.now();
  db.prepare(
    `INSERT INTO recurring_bills
       (id, group_id, title, category, amount_cents, currency, fx_rate_to_bnd,
        amount_bnd_cents, paid_by, split_rule, participants_json, day_of_month,
        next_run_at, active, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id,
    input.groupId,
    input.title,
    input.category,
    input.amountCents,
    input.currency,
    input.fxRateToBnd,
    input.amountBndCents,
    input.paidBy,
    input.splitRule,
    JSON.stringify(input.participants),
    Math.min(28, Math.max(1, input.dayOfMonth)),
    nextMonthlyRun(input.dayOfMonth, now),
    input.createdBy,
    now,
  );
  return getRecurringBills(input.groupId).find((bill) => bill.id === id)!;
}

export function setRecurringBillActive(
  billId: string,
  active: boolean,
): boolean {
  const result = db
    .prepare("UPDATE recurring_bills SET active = ? WHERE id = ?")
    .run(active ? 1 : 0, billId);
  return result.changes > 0;
}
