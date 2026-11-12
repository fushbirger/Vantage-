import { parseAmountToCents, isCurrency } from "./currency";
import type { CurrencyCode, PreferredRail, SplitRule } from "./types";

export const GROUP_KINDS = ["trip", "dinner", "gift", "home", "other"] as const;
export const SPLIT_RULES: SplitRule[] = ["equal", "exact", "percent", "shares"];
export const RAILS = ["tarus", "tarusqr", "pocket", "cash", "other"] as const;
export const CATEGORIES = [
  "general",
  "food",
  "groceries",
  "transport",
  "stay",
  "gift",
  "activity",
] as const;

export function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function optionalText(value: unknown, max = 2000): string | null {
  const t = text(value, max);
  return t ? t : null;
}

export function money(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  }
  if (typeof value === "string") return parseAmountToCents(value);
  return 0;
}

export function fx(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return 0;
  return Math.round(n * 10000) / 10000;
}

export function validUsername(value: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && isCurrency(value);
}

export function isSplitRule(value: unknown): value is SplitRule {
  return typeof value === "string" && SPLIT_RULES.includes(value as SplitRule);
}

export function isRail(value: unknown): value is PreferredRail {
  return value === "tarus" || value === "tarusqr" || value === "pocket";
}

export function isGroupKind(
  value: unknown,
): value is (typeof GROUP_KINDS)[number] {
  return typeof value === "string" && GROUP_KINDS.includes(value as never);
}

export function isCategory(value: unknown): boolean {
  return typeof value === "string" && CATEGORIES.includes(value as never);
}

/** Accept only reasonably sized image data URLs from the client. */
export function imageDataUrl(value: unknown, maxChars = 3_500_000): string | null {
  if (typeof value !== "string" || !value) return null;
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) return null;
  if (value.length > maxChars) return null;
  return value;
}

export function intCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}
