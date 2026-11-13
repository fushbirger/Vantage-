import type { ConfirmationStatus, ExpenseStatus } from "./types";

/**
 * Multi-side confirmation: nobody can put an expense on another person's ledger
 * on their own. Everyone the expense touches (the payer and each person in the
 * split) has to say yes. The author confirms by submitting.
 */
export function requiredConfirmers(input: {
  createdBy: string;
  paidBy: string;
  participantIds: string[];
}): string[] {
  const touched = new Set<string>([input.paidBy, ...input.participantIds]);
  touched.delete(input.createdBy);
  return Array.from(touched).sort();
}

/** One no rejects the expense; it reaches the ledger once every yes is in. */
export function resolveExpenseStatus(states: ConfirmationStatus[]): ExpenseStatus {
  if (states.some((s) => s === "rejected")) return "rejected";
  if (states.every((s) => s === "confirmed")) return "confirmed";
  return "pending";
}

export function confirmationProgress(states: ConfirmationStatus[]): {
  confirmed: number;
  total: number;
} {
  return {
    confirmed: states.filter((s) => s === "confirmed").length,
    total: states.length,
  };
}
