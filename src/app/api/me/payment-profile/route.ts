import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { getPaymentProfile, upsertPaymentProfile } from "@/lib/queries";
import { imageDataUrl, isRail, optionalText } from "@/lib/validation";

export async function GET() {
  return withUser(async (user) => {
    return NextResponse.json({ profile: getPaymentProfile(user.id) });
  });
}

export async function PUT(request: Request) {
  return withUser(async (user) => {
    const body = await readJson(request);
    const preferredRail = isRail(body.preferredRail)
      ? body.preferredRail
      : "tarus";
    const tarusProxy = optionalText(body.tarusProxy, 80);
    const pocketLink = optionalText(body.pocketLink, 400);
    const tarusQrData = imageDataUrl(body.tarusQrData);
    const whatsappOptIn = body.whatsappOptIn !== false;

    if (pocketLink && !/^https?:\/\//i.test(pocketLink)) {
      return NextResponse.json(
        { error: "Pocket link must start with http:// or https://" },
        { status: 400 },
      );
    }

    const profile = upsertPaymentProfile(user.id, {
      preferredRail,
      tarusProxy,
      tarusQrData,
      pocketLink,
      whatsappOptIn,
    });

    return NextResponse.json({ ok: true, profile });
  });
}
