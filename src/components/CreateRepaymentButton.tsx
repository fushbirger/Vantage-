"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { parseAmountToCents } from "@/lib/currency";

interface MemberOption {
  userId: string;
  name: string;
  avatarColor: string;
}

export function CreateRepaymentButton({
  groupId,
  members,
}: {
  groupId: string;
  members: MemberOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<"open" | "equal">("open");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(members.map((member) => member.userId)),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(userId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const targetCents = parseAmountToCents(target);
    if (!title.trim()) return setError("Give the repayment a name.");
    if (!targetCents) return setError("Set a target above zero.");
    if (mode === "equal" && selected.size === 0) {
      return setError("Choose who shares this repayment.");
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/repayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          target,
          note,
          mode,
          participantIds: Array.from(selected),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not create repayment.");
      }
      setOpen(false);
      setTitle("");
      setTarget("");
      setMode("open");
      setSelected(new Set(members.map((member) => member.userId)));
      setNote("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create repayment.",
      );
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
        <HandCoins className="h-3.5 w-3.5" /> New repayment
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start a repayment"
        subtitle="Collect toward one target. Contributions stop automatically at the cap."
        icon={<HandCoins className="h-5 w-5" />}
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
              {error}
            </p>
          )}

          <div>
            <label className="field-label" htmlFor="repayment-title">
              What is being repaid?
            </label>
            <input
              id="repayment-title"
              className="field"
              placeholder="e.g. Aiman's share of the hotel"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="repayment-target">
              Total to repay (BND)
            </label>
            <input
              id="repayment-target"
              className="field text-xl font-bold tabular-nums"
              inputMode="decimal"
              placeholder="120.00"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              required
            />
          </div>

          <div>
            <span className="field-label">How can people chip in?</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("open")}
                className={`rounded-2xl border p-3 text-left transition ${
                  mode === "open"
                    ? "border-teal-600/40 bg-teal-50"
                    : "border-line bg-white/60"
                }`}
                aria-pressed={mode === "open"}
              >
                <span className="block text-sm font-bold">Open contribution</span>
                <span className="block text-[11px] text-muted">
                  Anyone can give any amount
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("equal")}
                className={`rounded-2xl border p-3 text-left transition ${
                  mode === "equal"
                    ? "border-teal-600/40 bg-teal-50"
                    : "border-line bg-white/60"
                }`}
                aria-pressed={mode === "equal"}
              >
                <span className="block text-sm font-bold">Equal split</span>
                <span className="block text-[11px] text-muted">
                  Only the chosen members
                </span>
              </button>
            </div>
          </div>

          {mode === "equal" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="field-label mb-0">Who shares it?</span>
                <span className="text-xs font-semibold text-muted">
                  {selected.size} selected
                </span>
              </div>
              <div className="space-y-1.5">
                {members.map((member) => {
                  const isSelected = selected.has(member.userId);
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => toggle(member.userId)}
                      className={`flex w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
                        isSelected
                          ? "border-teal-600/30 bg-teal-50/40"
                          : "border-line bg-white/50"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-md border text-[10px] font-bold ${
                          isSelected
                            ? "border-teal-700 bg-teal-700 text-white"
                            : "border-line bg-white text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <Avatar
                        name={member.name}
                        color={member.avatarColor}
                        size="xs"
                      />
                      <span className="text-sm font-semibold">{member.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Suggested share per person:{" "}
                {selected.size
                  ? `BND ${(parseAmountToCents(target) / 100 / selected.size).toFixed(2)}`
                  : "—"}
              </p>
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="repayment-note">
              Note <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="repayment-note"
              className="field min-h-[70px]"
              placeholder="What is the money for?"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="rounded-2xl bg-amber-100/70 px-3.5 py-3 text-[11px] leading-relaxed text-ink/75">
            This is a tracker, not a payment processor. Contributions are handed
            over directly to the person collecting the money.
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
              {saving ? "Creating…" : "Create repayment"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
