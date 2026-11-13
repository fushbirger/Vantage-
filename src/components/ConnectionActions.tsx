"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus, X } from "lucide-react";
import { sendJson } from "@/lib/client";

/** Send a connection request by username. */
export function AddConnectionForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await sendJson<{ accepted: boolean }>("/api/connections", {
        username,
      });
      setMessage({
        ok: true,
        text: data.accepted
          ? "They had already asked you, so you are now connected."
          : "Request sent. They need to accept before you can share groups.",
      });
      setUsername("");
      router.refresh();
    } catch (caught) {
      setMessage({
        ok: false,
        text: caught instanceof Error ? caught.message : "Could not send.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field-label" htmlFor="connect-username">
        Add by username
      </label>
      <div className="flex gap-2">
        <input
          id="connect-username"
          className="field"
          placeholder="@username"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <button type="submit" disabled={busy || !username.trim()} className="btn shrink-0">
          <UserPlus className="h-4 w-4" />
          {busy ? "Sending…" : "Connect"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 text-xs font-semibold ${message.ok ? "text-teal-700" : "text-coral"}`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

/** Accept/decline an incoming request, cancel one I sent, or disconnect. */
export function ConnectionButtons({
  connectionId,
  kind,
}: {
  connectionId: string;
  kind: "incoming" | "outgoing" | "connected";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const answer = (action: "accept" | "decline") =>
    run(() => sendJson(`/api/connections/${connectionId}`, { action }, "PATCH"));
  const remove = () =>
    run(() => sendJson(`/api/connections/${connectionId}`, undefined, "DELETE"));

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {kind === "incoming" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer("accept")}
              className="btn min-h-[36px] px-3 py-1.5 text-xs"
            >
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer("decline")}
              className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
            >
              <X className="h-3.5 w-3.5" /> Decline
            </button>
          </>
        )}
        {kind === "outgoing" && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
        )}
        {kind === "connected" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("Disconnect? Existing groups are not affected.")) remove();
            }}
            className="btn-ghost text-xs"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-[11px] font-semibold text-coral">{error}</p>}
    </div>
  );
}
