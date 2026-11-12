import type {
  Balance,
  ExpenseWithSplits,
  Group,
  GroupMember,
  Transfer,
} from "./types";
import { formatBnd, formatOriginal } from "./currency";

export type WhatsAppTemplate =
  | "expense_added"
  | "pool_created"
  | "pool_pledge"
  | "settlement_marked"
  | "settlement_confirmed"
  | "settlement_rejected"
  | "payment_reminder"
  | "group_invite";

export const TEMPLATE_LABELS: Record<WhatsAppTemplate, string> = {
  expense_added: "Expense added",
  pool_created: "Pool started",
  pool_pledge: "Pool pledge",
  settlement_marked: "Payment marked",
  settlement_confirmed: "Payment confirmed",
  settlement_rejected: "Payment disputed",
  payment_reminder: "Payment reminder",
  group_invite: "Group invite",
};

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function settleUrl(groupId: string): string {
  return `${appBaseUrl()}/groups/${groupId}/settle`;
}

export function groupUrl(groupId: string): string {
  return `${appBaseUrl()}/groups/${groupId}`;
}

/** Normalise a Brunei phone number for wa.me links. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("673")) return digits;
  if (digits.startsWith("0")) return `673${digits.slice(1)}`;
  if (digits.length === 7) return `673${digits}`;
  return digits;
}

export function waLink(text: string, phone?: string | null): string {
  const digits = phone ? normalizePhone(phone) : null;
  return `https://wa.me/${digits ?? ""}?text=${encodeURIComponent(text)}`;
}

export function buildShareSummary(input: {
  group: Group;
  members: GroupMember[];
  expenses: ExpenseWithSplits[];
  balances: Balance[];
  transfers: Array<Transfer & { fromName: string; toName: string }>;
}): string {
  const { group, expenses, balances, transfers } = input;
  const memberNames = new Map(input.members.map((m) => [m.userId, m.name]));
  const total = expenses.reduce((sum, e) => sum + e.amountBndCents, 0);
  const lines: string[] = [];

  lines.push(`*${group.name}* ${group.emoji}`);
  lines.push(
    `Total logged: *${formatBnd(total)}* · ${expenses.length} expense${expenses.length === 1 ? "" : "s"}`,
  );
  lines.push("");

  if (expenses.length) {
    lines.push("*Expenses*");
    for (const expense of expenses.slice(0, 12)) {
      const currencyNote =
        expense.currency !== "BND"
          ? ` (${formatOriginal(expense.amountCents, expense.currency)} @ ${expense.fxRateToBnd})`
          : "";
      lines.push(
        `• ${expense.title} — ${formatBnd(expense.amountBndCents)}${currencyNote} · paid by ${expense.payerName}`,
      );
    }
    if (expenses.length > 12) lines.push(`…and ${expenses.length - 12} more`);
    lines.push("");
  }

  lines.push("*Settle up (simplified)*");
  if (transfers.length) {
    for (const transfer of transfers) {
      lines.push(
        `• ${transfer.fromName} → ${transfer.toName}: ${formatBnd(transfer.amountCents)}`,
      );
    }
  } else {
    lines.push("• Everyone is square 🎉");
  }
  lines.push("");

  lines.push("*Net positions*");
  for (const balance of balances) {
    const label = memberNames.get(balance.userId) ?? balance.name;
    if (balance.amountCents === 0) continue;
    const direction = balance.amountCents > 0 ? "gets back" : "owes";
    lines.push(
      `• ${label} ${direction} ${formatBnd(Math.abs(balance.amountCents))}`,
    );
  }
  lines.push("");
  lines.push(`Open in Vantage: ${groupUrl(group.id)}`);
  lines.push("_Non-custodial ledger — Vantage never holds your money._");

  return lines.join("\n");
}

export function expenseAddedBody(input: {
  actorName: string;
  title: string;
  amountBndCents: number;
  groupName: string;
  groupId: string;
  yourShareCents: number;
}): string {
  return `💸 ${input.actorName} added “${input.title}” (${formatBnd(input.amountBndCents)}) in ${input.groupName}.\nYour share: ${formatBnd(input.yourShareCents)}.\nOpen Vantage: ${groupUrl(input.groupId)}`;
}

export function poolCreatedBody(input: {
  actorName: string;
  title: string;
  goalBndCents: number;
  groupName: string;
  groupId: string;
}): string {
  return `🎯 ${input.actorName} started the pool “${input.title}” with a ${formatBnd(input.goalBndCents)} goal in ${input.groupName}.\nPledge here: ${groupUrl(input.groupId)}`;
}

export function settlementMarkedBody(input: {
  actorName: string;
  amountBndCents: number;
  groupName: string;
  groupId: string;
  rail: string;
}): string {
  return `💳 ${input.actorName} marked ${formatBnd(input.amountBndCents)} as paid to you via ${input.rail} for ${input.groupName}.\nConfirm or dispute it in Vantage: ${settleUrl(input.groupId)}`;
}

export function settlementConfirmedBody(input: {
  actorName: string;
  amountBndCents: number;
  groupName: string;
  groupId: string;
}): string {
  return `✅ ${input.actorName} confirmed your ${formatBnd(input.amountBndCents)} payment for ${input.groupName}. You are square on that transfer.\nView: ${settleUrl(input.groupId)}`;
}

export function settlementRejectedBody(input: {
  actorName: string;
  amountBndCents: number;
  groupName: string;
  groupId: string;
}): string {
  return `⚠️ ${input.actorName} could not confirm your ${formatBnd(input.amountBndCents)} payment for ${input.groupName}. Check the payment details and try again: ${settleUrl(input.groupId)}`;
}

export function reminderBody(input: {
  actorName: string;
  amountBndCents: number;
  toName: string;
  groupName: string;
  groupId: string;
}): string {
  return `👋 Friendly reminder from ${input.actorName}: you owe ${input.toName} ${formatBnd(input.amountBndCents)} for ${input.groupName}.\nSettle up here: ${settleUrl(input.groupId)}`;
}

export function poolPledgeBody(input: {
  actorName: string;
  poolTitle: string;
  amountBndCents: number;
  groupName: string;
  groupId: string;
  received: boolean;
}): string {
  return input.received
    ? `✅ ${input.actorName} marked ${formatBnd(input.amountBndCents)} as handed over offline for “${input.poolTitle}” in ${input.groupName}.\nView pool: ${groupUrl(input.groupId)}`
    : `💛 ${input.actorName} pledged ${formatBnd(input.amountBndCents)} to “${input.poolTitle}” in ${input.groupName}.\nView pool: ${groupUrl(input.groupId)}`;
}

export function renderOutboxStatus(status: string): string {
  return (
    {
      queued: "Queued",
      simulated: "Simulated",
      sent: "Sent",
      failed: "Failed",
    }[status] ?? status
  );
}
