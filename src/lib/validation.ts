import { parseAmountToCents, isCurrency } from "./currency";
import type { CurrencyCode, PreferredRail, SplitRule } from "./types";

export const GROUP_KINDS = ["trip", "dinner", "gift", "home", "other"] as const;
export const SPLIT_RULES = [
  "equal",
  "exact",
  "percent",
  "shares",
] as const satisfies readonly SplitRule[];

// Every rail the system recognizes, including non-digital ones
export const RAILS = ["tarus", "tarusqr", "pocket", "cash", "other"] as const;

// Rails that can be chosen as a digital payment preference
export const PREFERRED_RAILS = [
  "tarus",
  "tarusqr",
  "pocket",
] as const satisfies readonly PreferredRail[];

export const CATEGORIES = [
  "general",
  "food",
  "groceries",
  "transport",
  "stay",
  "gift",
  "activity",
] as const;

export type GroupKind = (typeof GROUP_KINDS)[number];
export type Category = (typeof CATEGORIES)[number];

const MAX_CENTS = Number.MAX_SAFE_INTEGER;
const MAX_FX_RATE = 100;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const IMAGE_DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i;
const BASE64_BODY_RE = /^[A-Za-z0-9+/]+={0,2}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function oneOf<T extends string>(
  list: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

// Cents must be a safe non-negative integer, otherwise 0
function safeCents(n: number): number {
  return Number.isSafeInteger(n) && n >= 0 && n <= MAX_CENTS ? n : 0;
}

// Trim, strip control chars, and cut by code point so emoji stay intact
export function text(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(CONTROL_CHARS_RE, "").trim();
  if (cleaned.length <= max) return cleaned;
  return Array.from(cleaned).slice(0, max).join("").trim();
}

export function optionalText(value: unknown, max = 2000): string | null {
  return text(value, max) || null;
}

// Accepts a number in major units (e.g. 12.5) or a string, returns cents
export function money(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    // toFixed first so 1.005 * 100 does not become 100.49999
    return safeCents(Math.round(Number(value.toFixed(2)) * 100));
  }
  if (typeof value === "string") return safeCents(parseAmountToCents(value));
  return 0;
}

// FX rate must satisfy 0 < n <= 100, rounded to 4 decimals, 0 means invalid
export function fx(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  if (typeof value === "string" && !value.trim()) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_FX_RATE) return 0;
  return Math.round(n * 10_000) / 10_000;
}

// Raw integer cents from the client, no unit conversion
export function intCents(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  if (typeof value === "string" && !value.trim()) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? safeCents(Math.round(n)) : 0;
}

export function normalizeUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validUsername(value: string): boolean {
  return USERNAME_RE.test(value);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && isCurrency(value);
}

export function isSplitRule(value: unknown): value is SplitRule {
  return oneOf(SPLIT_RULES, value);
}

export function isRail(value: unknown): value is PreferredRail {
  return oneOf(PREFERRED_RAILS, value);
}

export function isGroupKind(value: unknown): value is GroupKind {
  return oneOf(GROUP_KINDS, value);
}

export function isCategory(value: unknown): value is Category {
  return oneOf(CATEGORIES, value);
}

// Accepts only non-SVG image data URLs of sane size with a valid base64 body
export function imageDataUrl(
  value: unknown,
  maxChars = 3_500_000,
): string | null {
  if (typeof value !== "string" || !value || value.length > maxChars) return null;

  const match = IMAGE_DATA_URL_RE.exec(value);
  if (!match) return null;

  const body = value.slice(match[0].length);
  if (!body || body.length % 4 !== 0 || !BASE64_BODY_RE.test(body)) return null;

  return value;
}