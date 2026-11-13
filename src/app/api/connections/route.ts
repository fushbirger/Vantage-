import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { getConnectionOverview, requestConnection } from "@/lib/collab";
import { notifyUser } from "@/lib/notify";
import { text } from "@/lib/validation";
import { connectionAcceptedBody, connectionRequestBody } from "@/lib/wa";

export async function GET() {
  return withUser(async (user) => NextResponse.json(getConnectionOverview(user.id)));
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    const body = await readJson(request);
    const username = text(body.username, 50);
    if (!username) {
      return NextResponse.json({ error: "Enter a username." }, { status: 400 });
    }
    const { connection, target, accepted } = requestConnection(user, username);

    try {
      await notifyUser({
        userId: target.id,
        groupId: null,
        template: accepted ? "connection_accepted" : "connection_request",
        body: accepted
          ? connectionAcceptedBody({ actorName: user.name })
          : connectionRequestBody({ actorName: user.name }),
      });
    } catch (error) {
      console.error("WhatsApp connection notification failed", error);
    }

    return NextResponse.json({ ok: true, connection, accepted }, { status: 201 });
  });
}
