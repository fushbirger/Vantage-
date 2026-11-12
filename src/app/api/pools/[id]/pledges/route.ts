import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import {
  createPledge,
  getGroup,
  getPool,
  isGroupMember,
} from "@/lib/queries";
import { notifyUser } from "@/lib/notify";
import { money, optionalText } from "@/lib/validation";
import { poolPledgeBody } from "@/lib/wa";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id: poolId } = await context.params;
    const pool = getPool(poolId);
    if (!pool) {
      return NextResponse.json({ error: "Pool not found." }, { status: 404 });
    }
    if (!isGroupMember(pool.groupId, user.id)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    const group = getGroup(pool.groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const body = await readJson(request);
    const amountBndCents = money(body.amount);
    const status = body.status === "received" ? "received" : "pledged";
    const note = optionalText(body.note, 300);

    if (amountBndCents <= 0) {
      return NextResponse.json(
        { error: "Enter a pledge above zero." },
        { status: 400 },
      );
    }

    createPledge({
      poolId,
      userId: user.id,
      amountBndCents,
      status,
      note,
    });

    if (pool.createdBy !== user.id) {
      try {
        await notifyUser({
          userId: pool.createdBy,
          groupId: pool.groupId,
          template: "pool_pledge",
          body: poolPledgeBody({
            actorName: user.name,
            poolTitle: pool.title,
            amountBndCents,
            groupName: group.name,
            groupId: pool.groupId,
            received: status === "received",
          }),
        });
      } catch (error) {
        console.error("WhatsApp pledge notification failed", error);
      }
    }

    return NextResponse.json({ ok: true, amountBndCents, status });
  });
}
