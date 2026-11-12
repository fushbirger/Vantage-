"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { Modal } from "@/components/Modal";
import { parseAmountToCents } from "@/lib/currency";
import { todayInputValue } from "@/lib/dates";

export function CreatePoolButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const goalCents = parseAmountToCents(goal);
    if (!title.trim()) return setError("Give the pool a name.");
    if (!goalCents) return setError("Set a goal above zero.");
    setSaving(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/pools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          goal,
          note,
          deadline: deadline ? new Date(`${deadline}T23:59:00`).getTime() : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create pool.");
      setOpen(false);
      setTitle("");
      setGoal("");
      setDeadline("");
      setNote("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create pool.");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-xs"
      >
        <Target className="h-3.5 w-3.5" /> New pool
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start a money pool"
        subtitle="Track pledges toward a shared goal. Vantage never holds the cash."
        icon={<Target className="h-5 w-5" />}
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
              {error}
            </p>
          )}
          <div>
            <label className="field-label" htmlFor="pool-title">
              What are you pooling for?
            </label>
            <input
              id="pool-title"
              className="field"
              placeholder="e.g. Kak Siti's wedding gift"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="pool-goal">
                Goal (BND)
              </label>
              <input
                id="pool-goal"
                className="field tabular-nums"
                inputMode="decimal"
                placeholder="200.00"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="pool-deadline">
                Deadline
              </label>
              <input
                id="pool-deadline"
                type="date"
                className="field"
                min={todayInputValue()}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="pool-note">
              Note <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="pool-note"
              className="field min-h-[70px]"
              placeholder="How will the gift be bought? Who is collecting?"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="rounded-2xl bg-amber-100/70 px-3.5 py-3 text-[11px] leading-relaxed text-ink/75">
            A pool is a promise tracker. Contributions are handed over outside
            Vantage — usually via tarus or Pocket — and marked received here.
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
              {saving ? "Creating…" : "Create pool"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
