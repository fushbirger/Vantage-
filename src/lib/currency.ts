import type { CurrencyCode } from "./types";

export interface CurrencyInfo {
  code: CurrencyCode;
  label: string;
  symbol: string;
  defaultRateToBnd: number;
  note: string;
}

/**
 * Rates are a starting point for cross-border entry, not a live FX feed.
 * Every expense stores the rate used so the ledger stays auditable.
 */
export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  BND: {
    code: "BND",
    label: "Brunei Dollar",
    symbol: "$",
    defaultRateToBnd: 1,
    note: "Base currency",
  },
  SGD: {
    code: "SGD",
    label: "Singapore Dollar",
    symbol: "S$",
    defaultRateToBnd: 1,
    note: "Interchangeable at par with BND",
  },
  MYR: {
    code: "MYR",
    label: "Malaysian Ringgit",
    symbol: "RM",
    defaultRateToBnd: 0.3,
    note: "Typical Miri / KK trip rate",
  },
  USD: {
    code: "USD",
    label: "US Dollar",
    symbol: "US$",
    defaultRateToBnd: 1.34,
    note: "Reference rate",
  },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrency(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

/** Parse a human-entered amount into integer minor units (cents). */
export function parseAmountToCents(input: string | number): number {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : 0;
  }
  const cleaned = input.replace(/,/g, "").replace(/[^0-9.-]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function convertToBndCents(
  amountCents: number,
  fxRateToBnd: number,
): number {
  if (!Number.isFinite(fxRateToBnd) || fxRateToBnd <= 0) return 0;
  return Math.round(amountCents * fxRateToBnd);
}

/** Deterministic display, e.g. "BND 1,234.50". */
export function formatMoney(
  cents: number,
  currency: CurrencyCode = "BND",
): string {
  const value = (cents / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${value}`;
}

export function formatBnd(cents: number): string {
  return formatMoney(cents, "BND");
}

export function formatOriginal(
  cents: number,
  currency: CurrencyCode,
): string {
  return formatMoney(cents, currency);
}

/** Signed, human-friendly position: "+BND 12.00" / "−BND 8.50". */
export function formatPosition(cents: number): string {
  if (cents === 0) return "BND 0.00";
  const sign = cents > 0 ? "+" : "−";
  return `${sign}${formatBnd(Math.abs(cents))}`;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}
