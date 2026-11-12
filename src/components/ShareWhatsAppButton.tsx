"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { waLink } from "@/lib/wa";

export function ShareWhatsAppButton({
  text,
  label = "Share to WhatsApp",
  compact = false,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <a
        href={waLink(text)}
        target="_blank"
        rel="noreferrer"
        className={compact ? "btn-secondary" : "btn"}
      >
        <MessageCircle className="h-4 w-4" />
        {label}
      </a>
      <button
        type="button"
        onClick={copy}
        className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/70 text-muted transition hover:border-teal-400 hover:text-teal-800"
        aria-label={copied ? "Summary copied" : "Copy summary"}
        title="Copy summary"
      >
        {copied ? (
          <Check className="h-4 w-4 text-teal-700" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
