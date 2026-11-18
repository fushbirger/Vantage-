import type { ConfirmationStatus, ExpenseStatus } from "./types";

/**
 * Multi-side confirmation: nobody can put an expense on another person's ledger
 * on their own. Everyone the expense touches (the payer and each person in the
 * split) has to say yes. The author confirms implicitly by submitting, so they
 * are never in the returned list.
 *
 * The result is deduplicated and sorted so it is deterministic.
 */
export function requiredConfirmers(input: {
  createdBy: string;
  paidBy: string;
  participantIds: readonly string[];
}): string[] {
  const touched = new Set<string>([input.paidBy, ...input.participantIds]);
  touched.delete(input.createdBy);
  return Array.from(touched).sort();
}

/**
 * One "rejected" rejects the whole expense, even if others are still pending.
 * It reaches "confirmed" once every state is "confirmed". With no confirmers
 * at all (author is the only person touched) it is confirmed immediately.
 */
export function resolveExpenseStatus(
  states: readonly ConfirmationStatus[],
): ExpenseStatus {
  if (states.includes("rejected")) return "rejected";
  if (states.every((s) => s === "confirmed")) return "confirmed";
  return "pending";
}

export function confirmationProgress(states: readonly ConfirmationStatus[]): {
  confirmed: number;
  total: number;
} {
  let confirmed = 0;
  for (const s of states) if (s === "confirmed") confirmed++;
  return { confirmed, total: states.length };
}

/** Who still has to answer, e.g. for reminders or a "waiting on…" label. */
export function pendingConfirmers(
  confirmations: Readonly<Record<string, ConfirmationStatus>>,
): string[] {
  return Object.entries(confirmations)
    .filter(([, status]) => status === "pending")
    .map(([userId]) => userId)
    .sort();
}