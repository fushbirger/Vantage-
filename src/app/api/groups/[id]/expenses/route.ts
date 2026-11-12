import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { CURRENCIES, convertToBndCents } from "@/lib/currency";
import { addExpense, getGroup, getGroupMembers, isGroupMember } from "@/lib/queries";
import { notifyTargets, notificationTargets } from "@/lib/notify";
import { computeSplits, SplitError } from "@/lib/split";
import {
  fx as parseFx,
  imageDataUrl,
  intCents,
  isCategory,
  isCurrencyCode,
  isSplitRule,
  money,
  optionalText,
  text,
} from "@/lib/validation";
import { expenseAddedBody } from "@/lib/wa";

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
    const spentAt =
      typeof body.spentAt === "number" && Number.isFinite(body.spentAt)
        ? body.spentAt
        : Date.now();
    const notes = optionalText(body.notes, 500);
    const receiptData = imageDataUrl(body.receiptData);

    if (title.length < 2) {
      return NextResponse.json(
        { error: "Give the expense a name." },
        { status: 400 },
      );
    }
    if (amountCents <= 0 || amountBndCents <= 0) {
      return NextResponse.json(
        { error: "Amount must be above zero." },
        { status: 400 },
      );
    }
    if (!fxRateToBnd) {
      return NextResponse.json({ error: "Invalid FX rate." }, { status: 400 });
    }
    if (!memberIds.has(paidBy)) {
      return NextResponse.json(
        { error: "The payer must be a group member." },
        { status: 400 },
      );
    }

    const rawParticipants = Array.isArray(body.participants)
      ? (body.participants as ParticipantBody[])
      : [];
    const participants = rawParticipants
      .filter(
        (participant) =>
          participant &&
          typeof participant.userId === "string" &&
          memberIds.has(participant.userId),
      )
      .map((participant) => ({
        userId: participant.userId,
        value:
          typeof participant.value === "number"
            ? participant.value
            : Number(participant.value ?? 0),
      }));

    if (!participants.length) {
      return NextResponse.json(
        { error: "Choose at least one participant." },
        { status: 400 },
      );
    }

    let splits;
    try {
      splits = computeSplits({
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

    const items = Array.isArray(body.items)
      ? body.items
          .slice(0, 50)
          .map((item) => {
            const record = item as Record<string, unknown>;
            const name = text(record.name, 80);
            const cents = intCents(record.amountCents);
            return name && cents > 0 ? { name, amountCents: cents } : null;
          })
          .filter((item): item is { name: string; amountCents: number } =>
            Boolean(item),
          )
      : [];

    const expenseId = `exp_${crypto.randomUUID()}`;
    addExpense({
      id: expenseId,
      groupId,
      paidBy,
      title,
      category,
      amountCents,
      currency,
      fxRateToBnd,
      amountBndCents,
      splitRule,
      receiptData,
      itemsJson: items.length ? JSON.stringify(items) : null,
      notes,
      spentAt,
      splits,
    });

    const splitMap = new Map(
      splits.map((split) => [split.userId, split.amountBndCents]),
    );
    const targetIds = new Set(splits.map((split) => split.userId));
    const targets = notificationTargets(groupId, user.id).filter((target) =>
      targetIds.has(target.userId),
    );

    let notified = 0;
    try {
      notified = await notifyTargets(targets, {
        groupId,
        template: "expense_added",
        body: (target) =>
          expenseAddedBody({
            actorName: user.name,
            title,
            amountBndCents,
            groupName: group.name,
            groupId,
            yourShareCents: splitMap.get(target.userId) ?? 0,
          }),
      });
    } catch (error) {
      console.error("WhatsApp expense notification failed", error);
    }

    return NextResponse.json(
      {
        ok: true,
        expenseId,
        amountBndCents,
        splits,
        notified,
      },
      { status: 201 },
    );
  });
}
