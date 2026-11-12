import type { SplitRule } from "./types";
import { convertToBndCents } from "./currency";

export interface SplitParticipantInput {
  userId: string;
  /** Meaning depends on the rule: exact amount (expense currency), percent, or share units. */
  value?: number;
}

export interface ComputedSplit {
  userId: string;
  amountBndCents: number;
  shareUnits: number | null;
  percent: number | null;
}

export interface ComputeSplitOptions {
  rule: SplitRule;
  /** Canonical total in BND cents. */
  amountBndCents: number;
  /** Original amount in the expense currency's minor units (needed for "exact"). */
  amountCents: number;
  fxRateToBnd: number;
  participants: SplitParticipantInput[];
}

export class SplitError extends Error {}

/**
 * Split an amount into integer cents using largest-remainder allocation.
 * The returned amounts always sum exactly to `totalCents`.
 */
export function allocateByWeights(
  totalCents: number,
  weights: number[],
): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new SplitError("Total must be a non-negative integer amount.");
  }
  if (!weights.length) throw new SplitError("Choose at least one participant.");
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new SplitError("Split weights must be zero or greater.");
  }
  const weightTotal = weights.reduce((sum, w) => sum + w, 0);
  if (weightTotal <= 0) {
    throw new SplitError("At least one participant needs a positive share.");
  }

  const raw = weights.map((w) => (totalCents * w) / weightTotal);
  const amounts = raw.map((n) => Math.floor(n));
  let remainder = totalCents - amounts.reduce((sum, n) => sum + n, 0);

  const order = raw
    .map((n, index) => ({ index, fraction: n - Math.floor(n) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  let cursor = 0;
  while (remainder > 0) {
    amounts[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return amounts;
}

export function computeSplits({
  rule,
  amountBndCents,
  amountCents,
  fxRateToBnd,
  participants,
}: ComputeSplitOptions): ComputedSplit[] {
  const unique = Array.from(
    new Map(participants.map((p) => [p.userId, p])).values(),
  );
  if (!unique.length) throw new SplitError("Choose at least one participant.");
  if (amountBndCents <= 0) throw new SplitError("Amount must be above zero.");

  if (rule === "equal") {
    const amounts = allocateByWeights(
      amountBndCents,
      unique.map(() => 1),
    );
    return unique.map((p, i) => ({
      userId: p.userId,
      amountBndCents: amounts[i],
      shareUnits: null,
      percent: null,
    }));
  }

  if (rule === "percent") {
    const percentages = unique.map((p) => Number(p.value ?? 0));
    const totalPercent = percentages.reduce((sum, n) => sum + n, 0);
    if (Math.abs(totalPercent - 100) > 0.011) {
      throw new SplitError("Percentages must add up to 100%.");
    }
    const amounts = allocateByWeights(amountBndCents, percentages);
    return unique.map((p, i) => ({
      userId: p.userId,
      amountBndCents: amounts[i],
      shareUnits: null,
      percent: percentages[i],
    }));
  }

  if (rule === "shares") {
    const units = unique.map((p) => Number(p.value ?? 0));
    if (units.some((n) => !Number.isFinite(n) || n <= 0)) {
      throw new SplitError("Each participant needs at least one share.");
    }
    const amounts = allocateByWeights(amountBndCents, units);
    return unique.map((p, i) => ({
      userId: p.userId,
      amountBndCents: amounts[i],
      shareUnits: units[i],
      percent: null,
    }));
  }

  // exact: values are in the original expense currency
  if (!(fxRateToBnd > 0)) throw new SplitError("FX rate must be above zero.");
  const exact = unique.map((p) => Number(p.value ?? 0));
  if (exact.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new SplitError("Exact amounts must be zero or greater.");
  }
  const originalTotal = exact.reduce((sum, n) => sum + Math.round(n), 0);
  if (Math.abs(originalTotal - amountCents) > 1) {
    throw new SplitError("Exact amounts must add up to the expense total.");
  }

  const amounts = exact.map((n) => convertToBndCents(Math.round(n), fxRateToBnd));
  const sum = amounts.reduce((a, b) => a + b, 0);
  const difference = amountBndCents - sum;
  if (difference !== 0) {
    // absorb FX rounding in the largest share
    let largest = 0;
    for (let i = 1; i < amounts.length; i += 1) {
      if (amounts[i] > amounts[largest]) largest = i;
    }
    amounts[largest] = Math.max(0, amounts[largest] + difference);
  }

  return unique.map((p, i) => ({
    userId: p.userId,
    amountBndCents: amounts[i],
    shareUnits: null,
    percent: null,
  }));
}
