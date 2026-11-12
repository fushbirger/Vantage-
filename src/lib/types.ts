export type CurrencyCode = "BND" | "MYR" | "SGD" | "USD";

export type SplitRule = "equal" | "exact" | "percent" | "shares";

export type PreferredRail = "tarus" | "tarusqr" | "pocket";

export type SettlementStatus = "pending" | "completed" | "rejected";

export interface User {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  avatarColor: string;
  createdAt: number;
}

export interface PaymentProfile {
  id: string;
  userId: string;
  preferredRail: PreferredRail;
  tarusProxy: string | null;
  tarusQrData: string | null;
  pocketLink: string | null;
  whatsappOptIn: number;
  updatedAt: number;
  name?: string;
  username?: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  kind: "trip" | "dinner" | "gift" | "home" | "other";
  description: string | null;
  createdBy: string;
  createdAt: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: number;
  name: string;
  username: string;
  phone: string | null;
  avatarColor: string;
}

export interface Expense {
  id: string;
  groupId: string;
  paidBy: string;
  title: string;
  category: string;
  amountCents: number;
  currency: CurrencyCode;
  fxRateToBnd: number;
  amountBndCents: number;
  splitRule: SplitRule;
  receiptData: string | null;
  itemsJson: string | null;
  notes: string | null;
  spentAt: number;
  createdAt: number;
  payerName: string;
  payerColor: string;
}

export interface ExpenseItem {
  name: string;
  amountCents: number;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  amountBndCents: number;
  shareUnits: number | null;
  percent: number | null;
  userName: string;
  userColor: string;
}

export interface ExpenseWithSplits extends Expense {
  splits: ExpenseSplit[];
  items: ExpenseItem[];
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUser: string;
  toUser: string;
  amountBndCents: number;
  status: SettlementStatus;
  rail: "tarus" | "tarusqr" | "pocket" | "cash" | "other";
  proofData: string | null;
  note: string | null;
  createdAt: number;
  resolvedAt: number | null;
  fromName: string;
  fromColor: string;
  toName: string;
  toColor: string;
}

export interface Pool {
  id: string;
  groupId: string;
  title: string;
  note: string | null;
  goalBndCents: number;
  deadline: number | null;
  createdBy: string;
  createdAt: number;
  createdByName: string;
}

export interface PoolPledge {
  id: string;
  poolId: string;
  userId: string;
  amountBndCents: number;
  status: "pledged" | "received";
  note: string | null;
  createdAt: number;
  updatedAt: number;
  userName: string;
  userColor: string;
}

export interface PoolWithPledges extends Pool {
  pledges: PoolPledge[];
  pledgedCents: number;
  receivedCents: number;
}

export interface Balance {
  userId: string;
  amountCents: number;
  name: string;
  username: string;
  avatarColor: string;
}

export interface Transfer {
  from: string;
  to: string;
  amountCents: number;
}

export interface TransferView extends Transfer {
  fromName: string;
  fromColor: string;
  fromUsername: string;
  toName: string;
  toColor: string;
  toUsername: string;
}

export interface OutboxMessage {
  id: string;
  groupId: string | null;
  userId: string | null;
  phone: string | null;
  template: string;
  body: string;
  status: "queued" | "simulated" | "sent" | "failed";
  error: string | null;
  createdAt: number;
  sentAt: number | null;
  userName?: string | null;
  groupName?: string | null;
}
