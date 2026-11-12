import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./session";
import type { User } from "./types";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function currentUserOrNull(): Promise<User | null> {
  return getCurrentUser();
}

export async function withUser(
  handler: (user: User) => Promise<NextResponse>,
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return apiError("Sign in to continue.", 401);
  try {
    return await handler(user);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return apiError(message, 500);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
