import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { removeConnection, respondToConnection } from "@/lib/collab";
import { notifyUser } from "@/lib/notify";
import { connectionAcceptedBody } from "@/lib/wa";

type Ctx = { params: Promise<{ id: string }> };

/** Answer a request sent to me: { action: "accept" | "decline" }. */
export async function PATCH(request: Request, context: Ctx) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const body = await readJson(request);
    if (body.action !== "accept" && body.action !== "decline") {
      return NextResponse.json({ error: "Choose accept or decline." }, { status: 400 });
    }
    const connection = respondToConnection(id, user.id, body.action);
    if (body.action === "accept") {
      try {
        await notifyUser({
          userId: connection.requesterId,
          groupId: null,
          template: "connection_accepted",
          body: connectionAcceptedBody({ actorName: user.name }),
        });
      } catch (error) {
        console.error("WhatsApp connection notification failed", error);
      }
    }
    return NextResponse.json({ ok: true });
  });
}

/** Cancel a request I sent, or disconnect from someone. */
export async function DELETE(_request: Request, context: Ctx) {
  return withUser(async (user) => {
    const { id } = await context.params;
    removeConnection(id, user.id);
    return NextResponse.json({ ok: true });
  });
}
