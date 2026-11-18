import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import {
  contributeToRepayment,
  getRepayment,
  isGroupMember,
  RepaymentError,
} from "@/lib/queries";
import { money, optionalText } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const repayment = getRepayment(id);
    if (!repayment) {
      return NextResponse.json(
        { error: "Repayment not found." },
        { status: 404 },
      );
    }
    if (!isGroupMember(repayment.groupId, user.id)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const body = await readJson(request);
    const amountBndCents = money(body.amount);
    const kind = body.kind === "cash_handed" ? "cash_handed" : "contribution";
    const note = optionalText(body.note, 300);

    if (amountBndCents <= 0) {
      return NextResponse.json(
        { error: "Enter an amount above zero." },
        { status: 400 },
      );
    }
    if (kind === "cash_handed" && repayment.createdBy !== user.id) {
      return NextResponse.json(
        { error: "Only the repayment creator can record cash handed back." },
        { status: 403 },
      );
    }

    try {
      const updated = contributeToRepayment({
        repaymentId: id,
        userId: user.id,
        amountBndCents,
        kind,
        note,
      });
      return NextResponse.json({ ok: true, repayment: updated }, { status: 201 });
    } catch (error) {
      if (error instanceof RepaymentError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  });
}
