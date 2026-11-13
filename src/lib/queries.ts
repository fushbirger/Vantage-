import "server-only";
import { db } from "./db";
import { computeNetBalances, totalSpendCents } from "./balances";
import { simplifyDebts, transfersWithPeople, type NetBalance } from "./simplify";
import { resolveExpenseStatus } from "./confirmation";
import type {
  Balance,
  ExpenseConfirmation,
  ExpenseStatus,
  ExpenseWithSplits,
  Group,
  GroupMember,
  OutboxMessage,
  PaymentProfile,
  Pool,
  PoolPledge,
  PoolWithPledges,
  Settlement,
  Transfer,
  User,
} from "./types";

const USER_COLS =
  "id, username, name, phone, avatar_color AS avatarColor, created_at AS createdAt";

const GROUP_COLS = `id, name, emoji, kind, description, created_by AS createdBy, created_at AS createdAt, require_confirmation AS requireConfirmation`;

const AVATAR_COLORS = [
  "#0f6b5d",
  "#c96f3b",
  "#3d5a80",
  "#9a5b8f",
  "#5c7a3e",
  "#a65d57",
];

export interface GroupLedger {
  group: Group;
  /** Active members only: the people the ledger is about. */
  members: GroupMember[];
  /** Invited but not yet accepted. No ledger access, cannot be in expenses. */
  invited: GroupMember[];
  /** Confirmed expenses only: balances and totals use exactly these. */
  expenses: ExpenseWithSplits[];
  /** Waiting for at least one person to confirm; not in balances yet. */
  pendingExpenses: ExpenseWithSplits[];
  /** Rejected by someone it touches; kept for the record, never in balances. */
  rejectedExpenses: ExpenseWithSplits[];
  settlements: Settlement[];
  pools: PoolWithPledges[];
  balances: Balance[];
  transfers: Array<
    Transfer & {
      fromName: string;
      fromUsername: string;
      fromColor: string;
      toName: string;
      toUsername: string;
      toColor: string;
    }
  >;
  totalCents: number;
  lastActivityAt: number;
}

export interface GroupSummary {
  group: Group;
  members: GroupMember[];
  totalCents: number;
  myBalanceCents: number;
  lastActivityAt: number;
  poolCount: number;
}

export interface ActivityItem extends OutboxMessage {
  groupName: string | null;
}

export function getUsers(): User[] {
  return db.prepare(`SELECT ${USER_COLS} FROM users ORDER BY name`).all() as User[];
}

export function getUserById(id: string): User | null {
  return (
    (db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id) as
      | User
      | undefined) ?? null
  );
}

export function getUserByUsername(username: string): User | null {
  return (
    (db
      .prepare(`SELECT ${USER_COLS} FROM users WHERE lower(username) = lower(?)`)
      .get(username) as User | undefined) ?? null
  );
}

export function createUser(input: {
  username: string;
  name: string;
  phone?: string | null;
}): User {
  const id = `usr_${crypto.randomUUID()}`;
  const color =
    AVATAR_COLORS[
      Array.from(input.username).reduce((n, c) => n + c.charCodeAt(0), 0) %
        AVATAR_COLORS.length
    ];
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, username, name, phone, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.username.toLowerCase(),
    input.name.trim(),
    input.phone?.trim() || null,
    color,
    now,
  );
  db.prepare(
    `INSERT INTO payment_profiles
       (id, user_id, preferred_rail, tarus_proxy, tarus_qr_data, pocket_link, whatsapp_opt_in, updated_at)
     VALUES (?, ?, 'tarus', ?, NULL, NULL, 1, ?)`,
  ).run(`prof_${crypto.randomUUID()}`, id, input.phone?.trim() || null, now);

  return getUserById(id)!;
}

export function updateUserProfile(
  id: string,
  input: { name: string; phone: string | null },
): User {
  db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(
    input.name.trim(),
    input.phone,
    id,
  );
  return getUserById(id)!;
}

export function getPaymentProfile(userId: string): PaymentProfile | null {  return (
    (db
      .prepare(
        `SELECT p.id, p.user_id AS userId, p.preferred_rail AS preferredRail,
                p.tarus_proxy AS tarusProxy, p.tarus_qr_data AS tarusQrData,
                p.pocket_link AS pocketLink, p.whatsapp_opt_in AS whatsappOptIn,
                p.updated_at AS updatedAt, u.name, u.username
         FROM payment_profiles p JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ?`,
      )
      .get(userId) as PaymentProfile | undefined) ?? null
  );
}

