import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getSettlement } from "@/lib/queries";
import { VisionError, verifyPaymentScreenshot, visionStatus } from "@/lib/vision";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const settlement = getSettlement(id);
    if (!settlement) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 },
      );
    }
    if (settlement.toUser !== user.id) {
      return NextResponse.json(
        { error: "Only the recipient can check this screenshot." },
        { status: 403 },
      );
    }
    if (!settlement.proofData) {
      return NextResponse.json(
        { error: "This claim has no payment screenshot to check." },
        { status: 400 },
      );
    }
    if (!visionStatus().configured) {
      return NextResponse.json(
        {
          error:
            "Vision AI is not configured. You can still confirm the payment manually.",
        },
        { status: 503 },
      );
    }

    try {
      const check = await verifyPaymentScreenshot(
        settlement.proofData,
        settlement.amountBndCents,
      );
      return NextResponse.json({ ok: true, check });
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
