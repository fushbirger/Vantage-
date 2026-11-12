import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import {
  getGroup,
  getSettlement,
  isGroupMember,
  resolveSettlement,
} from "@/lib/queries";
import { notifyUser } from "@/lib/notify";
import { text } from "@/lib/validation";
import {
  settlementConfirmedBody,
  settlementRejectedBody,
} from "@/lib/wa";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const settlement = getSettlement(id);
    if (!settlement) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 },
      );
    }
    if (!isGroupMember(settlement.groupId, user.id)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    if (settlement.toUser !== user.id) {
      return NextResponse.json(
        { error: "Only the recipient can confirm this payment." },
        { status: 403 },
      );
    }
    if (settlement.status !== "pending") {
      return NextResponse.json(
        { error: "This payment has already been resolved." },
        { status: 400 },
      );
    }

    const body = await readJson(request);
    const action = text(body.action, 20);
    if (action !== "confirm" && action !== "reject") {
      return NextResponse.json(
        { error: "Choose confirm or reject." },
        { status: 400 },
      );
    }

    const status = action === "confirm" ? "completed" : "rejected";
    const resolved = resolveSettlement(id, status);

    const group = getGroup(settlement.groupId);
    if (group) {
      try {
        await notifyUser({
          userId: settlement.fromUser,
          groupId: settlement.groupId,
          template:
            status === "completed"
              ? "settlement_confirmed"
              : "settlement_rejected",
          body:
            status === "completed"
              ? settlementConfirmedBody({
                  actorName: user.name,
                  amountBndCents: settlement.amountBndCents,
                  groupName: group.name,
                  groupId: settlement.groupId,
                })
              : settlementRejectedBody({
                  actorName: user.name,
                  amountBndCents: settlement.amountBndCents,
                  groupName: group.name,
                  groupId: settlement.groupId,
                }),
        });
      } catch (error) {
        console.error("WhatsApp confirmation notification failed", error);
      }
    }

    return NextResponse.json({ ok: true, settlement: resolved });
  });
}