export function upsertPaymentProfile(
  userId: string,
  input: {
    preferredRail: "tarus" | "tarusqr" | "pocket";
    tarusProxy: string | null;
    tarusQrData: string | null;
    pocketLink: string | null;
    whatsappOptIn: boolean;
  },
): PaymentProfile {
  const existing = db
    .prepare("SELECT id FROM payment_profiles WHERE user_id = ?")
    .get(userId) as { id: string } | undefined;
  const now = Date.now();
  if (existing) {
    db.prepare(
      `UPDATE payment_profiles
       SET preferred_rail = ?, tarus_proxy = ?, tarus_qr_data = ?, pocket_link = ?,
           whatsapp_opt_in = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(
      input.preferredRail,
      input.tarusProxy,
      input.tarusQrData,
      input.pocketLink,
      input.whatsappOptIn ? 1 : 0,
      now,
      userId,
    );
  } else {
    db.prepare(
      `INSERT INTO payment_profiles
         (id, user_id, preferred_rail, tarus_proxy, tarus_qr_data, pocket_link, whatsapp_opt_in, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `prof_${crypto.randomUUID()}`,
      userId,
      input.preferredRail,
      input.tarusProxy,
      input.tarusQrData,
      input.pocketLink,
      input.whatsappOptIn ? 1 : 0,
      now,
    );
  }
  return getPaymentProfile(userId)!;
}

export function getGroup(groupId: string): Group | null {
  return (
    (db
      .prepare(`SELECT ${GROUP_COLS} FROM "groups" WHERE id = ?`)
      .get(groupId) as Group | undefined) ?? null
  );
}

const MEMBER_COLS = `gm.id, gm.group_id AS groupId, gm.user_id AS userId, gm.role,
              gm.status, gm.invited_by AS invitedBy, gm.joined_at AS joinedAt,
              u.name, u.username, u.phone, u.avatar_color AS avatarColor`;

/** Active members: the only people a ledger, split or settlement may involve. */
export function getGroupMembers(groupId: string): GroupMember[] {
  return db
    .prepare(
      `SELECT ${MEMBER_COLS}
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ? AND gm.status = 'active'
       ORDER BY CASE gm.role WHEN 'owner' THEN 0 ELSE 1 END, u.name`,
    )
    .all(groupId) as GroupMember[];
}

export function getInvitedMembers(groupId: string): GroupMember[] {
  return db
    .prepare(
      `SELECT ${MEMBER_COLS}
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ? AND gm.status = 'invited'
       ORDER BY u.name`,
    )
    .all(groupId) as GroupMember[];
}

export function isGroupMember(groupId: string, userId: string): boolean {
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'",
      )
      .get(groupId, userId),
  );
}

export function getGroupsForUser(userId: string): Group[] {
  return db
    .prepare(
      `SELECT g.id, g.name, g.emoji, g.kind, g.description,
              g.created_by AS createdBy, g.created_at AS createdAt,
              g.require_confirmation AS requireConfirmation
       FROM "groups" g JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ? AND gm.status = 'active'
       ORDER BY g.created_at DESC`,
    )
    .all(userId) as Group[];
}

function getPoolPledges(poolId: string): PoolPledge[] {
  return db
    .prepare(
      `SELECT pp.id, pp.pool_id AS poolId, pp.user_id AS userId,
              pp.amount_bnd_cents AS amountBndCents, pp.status, pp.note,
              pp.created_at AS createdAt, pp.updated_at AS updatedAt,
              u.name AS userName, u.avatar_color AS userColor
       FROM pool_pledges pp JOIN users u ON u.id = pp.user_id
       WHERE pp.pool_id = ?
       ORDER BY pp.created_at`,
    )
    .all(poolId) as PoolPledge[];
}

function getPools(groupId: string): PoolWithPledges[] {
  const pools = db
    .prepare(
      `SELECT p.id, p.group_id AS groupId, p.title, p.note,
              p.goal_bnd_cents AS goalBndCents, p.deadline,
              p.created_by AS createdBy, p.created_at AS createdAt,
              u.name AS createdByName
       FROM pools p JOIN users u ON u.id = p.created_by
       WHERE p.group_id = ?
       ORDER BY p.created_at DESC`,
    )
    .all(groupId) as Pool[];

  return pools.map((pool) => {
    const pledges = getPoolPledges(pool.id);
    return {
      ...pool,
      pledges,
      pledgedCents: pledges.reduce((sum, p) => sum + p.amountBndCents, 0),
      receivedCents: pledges
        .filter((p) => p.status === "received")
        .reduce((sum, p) => sum + p.amountBndCents, 0),
    };
  });
}

