import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import {
  createRepayment,
  getGroup,
  getGroupMembers,
  isGroupMember,
} from "@/lib/queries";
import { money, optionalText, text } from "@/lib/validation";

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
    const title = text(body.title, 120);
    const targetBndCents = money(body.target);
    const note = optionalText(body.note, 500);
    const mode = body.mode === "equal" ? "equal" : "open";
    const memberIds = new Set(
      getGroupMembers(groupId).map((member) => member.userId),
    );

    if (title.length < 2) {
      return NextResponse.json(
        { error: "Give the repayment a name." },
        { status: 400 },
      );
    }
    if (targetBndCents <= 0) {
      return NextResponse.json(
        { error: "Set a target above zero." },
        { status: 400 },
      );
    }

    const participantIds = (
      Array.isArray(body.participantIds) ? body.participantIds : []
    ).filter(
      (value): value is string =>
        typeof value === "string" && memberIds.has(value),
    );
    if (mode === "equal" && participantIds.length === 0) {
      return NextResponse.json(
        { error: "Choose who shares this repayment equally." },
        { status: 400 },
      );
    }

    const repayment = createRepayment({
      groupId,
      title,
      note,
      targetBndCents,
      mode,
      participantIds: Array.from(new Set(participantIds)),
      createdBy: user.id,
    });

    return NextResponse.json({ ok: true, repayment }, { status: 201 });
  });
}
