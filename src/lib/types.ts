export type CurrencyCode = "BND" | "MYR" | "SGD" | "USD";

export type SplitRule = "equal" | "exact" | "percent" | "shares";

export type PreferredRail = "tarus" | "tarusqr" | "pocket";

export type SettlementStatus = "pending" | "completed" | "rejected";

/** Lifecycle of an expense under multi-side confirmation. */
export type ExpenseStatus = "pending" | "confirmed" | "rejected";
export type ConfirmationStatus = "pending" | "confirmed" | "rejected";
export type MemberStatus = "active" | "invited";
export type ConnectionStatus = "pending" | "accepted";

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
  /** 1 when every expense needs a yes from each other person it touches. */
  requireConfirmation: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: "owner" | "member";
  status: MemberStatus;
  invitedBy: string | null;
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
  createdBy: string | null;
  status: ExpenseStatus;
  resolvedAt: number | null;
  payerName: string;
  payerColor: string;
}

export interface ExpenseConfirmation {
  userId: string;
  status: ConfirmationStatus;
  respondedAt: number | null;
  userName: string;
  userColor: string;
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
  confirmations: ExpenseConfirmation[];
  creatorName: string | null;
}

/** A pending expense that needs the current user's answer. */
export interface ExpenseAwaitingMe {
  id: string;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  title: string;
  amountBndCents: number;
  creatorName: string;
  paidByYou: boolean;
  yourShareCents: number;
  createdAt: number;
}

export interface ConnectionEntry {
  id: string;
  status: ConnectionStatus;
  createdAt: number;
  user: Pick<User, "id" | "username" | "name" | "avatarColor">;
}

export interface ConnectionOverview {
  connected: ConnectionEntry[];
  /** Requests other people sent to me. */
  incoming: ConnectionEntry[];
  /** Requests I sent that are still waiting. */
  outgoing: ConnectionEntry[];
}

export interface GroupInvite {
  groupId: string;
  groupName: string;
  groupEmoji: string;
  invitedByName: string | null;
  invitedAt: number;
}

export interface AttentionCounts {
  expenses: number;
  connections: number;
  invites: number;
  total: number;
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