function getExpenses(groupId: string): ExpenseWithSplits[] {
  const expenses = db
    .prepare(
      `SELECT e.id, e.group_id AS groupId, e.paid_by AS paidBy, e.title, e.category,
              e.amount_cents AS amountCents, e.currency, e.fx_rate_to_bnd AS fxRateToBnd,
              e.amount_bnd_cents AS amountBndCents, e.split_rule AS splitRule,
              e.receipt_data AS receiptData, e.items_json AS itemsJson, e.notes,
              e.spent_at AS spentAt, e.created_at AS createdAt,
              e.created_by AS createdBy, e.status, e.resolved_at AS resolvedAt,
              u.name AS payerName, u.avatar_color AS payerColor,
              cu.name AS creatorName
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       LEFT JOIN users cu ON cu.id = e.created_by
       WHERE e.group_id = ?
       ORDER BY e.spent_at DESC, e.created_at DESC`,
    )
    .all(groupId) as Array<
    Omit<ExpenseWithSplits, "splits" | "items" | "confirmations"> & {
      itemsJson: string | null;
    }
  >;

  const confirmations = db
    .prepare(
      `SELECT c.expense_id AS expenseId, c.user_id AS userId, c.status,
              c.responded_at AS respondedAt, u.name AS userName,
              u.avatar_color AS userColor
       FROM expense_confirmations c
       JOIN expenses e ON e.id = c.expense_id
       JOIN users u ON u.id = c.user_id
       WHERE e.group_id = ?
       ORDER BY u.name`,
    )
    .all(groupId) as Array<ExpenseConfirmation & { expenseId: string }>;

  const splits = db
    .prepare(
      `SELECT s.id, s.expense_id AS expenseId, s.user_id AS userId,
              s.amount_bnd_cents AS amountBndCents, s.share_units AS shareUnits,
              s.percent, u.name AS userName, u.avatar_color AS userColor
       FROM expense_splits s
       JOIN expenses e ON e.id = s.expense_id
       JOIN users u ON u.id = s.user_id
       WHERE e.group_id = ?
       ORDER BY s.amount_bnd_cents DESC`,
    )
    .all(groupId) as Array<Omit<ExpenseWithSplits["splits"][number], never>>;

  return expenses.map((expense) => ({
    ...expense,
    splits: splits.filter((s) => s.expenseId === expense.id),
    confirmations: confirmations
      .filter((c) => c.expenseId === expense.id)
      .map(({ expenseId: _ignored, ...rest }) => rest),
    items: expense.itemsJson
      ? (JSON.parse(expense.itemsJson) as Array<{
          name: string;
          amountCents: number;
        }>)
      : [],
  }));
}

function getSettlements(groupId: string): Settlement[] {
  return db
    .prepare(
      `SELECT s.id, s.group_id AS groupId, s.from_user AS fromUser, s.to_user AS toUser,
              s.amount_bnd_cents AS amountBndCents, s.status, s.rail,
              s.proof_data AS proofData, s.note, s.created_at AS createdAt,
              s.resolved_at AS resolvedAt,
              uf.name AS fromName, uf.avatar_color AS fromColor,
              ut.name AS toName, ut.avatar_color AS toColor
       FROM settlements s
       JOIN users uf ON uf.id = s.from_user
       JOIN users ut ON ut.id = s.to_user
       WHERE s.group_id = ?
       ORDER BY s.created_at DESC`,
    )
    .all(groupId) as Settlement[];
}

