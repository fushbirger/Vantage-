import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { cancelGroupInvite, respondToGroupInvite } from "@/lib/collab";
import { text } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Answer my own invitation: { action: "accept" | "decline" } */
export async function POST(request: Request, context: Ctx) {
  return withUser(async (user) => {
    const { id: groupId } = await context.params;
    const body = await readJson(request);
    if (body.action !== "accept" && body.action !== "decline") {
      return NextResponse.json({ error: "Choose accept or decline." }, { status: 400 });
    }
    respondToGroupInvite(groupId, user.id, body.action);
    return NextResponse.json({ ok: true });
  });
}

/** Owner withdraws a pending invitation: { userId } */
export async function DELETE(request: Request, context: Ctx) {
  return withUser(async (user) => {
    const { id: groupId } = await context.params;
    const body = await readJson(request);
    const userId = text(body.userId, 100);
    if (!userId) {
      return NextResponse.json({ error: "Who should be withdrawn?" }, { status: 400 });
    }
    cancelGroupInvite(groupId, user.id, userId);
    return NextResponse.json({ ok: true });
  });
}
