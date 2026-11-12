import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messages?: Array<Record<string, unknown>>;
        statuses?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
}

function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // signature verification optional until configured
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");
  const received = header.slice(7);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(received, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}

/**
 * Meta webhook verification challenge.
 * Configure this URL in the WhatsApp Business Cloud API dashboard and set
 * WHATSAPP_VERIFY_TOKEN to the same value used there.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? "vantage-verify";

  if (mode === "subscribe" && token === expected) {
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json(
    { error: "Webhook verification failed." },
    { status: 403 },
  );
}

/**
 * Inbound webhook: messages and delivery statuses are persisted for audit.
 * Business replies can be layered on top of this modular handler.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!validSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const insert = db.prepare(
    `INSERT INTO whatsapp_events (id, direction, payload, created_at)
     VALUES (?, ?, ?, ?)`,
  );
  let events = 0;
  const now = Date.now();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];
      const statuses = change.value?.statuses ?? [];

      for (const message of messages) {
        insert.run(
          `wae_${crypto.randomUUID()}`,
          "inbound",
          JSON.stringify({
            entryId: entry.id,
            field: change.field,
            message,
          }),
          now,
        );
        events += 1;
      }

      for (const status of statuses) {
        insert.run(
          `wae_${crypto.randomUUID()}`,
          "status",
          JSON.stringify({
            entryId: entry.id,
            field: change.field,
            status,
          }),
          now,
        );
        events += 1;
      }
    }
  }

  return NextResponse.json({ received: true, events });
}
