"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { Modal } from "@/components/Modal";
import { parseAmountToCents } from "@/lib/currency";

export function PledgeButton({
  poolId,
  poolTitle,
  existingAmount,
  existingStatus,
}: {
  poolId: string;
  poolTitle: string;
  existingAmount: number | null;
  existingStatus: "pledged" | "received" | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    existingAmount ? (existingAmount / 100).toFixed(2) : "",
  );
  const [status, setStatus] = useState<"pledged" | "received">(
    existingStatus ?? "pledged",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const cents = parseAmountToCents(amount);
    if (!cents) return setError("Enter a pledge above zero.");
    setSaving(true);
    try {
      const response = await fetch(`/api/pools/${poolId}/pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, status, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save pledge.");
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save pledge.");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={existingAmount ? "btn-secondary text-xs" : "btn text-xs"}
      >
        <HandCoins className="h-3.5 w-3.5" />
        {existingAmount ? "Edit pledge" : "Pledge"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pledge to this pool"
        subtitle={poolTitle}
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
              {saving ? "Saving…" : "Save pledge"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
