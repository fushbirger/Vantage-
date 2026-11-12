"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CreditCard,
  QrCode,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { imageFileToDataUrl } from "@/lib/files";
import type { PaymentProfile, PreferredRail } from "@/lib/types";

const RAILS: Array<{
  value: PreferredRail;
  label: string;
  description: string;
  icon: typeof Smartphone;
}> = [
  {
    value: "tarus",
    label: "tarus",
    description: "Phone number or proxy ID",
    icon: Smartphone,
  },
  {
    value: "tarusqr",
    label: "tarusQR",
    description: "Static or dynamic QR image",
    icon: QrCode,
  },
  {
    value: "pocket",
    label: "Pocket",
    description: "Merchant or user QR link",
    icon: CreditCard,
  },
];

export function PaymentProfileForm({
  profile,
}: {
  profile: PaymentProfile | null;
}) {
  const router = useRouter();
  const [rail, setRail] = useState<PreferredRail>(
    profile?.preferredRail ?? "tarus",
  );
  const [proxy, setProxy] = useState(profile?.tarusProxy ?? "");
  const [pocket, setPocket] = useState(profile?.pocketLink ?? "");
  const [qr, setQr] = useState<string | null>(profile?.tarusQrData ?? null);
  const [optIn, setOptIn] = useState(Boolean(profile?.whatsappOptIn ?? 1));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      setQr(await imageFileToDataUrl(file, 900, 0.8));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read image.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    if (pocket && !/^https?:\/\//i.test(pocket)) {
      setError("Pocket link must start with https://");
      setSaving(false);
      return;
    }
    try {
      const response = await fetch("/api/me/payment-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRail: rail,
          tarusProxy: proxy,
          tarusQrData: qr,
          pocketLink: pocket,
          whatsappOptIn: optIn,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save details.");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save details.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
          {error}
        </p>
      )}

      <div>
        <span className="field-label">Preferred rail</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {RAILS.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRail(value)}
              className={`rounded-2xl border p-3 text-left transition ${
                rail === value
                  ? "border-teal-600/40 bg-teal-50 shadow-soft"
                  : "border-line bg-white/60 hover:border-teal-300"
              }`}
              aria-pressed={rail === value}
            >
              <Icon
                className={`h-4 w-4 ${rail === value ? "text-teal-800" : "text-muted"}`}
              />
              <span className="mt-1.5 block text-sm font-bold">{label}</span>
              <span className="block text-[11px] text-muted">{description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="tarus-proxy">
          tarus proxy / phone
        </label>
        <input
          id="tarus-proxy"
          className="field"
          inputMode="tel"
          placeholder="+673 8xx xxxx or your proxy ID"
          value={proxy}
          onChange={(event) => setProxy(event.target.value)}
        />
        <p className="mt-1 text-[11px] text-muted">
          Used for the one-tap “copy amount & proxy” button when someone settles
          with you.
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="pocket-link">
          Pocket link
        </label>
        <input
          id="pocket-link"
          className="field"
          inputMode="url"
          placeholder="https://pocket.com.bn/…"
          value={pocket}
          onChange={(event) => setPocket(event.target.value)}
        />
      </div>

      <div>
        <span className="field-label">tarusQR image</span>
        {qr ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-white/60 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="tarusQR preview"
              className="h-20 w-20 rounded-xl bg-white object-contain p-1"
            />
            <div className="flex-1">
              <p className="text-sm font-bold">QR saved</p>
              <p className="text-xs text-muted">
                Shown on the settle-up screen for anyone paying you.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQr(null)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-paper"
              aria-label="Remove QR"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-white/40 px-4 py-4 text-sm font-semibold text-muted transition hover:border-teal-400 hover:text-teal-800">
            <Upload className="h-4 w-4" />
            {uploading ? "Processing…" : "Upload your tarusQR image"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <label className="flex items-start gap-2.5 rounded-2xl border border-line bg-paper/60 p-3.5">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(event) => setOptIn(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-teal-700"
        />
        <span>
          <span className="block text-sm font-bold">
            WhatsApp activity updates
          </span>
          <span className="block text-[11px] leading-relaxed text-muted">
            Expense added, payment marked, payment confirmed and reminders.
            Without Cloud API credentials these are stored as simulated
            messages in Activity.
          </span>
        </span>
      </label>

      <button type="submit" disabled={saving} className="btn w-full">
        {saved ? (
          <>
            <Check className="h-4 w-4" /> Payment details saved
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            {saving ? "Saving…" : "Save payment details"}
          </>
        )}
      </button>
    </form>
  );
}
