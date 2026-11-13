import "server-only";
import { db } from "./db";
import { resolveExpenseStatus } from "./confirmation";
import { CollabError } from "./errors";
import { getUserById, getUserByUsername } from "./queries";
import type {
  AttentionCounts,
  ConfirmationStatus,
  ConnectionEntry,
  ConnectionOverview,
  ExpenseAwaitingMe,
  ExpenseStatus,
  GroupInvite,
  User,
} from "./types";

export { CollabError } from "./errors";

const USER_JOIN_COLS = `u.id, u.username, u.name, u.phone,
  u.avatar_color AS avatarColor, u.created_at AS createdAt`;

// ─── Account connections ────────────────────────────────────────────────────

interface ConnectionRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted";
  createdAt: number;
  respondedAt: number | null;
}

const CONNECTION_COLS = `id, requester_id AS requesterId, addressee_id AS addresseeId,
  status, created_at AS createdAt, responded_at AS respondedAt`;

export function findConnection(a: string, b: string): ConnectionRow | null {
  return (
    (db
      .prepare(
        `SELECT ${CONNECTION_COLS} FROM connections
         WHERE (requester_id = ? AND addressee_id = ?)
            OR (requester_id = ? AND addressee_id = ?)`,
      )
      .get(a, b, b, a) as ConnectionRow | undefined) ?? null
  );
}

export function getConnection(id: string): ConnectionRow | null {
  return (
    (db
      .prepare(`SELECT ${CONNECTION_COLS} FROM connections WHERE id = ?`)
      .get(id) as ConnectionRow | undefined) ?? null
  );
}

export function areConnected(a: string, b: string): boolean {
  return findConnection(a, b)?.status === "accepted";
}

/**
 * Ask another account to connect. If they already asked me, the two requests
 * cross and simply become one accepted connection.
 */
export function requestConnection(
  me: User,
  username: string,
): { connection: ConnectionRow; target: User; accepted: boolean } {
  const target = getUserByUsername(username.replace(/^@/, "").trim());
  if (!target) throw new CollabError("No account has that username.", 404);
  if (target.id === me.id) {
    throw new CollabError("You cannot connect with yourself.", 400);
  }

  const existing = findConnection(me.id, target.id);
  if (existing) {
    if (existing.status === "accepted") {
      throw new CollabError("You are already connected.", 409);
    }
    if (existing.requesterId === me.id) {
      throw new CollabError("You already sent this person a request.", 409);
    }
    db.prepare(
      "UPDATE connections SET status = 'accepted', responded_at = ? WHERE id = ?",
    ).run(Date.now(), existing.id);
    return { connection: getConnection(existing.id)!, target, accepted: true };
  }

  const id = `con_${crypto.randomUUID()}`;
  db.prepare(
    `INSERT INTO connections (id, requester_id, addressee_id, status, created_at, responded_at)
     VALUES (?, ?, ?, 'pending', ?, NULL)`,
  ).run(id, me.id, target.id, Date.now());
  return { connection: getConnection(id)!, target, accepted: false };
}

/** Only the person who was asked can accept or decline. */
export function respondToConnection(
  connectionId: string,
  userId: string,
  action: "accept" | "decline",
): ConnectionRow {
  const connection = getConnection(connectionId);
  if (!connection || connection.addresseeId !== userId) {
    throw new CollabError("Request not found.", 404);
  }
  if (connection.status !== "pending") {
    throw new CollabError("This request was already answered.", 409);
  }
  if (action === "decline") {
    db.prepare("DELETE FROM connections WHERE id = ?").run(connectionId);
    return connection;
  }
  db.prepare(
    "UPDATE connections SET status = 'accepted', responded_at = ? WHERE id = ?",
  ).run(Date.now(), connectionId);
  return getConnection(connectionId)!;
}

/** Cancel a request I sent, or disconnect. Either side may remove a link. */
export function removeConnection(connectionId: string, userId: string): void {
  const connection = getConnection(connectionId);
  if (
    !connection ||
    (connection.requesterId !== userId && connection.addresseeId !== userId)
  ) {
    throw new CollabError("Connection not found.", 404);
  }
  db.prepare("DELETE FROM connections WHERE id = ?").run(connectionId);
}

export function getConnectionOverview(userId: string): ConnectionOverview {
  const rows = db
    .prepare(
      `SELECT c.id AS connectionId, c.status, c.created_at AS connectionCreatedAt,
              c.requester_id AS requesterId,
              u.id AS userId, u.username, u.name, u.avatar_color AS avatarColor
       FROM connections c
       JOIN users u ON u.id = CASE WHEN c.requester_id = @me
                                   THEN c.addressee_id ELSE c.requester_id END
       WHERE c.requester_id = @me OR c.addressee_id = @me
       ORDER BY u.name`,
    )
    .all({ me: userId }) as Array<{
    connectionId: string;
    status: "pending" | "accepted";
    connectionCreatedAt: number;
    requesterId: string;
    userId: string;
    username: string;
    name: string;
    avatarColor: string;
  }>;

  const overview: ConnectionOverview = { connected: [], incoming: [], outgoing: [] };
  for (const row of rows) {
    const entry: ConnectionEntry = {
      id: row.connectionId,
      status: row.status,
      createdAt: row.connectionCreatedAt,
      user: {
        id: row.userId,
        username: row.username,
        name: row.name,
        avatarColor: row.avatarColor,
      },
    };
    if (row.status === "accepted") overview.connected.push(entry);
    else if (row.requesterId === userId) overview.outgoing.push(entry);
    else overview.incoming.push(entry);
  }
  return overview;
}

