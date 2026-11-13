import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { inviteToGroup } from "@/lib/collab";
import { notifyUser } from "@/lib/notify";
import { getGroup } from "@/lib/queries";
import { appBaseUrl } from "@/lib/wa";

/** Owner invites connected people: { userIds: string[] } */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id: groupId } = await context.params;
    const group = getGroup(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }
    const body = await readJson(request);
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.filter((v): v is string => typeof v === "string")
      : [];
    if (!userIds.length) {
      return NextResponse.json({ error: "Choose at least one person." }, { status: 400 });
    }

    const result = inviteToGroup(groupId, user.id, userIds);

    for (const invitedId of result.invited) {
      try {
        await notifyUser({
          userId: invitedId,
          groupId,
          template: "group_invite",
          body: `${user.name} invited you to “${group.name}” ${group.emoji} on Vantage.\nAccept or decline: ${appBaseUrl()}/groups\nNothing is added to your ledger until you accept.`,
        });
      } catch (error) {
        console.error("WhatsApp invite failed", error);
      }
    }

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  });
}
