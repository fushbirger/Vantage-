import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUser } from "@/lib/api";
import { retryOutboxMessage } from "@/lib/whatsapp";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const message = db
      .prepare("SELECT id, user_id AS userId FROM whatsapp_outbox WHERE id = ?")
      .get(id) as { id: string; userId: string | null } | undefined;
    if (!message || message.userId !== user.id) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    const status = await retryOutboxMessage(id);
    return NextResponse.json({ ok: true, status });
  });
}