/** Accepted connections only: the pool of people I may invite to a group. */
export function getConnectedUsers(userId: string): User[] {
  return db
    .prepare(
      `SELECT ${USER_JOIN_COLS}
       FROM connections c
       JOIN users u ON u.id = CASE WHEN c.requester_id = @me
                                   THEN c.addressee_id ELSE c.requester_id END
       WHERE c.status = 'accepted' AND (c.requester_id = @me OR c.addressee_id = @me)
       ORDER BY u.name`,
    )
    .all({ me: userId }) as User[];
}

// ─── Group invitations ──────────────────────────────────────────────────────

function memberStatus(groupId: string, userId: string): "active" | "invited" | null {
  const row = db
    .prepare("SELECT status FROM group_members WHERE group_id = ? AND user_id = ?")
    .get(groupId, userId) as { status: "active" | "invited" } | undefined;
  return row?.status ?? null;
}

function isOwner(groupId: string, userId: string): boolean {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM group_members
         WHERE group_id = ? AND user_id = ? AND role = 'owner' AND status = 'active'`,
      )
      .get(groupId, userId),
  );
}

/** Owner invites connected people. Returns who was invited and who was skipped. */
export function inviteToGroup(
  groupId: string,
  inviterId: string,
  userIds: string[],
): { invited: string[]; skipped: Array<{ userId: string; reason: string }> } {
  if (!isOwner(groupId, inviterId)) {
    throw new CollabError("Only the group owner can invite people.", 403);
  }
  const invited: string[] = [];
  const skipped: Array<{ userId: string; reason: string }> = [];
  const insert = db.prepare(
    `INSERT INTO group_members (id, group_id, user_id, role, joined_at, status, invited_by)
     VALUES (?, ?, ?, 'member', ?, 'invited', ?)`,
  );
  db.transaction(() => {
    for (const userId of Array.from(new Set(userIds))) {
      if (!getUserById(userId)) {
        skipped.push({ userId, reason: "unknown account" });
      } else if (!areConnected(inviterId, userId)) {
        skipped.push({ userId, reason: "not connected" });
      } else if (memberStatus(groupId, userId)) {
        skipped.push({ userId, reason: "already in or invited" });
      } else {
        insert.run(`gm_${crypto.randomUUID()}`, groupId, userId, Date.now(), inviterId);
        invited.push(userId);
      }
    }
  })();
  return { invited, skipped };
}

/** Accept or decline my own invitation. Declining removes the row. */
export function respondToGroupInvite(
  groupId: string,
  userId: string,
  action: "accept" | "decline",
): void {
  if (memberStatus(groupId, userId) !== "invited") {
    throw new CollabError("There is no pending invitation for you here.", 404);
  }
  if (action === "decline") {
    db.prepare(
      "DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'invited'",
    ).run(groupId, userId);
    return;
  }
  db.prepare(
    `UPDATE group_members SET status = 'active', joined_at = ?
     WHERE group_id = ? AND user_id = ? AND status = 'invited'`,
  ).run(Date.now(), groupId, userId);
}

/** Owner withdraws someone's invitation before they accept. */
export function cancelGroupInvite(
  groupId: string,
  ownerId: string,
  userId: string,
): void {
  if (!isOwner(groupId, ownerId)) {
    throw new CollabError("Only the group owner can withdraw an invitation.", 403);
  }
  const result = db
    .prepare(
      "DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'invited'",
    )
    .run(groupId, userId);
  if (!result.changes) throw new CollabError("No pending invitation found.", 404);
}

export function getGroupInvitesForUser(userId: string): GroupInvite[] {
  return db
    .prepare(
      `SELECT g.id AS groupId, g.name AS groupName, g.emoji AS groupEmoji,
              inv.name AS invitedByName, gm.joined_at AS invitedAt
       FROM group_members gm
       JOIN "groups" g ON g.id = gm.group_id
       LEFT JOIN users inv ON inv.id = gm.invited_by
       WHERE gm.user_id = ? AND gm.status = 'invited'
       ORDER BY gm.joined_at DESC`,
    )
    .all(userId) as GroupInvite[];
}

export function setRequireConfirmation(
  groupId: string,
  userId: string,
  value: boolean,
): void {
  if (!isOwner(groupId, userId)) {
    throw new CollabError("Only the group owner can change this setting.", 403);
  }
  db.prepare('UPDATE "groups" SET require_confirmation = ? WHERE id = ?').run(
    value ? 1 : 0,
    groupId,
  );
}

// ─── Expense confirmation ───────────────────────────────────────────────────

interface ExpenseRow {
  id: string;
  groupId: string;
  title: string;
  createdBy: string | null;
  status: ExpenseStatus;
}

function getExpenseRow(id: string): ExpenseRow | null {
  return (
    (db
      .prepare(
        `SELECT id, group_id AS groupId, title, created_by AS createdBy, status
         FROM expenses WHERE id = ?`,
      )
      .get(id) as ExpenseRow | undefined) ?? null
  );
}

export interface ExpenseAnswer {
  expense: ExpenseRow & { status: ExpenseStatus };
  groupId: string;
  authorId: string | null;
  /** True when this answer is what moved the expense out of "pending". */
  resolved: boolean;
  withdrawn: boolean;
}

/**
 * confirm / reject: one of the people the expense touches answers it.
 * withdraw: the author takes back an expense that is not on the ledger yet.
 */
export function answerExpense(
  expenseId: string,
  userId: string,
  action: "confirm" | "reject" | "withdraw",
): ExpenseAnswer {
  const expense = getExpenseRow(expenseId);
  const isMember =
    expense &&
    Boolean(
      db
        .prepare(
          "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'",
        )
        .get(expense.groupId, userId),
    );
  // Hide expenses from people outside the group entirely.
  if (!expense || !isMember) throw new CollabError("Expense not found.", 404);

  if (action === "withdraw") {
    if (expense.createdBy !== userId) {
      throw new CollabError("Only the person who added it can withdraw it.", 403);
    }
    if (expense.status === "confirmed") {
      throw new CollabError("A confirmed expense is already on the ledger.", 409);
    }
    db.prepare("DELETE FROM expenses WHERE id = ?").run(expenseId);
    return {
      expense,
      groupId: expense.groupId,
      authorId: expense.createdBy,
      resolved: false,
      withdrawn: true,
    };
  }

  if (expense.status !== "pending") {
    throw new CollabError("This expense was already settled one way or the other.", 409);
  }
  const mine = db
    .prepare(
      "SELECT id, status FROM expense_confirmations WHERE expense_id = ? AND user_id = ?",
    )
    .get(expenseId, userId) as { id: string; status: ConfirmationStatus } | undefined;
  if (!mine) {
    throw new CollabError(
      expense.createdBy === userId
        ? "You added this expense, so you have already confirmed it."
        : "This expense does not need your answer.",
      403,
    );
  }
  if (mine.status !== "pending") {
    throw new CollabError("You already answered this expense.", 409);
  }

  let status: ExpenseStatus = "pending";
  db.transaction(() => {
    db.prepare(
      "UPDATE expense_confirmations SET status = ?, responded_at = ? WHERE id = ?",
    ).run(action === "confirm" ? "confirmed" : "rejected", Date.now(), mine.id);
    const states = (
      db
        .prepare("SELECT status FROM expense_confirmations WHERE expense_id = ?")
        .all(expenseId) as Array<{ status: ConfirmationStatus }>
    ).map((row) => row.status);
    status = resolveExpenseStatus(states);
    if (status !== "pending") {
      db.prepare("UPDATE expenses SET status = ?, resolved_at = ? WHERE id = ?").run(
        status,
        Date.now(),
        expenseId,
      );
    }
  })();

  return {
    expense: { ...expense, status },
    groupId: expense.groupId,
    authorId: expense.createdBy,
    resolved: status !== "pending",
    withdrawn: false,
  };
}

export function getExpensesAwaitingUser(userId: string): ExpenseAwaitingMe[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.group_id AS groupId, g.name AS groupName, g.emoji AS groupEmoji,
              e.title, e.amount_bnd_cents AS amountBndCents,
              COALESCE(cu.name, 'Someone') AS creatorName,
              CASE WHEN e.paid_by = @me THEN 1 ELSE 0 END AS paidByYou,
              COALESCE((SELECT s.amount_bnd_cents FROM expense_splits s
                        WHERE s.expense_id = e.id AND s.user_id = @me), 0) AS yourShareCents,
              e.created_at AS createdAt
       FROM expense_confirmations c
       JOIN expenses e ON e.id = c.expense_id
       JOIN "groups" g ON g.id = e.group_id
       LEFT JOIN users cu ON cu.id = e.created_by
       WHERE c.user_id = @me AND c.status = 'pending' AND e.status = 'pending'
       ORDER BY e.created_at DESC`,
    )
    .all({ me: userId }) as Array<
    Omit<ExpenseAwaitingMe, "paidByYou"> & { paidByYou: number }
  >;
  return rows.map((row) => ({ ...row, paidByYou: Boolean(row.paidByYou) }));
}

export function getAttentionCounts(userId: string): AttentionCounts {
  const expenses = getExpensesAwaitingUser(userId).length;
  const connections = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM connections WHERE addressee_id = ? AND status = 'pending'",
      )
      .get(userId) as { n: number }
  ).n;
  const invites = getGroupInvitesForUser(userId).length;
  return { expenses, connections, invites, total: expenses + connections + invites };
}
