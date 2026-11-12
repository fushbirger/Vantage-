import { NextResponse } from "next/server";
import { readJson } from "@/lib/api";
import { createUser, getUserByUsername } from "@/lib/queries";
import { sessionCookie } from "@/lib/session";
import { normalizePhone } from "@/lib/wa";
import { text, validUsername } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await readJson(request);
  const name = text(body.name, 60);
  const username = text(body.username, 20).toLowerCase();
  const phone = text(body.phone, 30);

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Please enter a display name." },
      { status: 400 },
    );
  }
  if (!validUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 3–20 letters, numbers or underscores." },
      { status: 400 },
    );
  }
  if (getUserByUsername(username)) {
    return NextResponse.json(
      { error: "That username is already taken." },
      { status: 409 },
    );
  }
  if (phone && !normalizePhone(phone)) {
    return NextResponse.json(
      { error: "Please enter a valid phone number." },
      { status: 400 },
    );
  }

  try {
    const user = createUser({
      username,
      name,
      phone: phone ? normalizePhone(phone) : null,
    });
    const cookie = sessionCookie(user.id);
    const response = NextResponse.json({ ok: true, user }, { status: 201 });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Could not create the account." },
      { status: 500 },
    );
  }
}
