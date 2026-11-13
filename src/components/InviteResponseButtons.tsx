"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { sendJson } from "@/lib/client";

/** Accept or decline an invitation to a group. */
export function InviteResponseButtons({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function answer(action: "accept" | "decline") {
    setBusy(true);
    setError("");
    try {
      await sendJson(`/api/groups/${groupId}/members`, { action });
      if (action === "accept") router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer("accept")}
          className="btn min-h-[36px] px-3 py-1.5 text-xs"
        >
          <Check className="h-3.5 w-3.5" /> Join
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer("decline")}
          className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
        >
          <X className="h-3.5 w-3.5" /> Decline
        </button>
      </div>
      {error && <p className="text-[11px] font-semibold text-coral">{error}</p>}
    </div>
  );
}
