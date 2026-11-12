import "server-only";
import { db } from "./db";
import { queueWhatsApp, type WhatsAppTemplate } from "./whatsapp";

export interface NotifyTarget {
  userId: string;
  name: string;
  phone: string | null;
}

interface TargetRow {
  userId: string;
  name: string;
  phone: string | null;
  optIn: number;
}

/** Group members who have a phone and have not opted out of WhatsApp updates. */
export function notificationTargets(
  groupId: string,
  excludeUserId?: string,
): NotifyTarget[] {
  const rows = db
    .prepare(
      `SELECT u.id AS userId, u.name, u.phone,
              COALESCE(p.whatsapp_opt_in, 1) AS optIn
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN payment_profiles p ON p.user_id = u.id
       WHERE gm.group_id = ?`,
    )
    .all(groupId) as TargetRow[];

  return rows
    .filter(
      (row) =>
        row.optIn &&
        row.phone &&
        row.userId !== excludeUserId &&
        row.userId !== undefined,
    )
    .map((row) => ({
      userId: row.userId,
      name: row.name,
      phone: row.phone,
    }));
}

export async function notifyTargets(
  targets: NotifyTarget[],
  input: {
    groupId: string;
    template: WhatsAppTemplate;
    body: (target: NotifyTarget) => string;
  },
): Promise<number> {
  const results = await Promise.all(
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
  return results.length;
}

export async function notifyUser(input: {
  userId: string;
  groupId: string;
  template: WhatsAppTemplate;
  body: string;
}): Promise<void> {
  const row = db
    .prepare(
      `SELECT u.id AS userId, u.name, u.phone,
              COALESCE(p.whatsapp_opt_in, 1) AS optIn
       FROM users u
       LEFT JOIN payment_profiles p ON p.user_id = u.id
       WHERE u.id = ?`,
    )
    .get(input.userId) as TargetRow | undefined;

  if (!row || !row.optIn || !row.phone) return;
  await queueWhatsApp({
    userId: row.userId,
    groupId: input.groupId,
    phone: row.phone,
    template: input.template,
    body: input.body,
  });
}
