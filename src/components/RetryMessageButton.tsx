"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RetryMessageButton({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            const response = await fetch(
              `/api/whatsapp/outbox/${messageId}/retry`,
              { method: "POST" },
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "Retry failed.");
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Retry failed.");
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="btn-ghost text-[11px]"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sending…" : "Retry"}
      </button>
      {error && <p className="text-[10px] text-coral">{error}</p>}
    </div>
  );
}
