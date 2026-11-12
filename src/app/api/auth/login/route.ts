import { NextResponse } from "next/server";
import { readJson } from "@/lib/api";
import { getUserById, getUserByUsername } from "@/lib/queries";
import { sessionCookie } from "@/lib/session";
import { text } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await readJson(request);
  const userId = text(body.userId, 100);
  const username = text(body.username, 50);

  const user = userId
    ? getUserById(userId)
    : username
      ? getUserByUsername(username)
      : null;

  if (!user) {
    return NextResponse.json(
      { error: "That account was not found." },
      { status: 401 },
    );
  }

  const cookie = sessionCookie(user.id);
  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
