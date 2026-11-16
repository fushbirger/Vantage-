import "server-only";
import { db } from "./db";
import { queueWhatsApp, type WhatsAppTemplate } from "./whatsapp";

export interface NotifyTarget {
  userId: string;
  name: string;
  phone: string; // guaranteed non-null after SQL filtering
}

interface TargetRow {
  userId: string;
  name: string;
  phone: string;
}

/**
 * Group members who have a phone number and have not opted out of WhatsApp
 * updates. Only 'active' members are included by default; set includeInvited
 * to also include 'invited' members.
 */
export function notificationTargets(
  groupId: string,
  excludeUserId?: string,
  includeInvited = false,
): NotifyTarget[] {
  const statuses = includeInvited ? ["active", "invited"] : ["active"];
  const placeholders = statuses.map(() => "?").join(", ");

  return db
    .prepare(
      `SELECT u.id AS userId, u.name, TRIM(u.phone) AS phone
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN payment_profiles p ON p.user_id = u.id
       WHERE gm.group_id = ?
         AND gm.status IN (${placeholders})
         AND COALESCE(p.whatsapp_opt_in, 1) = 1
         AND TRIM(COALESCE(u.phone, '')) <> ''
         AND (? IS NULL OR u.id <> ?)`,
    )
    .all(
      groupId,
      ...statuses,
      excludeUserId ?? null,
      excludeUserId ?? null,
    ) as TargetRow[];
}

/** Queue a message for every target. Returns the number successfully queued. */
export async function notifyTargets(
  targets: NotifyTarget[],
  input: {
    groupId: string;
    template: WhatsAppTemplate;
    body: (target: NotifyTarget) => string;
  },
): Promise<number> {
  const results = await Promise.allSettled(
    targets.map((target) =>
      queueWhatsApp({
        userId: target.userId,
        groupId: input.groupId,
        phone: target.phone,
        template: input.template,
        body: input.body(target),
      }),
    ),
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(
        `[notify] Failed to queue WhatsApp message for user ${targets[i].userId}`,
        result.reason,
      );
    }
  });

  return results.filter((r) => r.status === "fulfilled").length;
}

/** Queue a message for a single user, if they have a phone and have not opted out. */
export async function notifyUser(input: {
  userId: string;
  groupId: string | null;
  template: WhatsAppTemplate;
  body: string;
}): Promise<void> {
  const row = db
    .prepare(
      `SELECT u.id AS userId, u.name, TRIM(u.phone) AS phone
       FROM users u
       LEFT JOIN payment_profiles p ON p.user_id = u.id
       WHERE u.id = ?
         AND COALESCE(p.whatsapp_opt_in, 1) = 1
         AND TRIM(COALESCE(u.phone, '')) <> ''`,
    )
    .get(input.userId) as TargetRow | undefined;

  if (!row) return;

  await queueWhatsApp({
    userId: row.userId,
    groupId: input.groupId,
    phone: row.phone,
    template: input.template,
    body: input.body,
  });
}