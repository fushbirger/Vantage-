"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { Modal } from "@/components/Modal";
import { formatBnd, parseAmountToCents } from "@/lib/currency";

export function PledgeButton({
  poolId,
  poolTitle,
  remainingCents,
  fulfilled,
  myContributedCents,
}: {
  poolId: string;
  poolTitle: string;
  remainingCents: number;
  fulfilled: boolean;
  myContributedCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"pledged" | "received">("pledged");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const cents = parseAmountToCents(amount);
    if (!cents) return setError("Enter a contribution above zero.");
    if (cents > remainingCents) {
      return setError(`Only ${formatBnd(remainingCents)} remains in this pool.`);
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/pools/${poolId}/pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, status, note }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not save contribution.");
      }
      setOpen(false);
      setAmount("");
      setNote("");
      setStatus("pledged");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save contribution.",
      );
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={fulfilled}
        className={myContributedCents > 0 ? "btn-secondary text-xs" : "btn text-xs"}
      >
        <HandCoins className="h-3.5 w-3.5" />
        {fulfilled
          ? "Pool fulfilled"
          : myContributedCents > 0
            ? "Add contribution"
            : "Contribute"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Contribute to this pool"
        subtitle={`${poolTitle} · ${formatBnd(remainingCents)} remaining`}
        icon={<HandCoins className="h-5 w-5" />}
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
              {error}
            </p>
          )}
          <div>
            <label className="field-label" htmlFor="pledge-amount">
              Your contribution (BND)
            </label>
            <input
              id="pledge-amount"
              className="field text-xl font-bold tabular-nums"
              inputMode="decimal"
              placeholder="25.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <p className="mt-1 text-[11px] text-muted">
              Anyone can contribute any amount. Contributions stop automatically
              once the pool reaches its cap.
            </p>
          </div>
          <div>
            <span className="field-label">Status</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus("pledged")}
                className={`rounded-2xl border p-3 text-left transition ${
                  status === "pledged"
                    ? "border-teal-600/40 bg-teal-50"
                    : "border-line bg-white/60"
                }`}
                aria-pressed={status === "pledged"}
              >
                <span className="block text-sm font-bold">I’ll contribute</span>
                <span className="block text-[11px] text-muted">
                  A soft pledge
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatus("received")}
                className={`rounded-2xl border p-3 text-left transition ${
                  status === "received"
                    ? "border-teal-600/40 bg-teal-50"
                    : "border-line bg-white/60"
                }`}
                aria-pressed={status === "received"}
              >
                <span className="block text-sm font-bold">Already handed over</span>
                <span className="block text-[11px] text-muted">
                  Paid offline to the organiser
                </span>
              </button>
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="pledge-note">
              Note <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="pledge-note"
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
              {saving ? "Saving…" : "Add contribution"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
