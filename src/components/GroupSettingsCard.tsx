"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { sendJson } from "@/lib/client";

/** The multi-side confirmation switch. Only the owner can change it. */
export function GroupSettingsCard({
  groupId,
  requireConfirmation,
  isOwner,
}: {
  groupId: string;
  requireConfirmation: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(requireConfirmation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const next = !on;
    setBusy(true);
    setError("");
    try {
      await sendJson(`/api/groups/${groupId}`, { requireConfirmation: next }, "PATCH");
      setOn(next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="section-title flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-teal-700" /> Confirmation
      </h2>
      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Everyone confirms new expenses</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {on
              ? "An expense counts only after the payer and everyone in the split say yes. Nobody can load a bill onto someone else's balance alone."
              : "Off: any member can add an expense and it hits everyone's balance straight away."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Require confirmation"
          disabled={!isOwner || busy}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            on ? "bg-teal-700" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
              on ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {!isOwner && (
        <p className="mt-2 text-[11px] text-muted">Only the group owner can change this.</p>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-coral">{error}</p>}
    </section>
  );
}
