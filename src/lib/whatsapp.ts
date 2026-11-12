import "server-only";
import { db } from "./db";
import { normalizePhone, type WhatsAppTemplate } from "./wa";

export { normalizePhone } from "./wa";
export type { WhatsAppTemplate } from "./wa";

export function integrationStatus(): {
  configured: boolean;
  apiVersion: string;
  verifyTokenSet: boolean;
  phoneNumberIdSet: boolean;
} {
  return {
    configured: Boolean(
      process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
    ),
    apiVersion: process.env.WHATSAPP_API_VERSION ?? "v23.0",
    verifyTokenSet: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    phoneNumberIdSet: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
  };
}

async function callCloudApi(to: string, body: string): Promise<void> {
  const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_TOKEN!;
  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: { preview_url: true, body },
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WhatsApp API ${response.status}: ${text.slice(0, 300)}`);
  }
}

/**
 * Queue a WhatsApp notification in the outbox. When Cloud API credentials are
 * present we attempt delivery immediately; otherwise the message is marked
 * "simulated" so the whole flow is demoable without Meta approval.
 */
export async function queueWhatsApp(input: {
  userId: string;
  groupId: string | null;
  phone: string | null;
  template: WhatsAppTemplate;
  body: string;
}): Promise<{ id: string; status: string }> {
  const id = `wa_${crypto.randomUUID()}`;
  const now = Date.now();
  const configured = Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );

  db.prepare(
    `INSERT INTO whatsapp_outbox
       (id, group_id, user_id, phone, template, body, status, error, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
  ).run(
    id,
    input.groupId,
    input.userId,
    input.phone,
    input.template,
    input.body,
    configured && input.phone ? "queued" : "simulated",
    now,
  );

  if (configured && input.phone) {
    try {
      await callCloudApi(input.phone, input.body);
      db.prepare(
        "UPDATE whatsapp_outbox SET status = 'sent', sent_at = ? WHERE id = ?",
      ).run(Date.now(), id);
      return { id, status: "sent" };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown WhatsApp error";
      db.prepare(
        "UPDATE whatsapp_outbox SET status = 'failed', error = ? WHERE id = ?",
      ).run(message, id);
      return { id, status: "failed" };
    }
  }

  return { id, status: "simulated" };
}

/** Retry a single queued/failed message (used by the Activity debug panel). */
export async function retryOutboxMessage(id: string): Promise<string> {
  const message = db
    .prepare(
      "SELECT id, phone, body, status FROM whatsapp_outbox WHERE id = ?",
    )
    .get(id) as
    | { id: string; phone: string | null; body: string; status: string }
    | undefined;
  if (!message) throw new Error("Message not found");

  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    db.prepare(
      "UPDATE whatsapp_outbox SET status = 'simulated', error = NULL WHERE id = ?",
    ).run(id);
    return "simulated";
  }
  if (!message.phone) {
    db.prepare(
      "UPDATE whatsapp_outbox SET status = 'failed', error = 'No phone number on file' WHERE id = ?",
    ).run(id);
    return "failed";
  }

  try {
    await callCloudApi(message.phone, message.body);
    db.prepare(
      "UPDATE whatsapp_outbox SET status = 'sent', sent_at = ?, error = NULL WHERE id = ?",
    ).run(Date.now(), id);
    return "sent";
  } catch (error) {
    db.prepare(
      "UPDATE whatsapp_outbox SET status = 'failed', error = ? WHERE id = ?",
    ).run(error instanceof Error ? error.message : "Send failed", id);
    return "failed";
  }
}
