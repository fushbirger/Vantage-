import type { Group, SplitRule, PreferredRail } from "./types";

export type GroupKind = Group["kind"];
export type RailKey = PreferredRail | "cash" | "other";

export const KIND_LABELS = {
  trip: "Trip",
  dinner: "Dinner",
  gift: "Gift",
  home: "Household",
  other: "Group",
} as const satisfies Record<GroupKind, string>;

export const CATEGORY_META = {
  general: { label: "General" },
  food: { label: "Food" },
  groceries: { label: "Groceries" },
  transport: { label: "Transport" },
  stay: { label: "Stay" },
  gift: { label: "Gift" },
  activity: { label: "Activity" },
} as const satisfies Record<string, { label: string }>;

export type CategoryKey = keyof typeof CATEGORY_META;

export const DEFAULT_CATEGORY: CategoryKey = "general";

export const SPLIT_RULE_LABELS = {
  equal: "Equal split",
  exact: "Exact amounts",
  percent: "Percentages",
  shares: "Shares",
} as const satisfies Record<SplitRule, string>;

export const RAIL_LABELS = {
  tarus: "tarus instant transfer",
  tarusqr: "tarusQR",
  pocket: "Pocket",
  cash: "Cash",
  other: "Other",
} as const satisfies Record<RailKey, string>;

export function isCategoryKey(value: string): value is CategoryKey {
  return Object.prototype.hasOwnProperty.call(CATEGORY_META, value);
}

export function categoryFor(category: string) {
  return CATEGORY_META[isCategoryKey(category) ? category : DEFAULT_CATEGORY];
}