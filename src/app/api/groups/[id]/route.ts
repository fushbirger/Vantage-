import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { setRequireConfirmation } from "@/lib/collab";
import { isGroupMember } from "@/lib/queries";

/** Owner-only group settings: { requireConfirmation: boolean } */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id: groupId } = await context.params;
    if (!isGroupMember(groupId, user.id)) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }
    const body = await readJson(request);
    if (typeof body.requireConfirmation !== "boolean") {
      return NextResponse.json(
        { error: "requireConfirmation must be true or false." },
        { status: 400 },
      );
    }
    setRequireConfirmation(groupId, user.id, body.requireConfirmation);
    return NextResponse.json({ ok: true, requireConfirmation: body.requireConfirmation });
  });
}
