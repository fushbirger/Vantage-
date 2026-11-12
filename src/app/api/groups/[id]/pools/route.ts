import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { createPool, getGroup, isGroupMember } from "@/lib/queries";
import { notifyTargets, notificationTargets } from "@/lib/notify";
import { money, optionalText, text } from "@/lib/validation";
import { poolCreatedBody } from "@/lib/wa";

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
    const title = text(body.title, 100);
    const goalBndCents = money(body.goal);
    const note = optionalText(body.note, 500);
    const deadline =
      typeof body.deadline === "number" && Number.isFinite(body.deadline)
        ? body.deadline
        : null;

    if (title.length < 2) {
      return NextResponse.json(
        { error: "Give the pool a name." },
        { status: 400 },
      );
    }
    if (goalBndCents <= 0) {
      return NextResponse.json(
        { error: "Set a goal above zero." },
        { status: 400 },
      );
    }

    const pool = createPool({
      groupId,
      title,
      note,
      goalBndCents,
      deadline,
      createdBy: user.id,
    });

    try {
      const targets = notificationTargets(groupId, user.id);
      await notifyTargets(targets, {
        groupId,
        template: "pool_created",
        body: () =>
          poolCreatedBody({
            actorName: user.name,
            title,
            goalBndCents,
            groupName: group.name,
            groupId,
          }),
      });
    } catch (error) {
      console.error("WhatsApp pool notification failed", error);
    }

    return NextResponse.json({ ok: true, pool }, { status: 201 });
  });
}
