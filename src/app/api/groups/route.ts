import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import {
  createGroup,
  getGroupsForUser,
  getUsers,
} from "@/lib/queries";
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

    const validIds = new Set(getUsers().map((person) => person.id));
    const memberIds = requestedIds.filter((id) => validIds.has(id));

    const group = createGroup({
      name,
      emoji,
      kind,
      description: description || null,
      createdBy: user.id,
      memberIds,
    });

    // A friendly invite for members who use WhatsApp.
    if (memberIds.length) {
      try {
        const targets = notificationTargets(group.id, user.id);
        await notifyTargets(targets, {
          groupId: group.id,
          template: "group_invite",
          body: () =>
            `${user.name} added you to “${group.name}” ${group.emoji} on Vantage.\nOpen the group: ${groupUrl(group.id)}\nNo money is held by Vantage — it is just the shared ledger.`,
        });
      } catch (error) {
        console.error("WhatsApp invite queue failed", error);
      }
    }

    return NextResponse.json({ ok: true, group }, { status: 201 });
  });
}
