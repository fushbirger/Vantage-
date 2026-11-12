import type { Group, SplitRule, PreferredRail } from "./types";

export const KIND_LABELS: Record<Group["kind"], string> = {
  trip: "Trip",
  dinner: "Dinner",
  gift: "Gift",
  home: "Household",
  other: "Group",
};

export const CATEGORY_META: Record<
  string,
  { label: string; emoji: string }
> = {
  general: { label: "General", emoji: "🧾" },
  food: { label: "Food", emoji: "🍜" },
  groceries: { label: "Groceries", emoji: "🛒" },
  transport: { label: "Transport", emoji: "⛽" },
  stay: { label: "Stay", emoji: "🛏️" },
  gift: { label: "Gift", emoji: "🎁" },
  activity: { label: "Activity", emoji: "🎟️" },
};

export const SPLIT_RULE_LABELS: Record<SplitRule, string> = {
  equal: "Equal split",
  exact: "Exact amounts",
  percent: "Percentages",
  shares: "Shares",
};

export const RAIL_LABELS: Record<PreferredRail | "cash" | "other", string> = {
  tarus: "tarus instant transfer",
  tarusqr: "tarusQR",
  pocket: "Pocket",
  cash: "Cash",
  other: "Other",
};

export function categoryFor(category: string) {
  return CATEGORY_META[category] ?? CATEGORY_META.general;
}
