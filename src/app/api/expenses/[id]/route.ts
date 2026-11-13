import { NextResponse } from "next/server";
import { readJson, withUser } from "@/lib/api";
import { answerExpense } from "@/lib/collab";
import { notifyUser } from "@/lib/notify";
import { getGroup } from "@/lib/queries";
import { expenseResolvedBody } from "@/lib/wa";

/** { action: "confirm" | "reject" | "withdraw" } */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const body = await readJson(request);
    const action = body.action;
    if (action !== "confirm" && action !== "reject" && action !== "withdraw") {
      return NextResponse.json(
        { error: "Choose confirm, reject or withdraw." },
        { status: 400 },
      );
    }

    const answer = answerExpense(id, user.id, action);

    if (!answer.withdrawn && answer.authorId && answer.authorId !== user.id) {
      const group = getGroup(answer.groupId);
      try {
        await notifyUser({
          userId: answer.authorId,
          groupId: answer.groupId,
          template: "expense_resolved",
          body: expenseResolvedBody({
            actorName: user.name,
            title: answer.expense.title,
            groupName: group?.name ?? "your group",
            groupId: answer.groupId,
            outcome:
              answer.expense.status === "confirmed"
                ? "confirmed"
                : answer.expense.status === "rejected"
                  ? "rejected"
                  : "partial",
          }),
        });
      } catch (error) {
        console.error("WhatsApp expense answer notification failed", error);
      }
    }

    return NextResponse.json({
      ok: true,
      status: answer.expense.status,
      withdrawn: answer.withdrawn,
    });
  });
}
