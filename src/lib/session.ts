import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getUserById } from "./queries";
import type { User } from "./types";

const COOKIE_NAME = "vantage_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const SECRET =
  process.env.VANTAGE_SESSION_SECRET ?? "vantage-local-dev-secret-change-me";

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

function verify(userId: string, signature: string): boolean {
  const expected = sign(userId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function sessionCookie(userId: string): {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: string;
    maxAge: number;
    secure: boolean;
  };
} {
  return {
    name: COOKIE_NAME,
    value: `${userId}.${sign(userId)}`,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export function clearedSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [userId, signature] = raw.split(".");
  if (!userId || !signature || !verify(userId, signature)) return null;
  return userId;
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  return userId ? getUserById(userId) : null;
}
