"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";

export function RecurringBillToggle({
  billId,
  active,
  canManage,
}: {
  billId: string;
  active: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/recurring-bills/${billId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: active ? "pause" : "resume" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update the schedule.");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update the schedule.",
      );
      setSaving(false);
    }
  }

  if (!canManage) return null;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="btn-ghost text-[11px]"
      >
        {active ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        {saving ? "Saving…" : active ? "Pause" : "Resume"}
      </button>
      {error && <p className="mt-1 text-[10px] text-coral">{error}</p>}
    </div>
  );
}
