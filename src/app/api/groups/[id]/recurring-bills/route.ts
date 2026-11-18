import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { CURRENCIES, convertToBndCents } from "@/lib/currency";
import { createRecurringBill } from "@/lib/recurring";
import { getGroup, getGroupMembers, isGroupMember } from "@/lib/queries";
import { computeSplits, SplitError } from "@/lib/split";
import {
  fx as parseFx,
  isCategory,
  isCurrencyCode,
  isSplitRule,
  money,
  optionalText,
  text,
} from "@/lib/validation";

interface ParticipantBody {
  userId: string;
  value?: number;
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
    const members = getGroupMembers(groupId);
    const memberIds = new Set(members.map((member) => member.userId));

    const title = text(body.title, 120);
    const amountCents = money(body.amount);
    const currency = isCurrencyCode(body.currency) ? body.currency : "BND";
    const fxRateToBnd =
      currency === "BND"
        ? 1
        : parseFx(body.fxRate) || CURRENCIES[currency].defaultRateToBnd;
    const amountBndCents = convertToBndCents(amountCents, fxRateToBnd);
    const paidBy = text(body.paidBy, 100);
    const category = isCategory(body.category) ? String(body.category) : "general";
    const splitRule = isSplitRule(body.splitRule) ? body.splitRule : "equal";
    const dayOfMonth = Math.min(
      28,
      Math.max(1, Math.round(Number(body.dayOfMonth) || 1)),
    );

    if (title.length < 2) {
      return NextResponse.json(
        { error: "Give the monthly bill a name." },
        { status: 400 },
      );
    }
    if (amountCents <= 0 || amountBndCents <= 0) {
      return NextResponse.json(
        { error: "Amount must be above zero." },
        { status: 400 },
      );
    }
    if (!memberIds.has(paidBy)) {
      return NextResponse.json(
        { error: "The payer must be a group member." },
        { status: 400 },
      );
    }

    const participants = (
      Array.isArray(body.participants)
        ? (body.participants as ParticipantBody[])
        : []
    )
      .filter(
        (participant) =>
          participant &&
          typeof participant.userId === "string" &&
          memberIds.has(participant.userId),
      )
      .map((participant) => ({
        userId: participant.userId,
        value: Number(participant.value ?? 0),
      }));

    if (!participants.length) {
      return NextResponse.json(
        { error: "Choose at least one participant." },
        { status: 400 },
      );
    }

    try {
      computeSplits({
        rule: splitRule,
        amountBndCents,
        amountCents,
        fxRateToBnd,
        participants,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof SplitError ? error.message : "Check the split.",
        },
        { status: 400 },
      );
    }

    const bill = createRecurringBill({
      groupId,
      title,
      category,
      amountCents,
      currency,
      fxRateToBnd,
      amountBndCents,
      paidBy,
      splitRule,
      participants,
      dayOfMonth,
      createdBy: user.id,
    });

    return NextResponse.json({ ok: true, bill }, { status: 201 });
  });
}
