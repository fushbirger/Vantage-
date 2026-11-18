"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2, X } from "lucide-react";
import { sendJson } from "@/lib/client";

type Action = "confirm" | "reject" | "withdraw";

/** Answer an expense that is waiting on you, or take back one you wrote. */
export function ExpenseConfirmButtons({
  expenseId,
  mode,
  compact = false,
}: {
  expenseId: string;
  mode: "answer" | "withdraw";
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");

  async function send(action: Action) {
    setBusy(action);
    setError("");
    try {
      await sendJson(`/api/expenses/${expenseId}`, { action });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send.");
      setBusy(null);
    }
  }

  const size = compact ? "min-h-[36px] px-3 py-1.5 text-xs" : "";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {mode === "answer" ? (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => send("confirm")}
              className={`btn ${size}`}
            >
              <Check className="h-4 w-4" />
              {busy === "confirm" ? "Confirming…" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => send("reject")}
              className={`btn-danger ${size}`}
            >
              <X className="h-4 w-4" />
              {busy === "reject" ? "Rejecting…" : "Not mine"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => send("withdraw")}
            className={`btn-secondary ${size}`}
          >
            <Undo2 className="h-4 w-4" />
            {busy === "withdraw" ? "Removing…" : "Withdraw"}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-coral">{error}</p>}
    </div>
  );
}
