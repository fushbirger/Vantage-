import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { imageDataUrl } from "@/lib/validation";
import { VisionError, scanReceipt, visionStatus } from "@/lib/vision";

export async function POST(request: Request) {
  return withUser(async () => {
    if (!visionStatus().configured) {
      return NextResponse.json(
        {
          error:
            "Receipt scanning is not configured. Add VISION_API_KEY to enable it.",
        },
        { status: 503 },
      );
    }

    const body = await readJson(request);
    const image = imageDataUrl(body.imageDataUrl, 4_500_000);
    if (!image) {
      return NextResponse.json(
        { error: "Upload a receipt image first." },
        { status: 400 },
      );
    }

    try {
      const receipt = await scanReceipt(image);
      return NextResponse.json({ ok: true, receipt });
    } catch (error) {
      if (error instanceof VisionError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      throw error;
    }
  });
}