export function getGroupLedger(groupId: string): GroupLedger | null {
  const group = getGroup(groupId);
  if (!group) return null;

  const members = getGroupMembers(groupId);
  const invited = getInvitedMembers(groupId);
  const allExpenses = getExpenses(groupId);
  const expenses = allExpenses.filter((e) => e.status === "confirmed");
  const pendingExpenses = allExpenses.filter((e) => e.status === "pending");
  const rejectedExpenses = allExpenses.filter((e) => e.status === "rejected");
  const settlements = getSettlements(groupId);
  const pools = getPools(groupId);

  const net: NetBalance[] = computeNetBalances({
    memberIds: members.map((m) => m.userId),
    expenses: expenses.map((e) => ({
      paidBy: e.paidBy,
      amountBndCents: e.amountBndCents,
    })),
    splits: expenses.flatMap((e) =>
      e.splits.map((s) => ({
        userId: s.userId,
        amountBndCents: s.amountBndCents,
      })),
    ),
    settlements: settlements.map((s) => ({
      fromUser: s.fromUser,
      toUser: s.toUser,
      amountBndCents: s.amountBndCents,
      status: s.status,
    })),
  });

  const memberInfo = new Map(members.map((m) => [m.userId, m]));
  const balances: Balance[] = net.map((b) => {
    const member = memberInfo.get(b.userId);
    return {
      userId: b.userId,
      amountCents: b.amountCents,
      name: member?.name ?? b.userId,
      username: member?.username ?? "",
      avatarColor: member?.avatarColor ?? "#0f6b5d",
    };
  });

  const transfers = transfersWithPeople(
    simplifyDebts(balances),
    members.map((m) => ({
      userId: m.userId,
      name: m.name,
      username: m.username,
      avatarColor: m.avatarColor,
    })),
  );

  const lastActivityAt = Math.max(
    group.createdAt,
    ...expenses.map((e) => e.createdAt),
    ...settlements.map((s) => s.createdAt),
    0,
  );

  return {
    group,
    members,
    invited,
    expenses,
    pendingExpenses,
    rejectedExpenses,
    settlements,
    pools,
    balances,
    transfers,
    totalCents: totalSpendCents(expenses),
    lastActivityAt,
  };
}

export function getGroupSummary(
  groupId: string,
  userId: string,
): GroupSummary | null {
  const ledger = getGroupLedger(groupId);
  if (!ledger) return null;
  return {
    group: ledger.group,
    members: ledger.members,
    totalCents: ledger.totalCents,
    myBalanceCents:
      ledger.balances.find((b) => b.userId === userId)?.amountCents ?? 0,
    lastActivityAt: ledger.lastActivityAt,
    poolCount: ledger.pools.length,
  };
}

export function getGroupSummariesForUser(userId: string): GroupSummary[] {
  return getGroupsForUser(userId)
    .map((group) => getGroupSummary(group.id, userId))
    .filter((summary): summary is GroupSummary => summary !== null);
}

