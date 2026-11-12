import { NextResponse } from "next/server";
import { clearedSessionCookie } from "@/lib/session";

export async function POST() {
  const cookie = clearedSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
