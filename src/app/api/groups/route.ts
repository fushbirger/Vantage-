import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { getConnectedUsers } from "@/lib/collab";
import { createGroup, getGroupsForUser } from "@/lib/queries";
import { notifyTargets, notificationTargets } from "@/lib/notify";
import { isGroupKind, text } from "@/lib/validation";
import { groupUrl } from "@/lib/wa";

export async function GET() {
  return withUser(async (user) => {
    return NextResponse.json({ groups: getGroupsForUser(user.id) });
  });
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    const body = await readJson(request);
    const name = text(body.name, 80);
    const emoji = text(body.emoji, 8) || "✈️";
    const kind = isGroupKind(body.kind) ? body.kind : "other";
    const description = text(body.description, 200);
    const requestedIds = Array.isArray(body.memberIds)
      ? body.memberIds.filter((id): id is string => typeof id === "string")
      : [];

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Give the group a name." },
        { status: 400 },
      );
    }

    // Only accepted connections can be invited: no pulling strangers in.
    const validIds = new Set(
      getConnectedUsers(user.id).map((person) => person.id),
    );
    if (requestedIds.some((id) => id !== user.id && !validIds.has(id))) {
      return NextResponse.json(
        { error: "You can only invite people you are connected with." },
        { status: 400 },
      );
    }
    const memberIds = requestedIds.filter((id) => id !== user.id);

    const group = createGroup({
      name,
      emoji,
      kind,
      description: description || null,
      createdBy: user.id,
      memberIds,
    });

    // Invitees are not members yet, so notify them by id.
    if (memberIds.length) {
      try {
        const invitedIds = new Set(memberIds);
        const targets = notificationTargets(group.id, user.id, true).filter(
          (target) => invitedIds.has(target.userId),
        );
        await notifyTargets(targets, {
          groupId: group.id,
          template: "group_invite",
          body: () =>
            `${user.name} invited you to “${group.name}” ${group.emoji} on Vantage.\nAccept or decline: ${groupUrl(group.id).replace(/\/groups\/.*/, "/groups")}\nNothing is added to your ledger until you accept. Vantage never holds money.`,
        });
      } catch (error) {
        console.error("WhatsApp invite queue failed", error);
      }
    }

    return NextResponse.json({ ok: true, group }, { status: 201 });
  });
}
