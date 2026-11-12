"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageIcon, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { formatBnd } from "@/lib/currency";
import { formatDateTime } from "@/lib/dates";
import { RAIL_LABELS } from "@/lib/display";
import type { Settlement } from "@/lib/types";

export function SettlementClaimCard({
  settlement,
  currentUserId,
}: {
  settlement: Settlement;
  currentUserId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState("");
  const isCreditor = settlement.toUser === currentUserId;
  const isDebtor = settlement.fromUser === currentUserId;

  async function resolve(action: "confirm" | "reject") {
    setLoading(action);
    setError("");
    try {
      const response = await fetch(`/api/settlements/${settlement.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update payment.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update payment.");
      setLoading(null);
    }
  }

  return (
    <div className="rounded-3xl border border-amber-300/60 bg-amber-100/35 p-4">
      <div className="flex items-start gap-3">
        <div className="relative flex shrink-0 -space-x-2">
          <Avatar
            name={settlement.fromName}
            color={settlement.fromColor}
            size="sm"
            ring
          />
          <Avatar
            name={settlement.toName}
            color={settlement.toColor}
            size="sm"
            ring
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {isCreditor
              ? `${settlement.fromName} says they paid you`
              : isDebtor
                ? `Waiting for ${settlement.toName} to confirm`
                : `${settlement.fromName} → ${settlement.toName}`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {formatBnd(settlement.amountBndCents)} ·{" "}
            {RAIL_LABELS[settlement.rail]} · {formatDateTime(settlement.createdAt)}
          </p>
          {settlement.note && (
            <p className="mt-1.5 rounded-xl bg-white/60 px-2.5 py-1.5 text-[11px] text-ink/70">
              “{settlement.note}”
            </p>
          )}
        </div>
        <span className="pill bg-amber-300/60 text-ink/80">Pending</span>
      </div>

      {settlement.proofData && (
        <a
          href={settlement.proofData}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-800"
        >
          <ImageIcon className="h-3.5 w-3.5" /> View payment screenshot
        </a>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">
          {error}
        </p>
      )}

      {isCreditor && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => resolve("confirm")}
            disabled={loading !== null}
            className="btn flex-1 text-xs"
          >
            <Check className="h-3.5 w-3.5" />
            {loading === "confirm" ? "Confirming…" : "Confirm received"}
          </button>
          <button
            type="button"
            onClick={() => resolve("reject")}
            disabled={loading !== null}
            className="btn-danger flex-1 text-xs"
          >
            <X className="h-3.5 w-3.5" />
            {loading === "reject" ? "Updating…" : "Not received"}
          </button>
        </div>
      )}

      {isDebtor && (
        <p className="mt-3 text-[11px] leading-relaxed text-ink/60">
          Your ledger updates once {settlement.toName.split(" ")[0]} confirms.
          Keep your screenshot until then.
        </p>
      )}
    </div>
  );
}
