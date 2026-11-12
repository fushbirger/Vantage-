import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import {
  createSettlement,
  getGroup,
  getGroupMembers,
  hasPendingSettlement,
  isGroupMember,
} from "@/lib/queries";
import { notifyUser } from "@/lib/notify";
import { imageDataUrl, intCents, optionalText, text } from "@/lib/validation";
import { settlementConfirmedBody, settlementMarkedBody } from "@/lib/wa";

const RAILS = ["tarus", "tarusqr", "pocket", "cash", "other"] as const;
type Rail = (typeof RAILS)[number];

function isRail(value: unknown): value is Rail {
  return typeof value === "string" && RAILS.includes(value as Rail);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id: groupId } = await context.params;
    if (!isGroupMember(groupId, user.id)) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }
    const group = getGroup(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const body = await readJson(request);
    const fromUser = text(body.fromUser, 100);
    const toUser = text(body.toUser, 100);
    const amountBndCents = intCents(body.amountCents);
    const rail = isRail(body.rail) ? body.rail : "tarus";
    const note = optionalText(body.note, 300);
    const proofData = imageDataUrl(body.proofData);

    const memberIds = new Set(
      getGroupMembers(groupId).map((member) => member.userId),
    );
    if (!memberIds.has(fromUser) || !memberIds.has(toUser)) {
      return NextResponse.json(
        { error: "Both people must be group members." },
        { status: 400 },
      );
    }
    if (fromUser === toUser) {
      return NextResponse.json(
        { error: "A payment needs two different people." },
        { status: 400 },
      );
    }
    if (!amountBndCents || amountBndCents <= 0) {
      return NextResponse.json(
        { error: "Enter an amount above zero." },
        { status: 400 },
      );
    }

    const isPayer = user.id === fromUser;
    const isPayee = user.id === toUser;
    if (!isPayer && !isPayee) {
      return NextResponse.json(
        { error: "Only the payer or recipient can record this transfer." },
        { status: 403 },
      );
    }

    if (isPayer) {
      if (
        hasPendingSettlement({
          groupId,
          fromUser,
          toUser,
          amountBndCents,
        })
      ) {
        return NextResponse.json(
          {
            error:
              "A claim for this exact amount is already awaiting confirmation.",
          },
          { status: 409 },
        );
      }
    }

    // A payer's claim is pending until the recipient confirms. A recipient
    // recording money received is already a confirmation.
    const settlement = createSettlement({
      groupId,
      fromUser,
      toUser,
      amountBndCents,
      rail,
      proofData,
      note,
      status: isPayee ? "completed" : "pending",
    });

    try {
      if (isPayer) {
        await notifyUser({
          userId: toUser,
          groupId,
          template: "settlement_marked",
          body: settlementMarkedBody({
            actorName: user.name,
            amountBndCents,
            groupName: group.name,
            groupId,
            rail,
          }),
        });
      } else {
        await notifyUser({
          userId: fromUser,
          groupId,
          template: "settlement_confirmed",
          body: settlementConfirmedBody({
            actorName: user.name,
            amountBndCents,
            groupName: group.name,
            groupId,
          }),
        });
      }
    } catch (error) {
      console.error("WhatsApp settlement notification failed", error);
    }

    return NextResponse.json(
      { ok: true, settlement, awaitingConfirmation: isPayer },
      { status: 201 },
    );
  });
}
