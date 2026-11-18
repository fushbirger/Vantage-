"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ImageIcon,
  Loader2,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { formatBnd } from "@/lib/currency";
import { formatDateTime } from "@/lib/dates";
import { RAIL_LABELS } from "@/lib/display";
import type { PaymentScreenshotCheck, Settlement } from "@/lib/types";

export function SettlementClaimCard({
  settlement,
  currentUserId,
}: {
  settlement: Settlement;
  currentUserId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "reject" | null>(null);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<PaymentScreenshotCheck | null>(null);
  const [checkError, setCheckError] = useState("");
  const [error, setError] = useState("");
  const isCreditor = settlement.toUser === currentUserId;
  const isDebtor = settlement.fromUser === currentUserId;

  async function runVisionCheck() {
    setChecking(true);
    setCheckError("");
    try {
      const response = await fetch(`/api/settlements/${settlement.id}/verify`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ??
            "The AI check is unavailable. Use the manual confirmation below.",
        );
      }
      setCheck(data.check as PaymentScreenshotCheck);
    } catch (caught) {
      setCheckError(
        caught instanceof Error
          ? caught.message
          : "The AI check is unavailable. Use manual confirmation.",
      );
    } finally {
      setChecking(false);
    }
  }

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
    <div className="rounded-none border border-neutral-300/60 bg-neutral-100/35 p-4">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 space-x-1">
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
            <p className="mt-1.5 rounded-none bg-white/60 px-2.5 py-1.5 text-[11px] text-black/70">
              “{settlement.note}”
            </p>
          )}
        </div>
        <span className="pill bg-neutral-300/60 text-black/80">Pending</span>
      </div>

      {settlement.proofData && (
        <a
          href={settlement.proofData}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-green-800"
        >
          <ImageIcon className="h-3.5 w-3.5" /> View payment screenshot
        </a>
      )}

      {isCreditor && settlement.proofData && (
        <div className="mt-3 rounded-none border border-line bg-white/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-900">
              <ScanLine className="h-3.5 w-3.5" /> Screenshot check
            </span>
            <button
              type="button"
              onClick={runVisionCheck}
              disabled={checking}
              className="btn-secondary px-2.5 py-1.5 text-[11px]"
            >
              {checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ScanLine className="h-3.5 w-3.5" />
              )}
              {checking ? "Checking…" : check ? "Check again" : "Check with AI"}
            </button>
          </div>

          {check && (
            <div className="mt-2 space-y-1">
              <p
                className={`inline-flex items-center gap-1 rounded-none px-2 py-0.5 text-[10px] font-bold   ${
                  check.amountMatches
                    ? "bg-green-100 text-green-800"
                    : "bg-neutral-200/70 text-black/75"
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                {check.amountMatches
                  ? "Amount looks right"
                  : check.isPaymentScreenshot
                    ? "Could not verify the amount"
                    : "Does not look like a payment"}
              </p>
              <p className="text-[11px] leading-relaxed text-black/70">
                {check.reason}
                {check.extractedAmountCents != null
                  ? ` Read ${formatBnd(check.extractedAmountCents)} from the image.`
                  : ""}
              </p>
              <p className="text-[10px] text-muted">
                AI confidence {Math.round(check.confidence * 100)}%. This is a
                hint, not proof.
              </p>
            </div>
          )}

          {checkError && (
            <p className="mt-2 text-[11px] leading-relaxed text-black/70">
              {checkError}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-none bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
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
            {loading === "confirm"
              ? "Confirming…"
              : "Mark as paid (manual)"}
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

      {isCreditor && (
        <p className="mt-2 text-[11px] leading-relaxed text-black/60">
          A blurry or unusual screenshot should never block you — check your
          bank, then use the manual button above.
        </p>
      )}

      {isDebtor && (
        <p className="mt-3 text-[11px] leading-relaxed text-black/60">
          Your ledger updates once {settlement.toName.split(" ")[0]} confirms.
          Keep your screenshot until then.
        </p>
      )}
    </div>
  );
}
