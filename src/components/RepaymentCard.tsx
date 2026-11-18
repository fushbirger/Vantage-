"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, HandCoins, UsersRound } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { formatBnd, parseAmountToCents, pct } from "@/lib/currency";
import { relativeTime } from "@/lib/dates";
import type { RepaymentWithDetails } from "@/lib/types";

type Kind = "contribution" | "cash_handed";

export function RepaymentCard({
  repayment,
  currentUserId,
}: {
  repayment: RepaymentWithDetails;
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("contribution");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isCreator = repayment.createdBy === currentUserId;
  const isOpen = repayment.status === "open";
  const canContribute =
    isOpen &&
    (repayment.mode === "open" ||
      isCreator ||
      repayment.participantIds.includes(currentUserId));
  const progress = pct(repayment.collectedBndCents, repayment.targetBndCents);
  const equalShare =
    repayment.mode === "equal" && repayment.participantIds.length
      ? Math.round(
          repayment.targetBndCents / repayment.participantIds.length,
        )
      : null;

  function start(nextKind: Kind) {
    setKind(nextKind);
    setAmount("");
    setNote("");
    setError("");
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const cents = parseAmountToCents(amount);
    if (!cents) return setError("Enter an amount above zero.");
    if (cents > repayment.remainingBndCents) {
      return setError(
        `Only ${formatBnd(repayment.remainingBndCents)} remains. The repayment caps at its target.`,
      );
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/repayments/${repayment.id}/contributions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, kind, note }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not record the contribution.");
      }
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not record the contribution.",
      );
      setSaving(false);
    }
  }

  return (
    <>
      <div className="rounded-none border border-line bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{repayment.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
              <span>by {repayment.createdByName}</span>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1">
                <UsersRound className="h-3 w-3" />
                {repayment.mode === "equal"
                  ? `Equal split · ${repayment.participantIds.length} people`
                  : "Open to anyone"}
              </span>
            </p>
          </div>
          <span
            className={`pill ${
              isOpen
                ? "bg-neutral-100 text-black/75"
                : repayment.status === "fulfilled"
                  ? "bg-green-100 text-green-800"
                  : "bg-white text-muted"
            }`}
          >
            {repayment.status === "fulfilled" ? "Fulfilled" : repayment.status}
          </span>
        </div>

        <div className="mt-3 h-2.5 overflow-hidden rounded-none bg-neutral-200">
          <div
            className="h-full rounded-none bg-green-600"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
          <span className="tabular-nums text-green-800">
            {formatBnd(repayment.collectedBndCents)} collected
          </span>
          <span className="tabular-nums text-muted">
            of {formatBnd(repayment.targetBndCents)}
          </span>
        </div>

        {isOpen ? (
          <p className="mt-1 text-[11px] text-muted">
            {formatBnd(repayment.remainingBndCents)} left before the cap.
            {equalShare != null
              ? ` Suggested equal share: ${formatBnd(equalShare)}.`
              : ""}
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Target reached — no more
            contributions accepted.
          </p>
        )}

        {repayment.note && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {repayment.note}
          </p>
        )}

        {repayment.contributions.length > 0 && (
          <div className="mt-3 space-y-1">
            {repayment.contributions.slice(0, 5).map((contribution) => (
              <div
                key={contribution.id}
                className="flex items-center gap-2 rounded-none bg-white/60 px-2.5 py-1.5"
              >
                <Avatar
                  name={contribution.userName}
                  color={contribution.userColor}
                  size="xs"
                />
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {contribution.userId === currentUserId
                    ? "You"
                    : contribution.userName}
                  <span className="ml-1 font-normal text-muted">
                    {contribution.kind === "cash_handed"
                      ? "· cash handed back"
                      : "· contributed"}
                  </span>
                  <span className="ml-1 font-normal text-muted">
                    {relativeTime(contribution.createdAt)}
                  </span>
                </span>
                <span className="text-[11px] font-bold tabular-nums text-green-800">
                  {formatBnd(contribution.amountBndCents)}
                </span>
              </div>
            ))}
            {repayment.contributions.length > 5 && (
              <p className="px-1 text-[10px] text-muted">
                +{repayment.contributions.length - 5} more contributions
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canContribute && (
            <button
              type="button"
              onClick={() => start("contribution")}
              className="btn text-xs"
            >
              <HandCoins className="h-3.5 w-3.5" /> Contribute
            </button>
          )}
          {isCreator && isOpen && (
            <button
              type="button"
              onClick={() => start("cash_handed")}
              className="btn-secondary text-xs"
            >
              <Banknote className="h-3.5 w-3.5" /> Cash handed back
            </button>
          )}
          {!isCreator && repayment.mode === "equal" && !canContribute && (
            <span className="text-[11px] text-muted">
              Only the selected members can contribute.
            </span>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={kind === "cash_handed" ? "Cash handed back" : "Contribute"}
        subtitle={`${repayment.title} · ${formatBnd(repayment.remainingBndCents)} remaining`}
        icon={
          kind === "cash_handed" ? (
            <Banknote className="h-5 w-5" />
          ) : (
            <HandCoins className="h-5 w-5" />
          )
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="rounded-none border border-red-600/40 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          {kind === "cash_handed" && (
            <p className="rounded-none bg-neutral-100/70 px-3.5 py-3 text-[11px] leading-relaxed text-black/75">
              Record money you physically received. It counts toward the target
              and can never exceed the amount still needed.
            </p>
          )}

          <div>
            <label className="field-label" htmlFor="repayment-amount">
              Amount (BND)
            </label>
            <input
              id="repayment-amount"
              className="field text-xl font-bold tabular-nums"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <p className="mt-1 text-[11px] text-muted">
              Maximum {formatBnd(repayment.remainingBndCents)} — the cap is the
              total still needed.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="repayment-contribution-note">
              Note <span className="font-normal">(optional)</span>
            </label>
            <input
              id="repayment-contribution-note"
              className="field"
              placeholder="e.g. Paid via tarus, ref 8831"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn flex-1">
              {saving
                ? "Saving…"
                : kind === "cash_handed"
                  ? "Record cash"
                  : "Add contribution"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
