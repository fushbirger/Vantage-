import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import {
  getRecurringBill,
  setRecurringBillActive,
} from "@/lib/recurring";
import { isGroupMember } from "@/lib/queries";
import { text } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const bill = getRecurringBill(id);
    if (!bill) {
      return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    }
    if (!isGroupMember(bill.groupId, user.id)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    if (bill.createdBy !== user.id) {
      return NextResponse.json(
        { error: "Only the creator can change this schedule." },
        { status: 403 },
      );
    }

    const body = await readJson(request);
    const action = text(body.action, 20);
    if (action !== "pause" && action !== "resume") {
      return NextResponse.json(
        { error: "Choose pause or resume." },
        { status: 400 },
      );
    }

    setRecurringBillActive(id, action === "resume");
    return NextResponse.json({ ok: true, bill: getRecurringBill(id) });
  });
}
