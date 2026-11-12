import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { updateUserProfile } from "@/lib/queries";
import { normalizePhone } from "@/lib/wa";
import { text } from "@/lib/validation";

export async function PATCH(request: Request) {
  return withUser(async (user) => {
    const body = await readJson(request);
    const name = text(body.name, 60);
    const rawPhone = text(body.phone, 30);
    const phone = rawPhone ? normalizePhone(rawPhone) : null;

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Display name needs at least two characters." },
        { status: 400 },
      );
    }
    if (rawPhone && !phone) {
      return NextResponse.json(
        { error: "Please enter a valid phone number." },
        { status: 400 },
      );
    }

    const updated = updateUserProfile(user.id, { name, phone });
    return NextResponse.json({ ok: true, user: updated });
  });
}