export function createGroup(input: {
  name: string;
  emoji: string;
  kind: Group["kind"];
  description?: string | null;
  createdBy: string;
  memberIds: string[];
}): Group {
  const id = `grp_${crypto.randomUUID()}`;
  const now = Date.now();
  const memberIds = Array.from(new Set([input.createdBy, ...input.memberIds]));

  db.transaction(() => {
    db.prepare(
      `INSERT INTO "groups" (id, name, emoji, kind, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.name.trim(),
      input.emoji,
      input.kind,
      input.description?.trim() || null,
      input.createdBy,
      now,
    );
    const insert = db.prepare(
      `INSERT INTO group_members (id, group_id, user_id, role, joined_at, status, invited_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    // The creator is in straight away. Everyone else is only invited until
    // they accept, so nobody is put in a group (or its ledger) without a yes.
    memberIds.forEach((userId) => {
      const isCreator = userId === input.createdBy;
      insert.run(
        `gm_${crypto.randomUUID()}`,
        id,
        userId,
        isCreator ? "owner" : "member",
        now,
        isCreator ? "active" : "invited",
        isCreator ? null : input.createdBy,
      );
    });
  })();

  return getGroup(id)!;
}

export function addExpense(input: {
  id: string;
  groupId: string;
  paidBy: string;
  title: string;
  category: string;
  amountCents: number;
  currency: string;
  fxRateToBnd: number;
  amountBndCents: number;
  splitRule: string;
  receiptData: string | null;
  itemsJson: string | null;
  notes: string | null;
  spentAt: number;
  createdBy: string;
  /** People who must say yes first. Empty means it goes straight to the ledger. */
  confirmerIds: string[];
  splits: Array<{
    userId: string;
    amountBndCents: number;
    shareUnits: number | null;
    percent: number | null;
  }>;
}): ExpenseStatus {
  const now = Date.now();
  const status: ExpenseStatus = resolveExpenseStatus(
    input.confirmerIds.map(() => "pending"),
  );
  db.transaction(() => {
    db.prepare(
      `INSERT INTO expenses
         (id, group_id, paid_by, title, category, amount_cents, currency, fx_rate_to_bnd,
          amount_bnd_cents, split_rule, receipt_data, items_json, notes, spent_at, created_at,
          created_by, status, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.id,
      input.groupId,
      input.paidBy,
      input.title,
      input.category,
      input.amountCents,
      input.currency,
      input.fxRateToBnd,
      input.amountBndCents,
      input.splitRule,
      input.receiptData,
      input.itemsJson,
      input.notes,
      input.spentAt,
      now,
      input.createdBy,
      status,
      status === "confirmed" ? now : null,
    );
    const insertConfirmation = db.prepare(
      `INSERT INTO expense_confirmations (id, expense_id, user_id, status, responded_at)
       VALUES (?, ?, ?, 'pending', NULL)`,
    );
    for (const userId of input.confirmerIds) {
      insertConfirmation.run(`ec_${crypto.randomUUID()}`, input.id, userId);
    }
    const insertSplit = db.prepare(
      `INSERT INTO expense_splits
         (id, expense_id, user_id, amount_bnd_cents, share_units, percent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const split of input.splits) {
      insertSplit.run(
        `sp_${crypto.randomUUID()}`,
        input.id,
        split.userId,
        split.amountBndCents,
        split.shareUnits,
        split.percent,
      );
    }
  })();
  return status;
}

export function hasPendingSettlement(input: {
  groupId: string;
  fromUser: string;
  toUser: string;
  amountBndCents: number;
}): boolean {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM settlements
         WHERE group_id = ? AND from_user = ? AND to_user = ?
           AND amount_bnd_cents = ? AND status = 'pending'`,
      )
      .get(
        input.groupId,
        input.fromUser,
        input.toUser,
        input.amountBndCents,
      ),
  );
}

export function createSettlement(input: {  groupId: string;
  fromUser: string;
  toUser: string;
  amountBndCents: number;
  rail: "tarus" | "tarusqr" | "pocket" | "cash" | "other";
  proofData: string | null;
  note: string | null;
  status: "pending" | "completed";
}): Settlement {
  const id = `stl_${crypto.randomUUID()}`;
  const now = Date.now();
  db.prepare(
    `INSERT INTO settlements
       (id, group_id, from_user, to_user, amount_bnd_cents, status, rail, proof_data, note, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.groupId,
    input.fromUser,
    input.toUser,
    input.amountBndCents,
    input.status,
    input.rail,
    input.proofData,
    input.note,
    now,
    input.status === "completed" ? now : null,
  );

  return db
    .prepare(
      `SELECT s.id, s.group_id AS groupId, s.from_user AS fromUser, s.to_user AS toUser,
              s.amount_bnd_cents AS amountBndCents, s.status, s.rail,
              s.proof_data AS proofData, s.note, s.created_at AS createdAt,
              s.resolved_at AS resolvedAt,
              uf.name AS fromName, uf.avatar_color AS fromColor,
              ut.name AS toName, ut.avatar_color AS toColor
       FROM settlements s
       JOIN users uf ON uf.id = s.from_user
       JOIN users ut ON ut.id = s.to_user
       WHERE s.id = ?`,
    )
    .get(id) as Settlement;
}

export function getSettlement(id: string): Settlement | null {
  return (
    (db
      .prepare(
        `SELECT s.id, s.group_id AS groupId, s.from_user AS fromUser, s.to_user AS toUser,
                s.amount_bnd_cents AS amountBndCents, s.status, s.rail,
                s.proof_data AS proofData, s.note, s.created_at AS createdAt,
                s.resolved_at AS resolvedAt,
                uf.name AS fromName, uf.avatar_color AS fromColor,
                ut.name AS toName, ut.avatar_color AS toColor
         FROM settlements s
         JOIN users uf ON uf.id = s.from_user
         JOIN users ut ON ut.id = s.to_user
         WHERE s.id = ?`,
      )
      .get(id) as Settlement | undefined) ?? null
  );
}

export function resolveSettlement(
  id: string,
  status: "completed" | "rejected",
): Settlement {
  db.prepare(
    "UPDATE settlements SET status = ?, resolved_at = ? WHERE id = ?",
  ).run(status, Date.now(), id);
  return getSettlement(id)!;
}

export function createPool(input: {
  groupId: string;
  title: string;
  note: string | null;
  goalBndCents: number;
  deadline: number | null;
  createdBy: string;
}): Pool {
  const id = `pool_${crypto.randomUUID()}`;
  const now = Date.now();
  db.prepare(
    `INSERT INTO pools (id, group_id, title, note, goal_bnd_cents, deadline, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.groupId,
    input.title.trim(),
    input.note,
    input.goalBndCents,
    input.deadline,
    input.createdBy,
    now,
  );
  return db
    .prepare(
      `SELECT p.id, p.group_id AS groupId, p.title, p.note,
              p.goal_bnd_cents AS goalBndCents, p.deadline,
              p.created_by AS createdBy, p.created_at AS createdAt,
              u.name AS createdByName
       FROM pools p JOIN users u ON u.id = p.created_by WHERE p.id = ?`,
    )
    .get(id) as Pool;
}

export function createPledge(input: {
  poolId: string;
  userId: string;
  amountBndCents: number;
  status: "pledged" | "received";
  note: string | null;
}): void {
  const now = Date.now();
  const existing = db
    .prepare(
      "SELECT id, amount_bnd_cents AS amount FROM pool_pledges WHERE pool_id = ? AND user_id = ?",
    )
    .get(input.poolId, input.userId) as
    | { id: string; amount: number }
    | undefined;

  if (existing) {
    db.prepare(
      `UPDATE pool_pledges
       SET amount_bnd_cents = ?, status = ?, note = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      input.amountBndCents,
      input.status,
      input.note,
      now,
      existing.id,
    );
  } else {
    db.prepare(
      `INSERT INTO pool_pledges
         (id, pool_id, user_id, amount_bnd_cents, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `pl_${crypto.randomUUID()}`,
      input.poolId,
      input.userId,
      input.amountBndCents,
      input.status,
      input.note,
      now,
      now,
    );
  }
}

export function getPoolGroupId(poolId: string): string | null {
  const row = db
    .prepare("SELECT group_id AS groupId FROM pools WHERE id = ?")
    .get(poolId) as { groupId: string } | undefined;
  return row?.groupId ?? null;
}

export function getPool(poolId: string): Pool | null {
  return (
    (db
      .prepare(
        `SELECT p.id, p.group_id AS groupId, p.title, p.note,
                p.goal_bnd_cents AS goalBndCents, p.deadline,
                p.created_by AS createdBy, p.created_at AS createdAt,
                u.name AS createdByName
         FROM pools p JOIN users u ON u.id = p.created_by
         WHERE p.id = ?`,
      )
      .get(poolId) as Pool | undefined) ?? null
  );
}

export function getActivityForUser(userId: string): ActivityItem[] {
  return db
    .prepare(
      `SELECT o.id, o.group_id AS groupId, o.user_id AS userId, o.phone,
              o.template, o.body, o.status, o.error,
              o.created_at AS createdAt, o.sent_at AS sentAt,
              u.name AS userName, g.name AS groupName
       FROM whatsapp_outbox o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN "groups" g ON g.id = o.group_id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC
       LIMIT 60`,
    )
    .all(userId) as ActivityItem[];
}

export function getPendingSettlementsForUser(userId: string): Settlement[] {
  return db
    .prepare(
      `SELECT s.id, s.group_id AS groupId, s.from_user AS fromUser, s.to_user AS toUser,
              s.amount_bnd_cents AS amountBndCents, s.status, s.rail,
              s.proof_data AS proofData, s.note, s.created_at AS createdAt,
              s.resolved_at AS resolvedAt,
              uf.name AS fromName, uf.avatar_color AS fromColor,
              ut.name AS toName, ut.avatar_color AS toColor
       FROM settlements s
       JOIN users uf ON uf.id = s.from_user
       JOIN users ut ON ut.id = s.to_user
       WHERE s.status = 'pending' AND (s.to_user = ? OR s.from_user = ?)
       ORDER BY s.created_at DESC`,
    )
    .all(userId, userId) as Settlement[];
}

export function countUnreadNotifications(userId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM whatsapp_outbox
       WHERE user_id = ? AND status IN ('queued', 'simulated', 'sent')`,
    )
    .get(userId) as { n: number };
  return row.n;
}
