"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Clock3,
  Copy,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { formatBnd } from "@/lib/currency";
import { imageFileToDataUrl } from "@/lib/files";
import { RAIL_LABELS } from "@/lib/display";
import type { PaymentProfile } from "@/lib/types";

interface DebtPerson {
  userId: string;
  name: string;
  username: string;
  avatarColor: string;
  phone: string | null;
}

export interface DebtView {
  from: string;
  to: string;
  amountCents: number;
  fromName: string;
  fromColor: string;
  toName: string;
  toColor: string;
}

const RAILS: Array<"tarus" | "tarusqr" | "pocket" | "cash" | "other"> = [
  "tarus",
  "tarusqr",
  "pocket",
  "cash",
  "other",
];

export function SettleDebtCard({
  groupId,
  groupName,
  debt,
  currentUserId,
  creditor,
  debtor,
  creditorProfile,
  reminderHref,
  pendingClaim,
}: {
  groupId: string;
  groupName: string;
  debt: DebtView;
  currentUserId: string;
  creditor: DebtPerson;
  debtor: DebtPerson;
  creditorProfile: PaymentProfile | null;
  reminderHref: string;
  pendingClaim: boolean;
}) {
  const router = useRouter();
  const isDebtor = debt.from === currentUserId;
  const isCreditor = debt.to === currentUserId;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pay" | "received" | null>(null);
  const [rail, setRail] = useState<"tarus" | "tarusqr" | "pocket" | "cash" | "other">(
    creditorProfile?.preferredRail ?? "tarus",
  );
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const profileValue =
    rail === "pocket"
      ? creditorProfile?.pocketLink
      : creditorProfile?.tarusProxy;
  const copyText = [
    `Settle ${formatBnd(debt.amountCents)} to ${creditor.name} for ${groupName}.`,
    creditorProfile?.tarusProxy ? `tarus proxy: ${creditorProfile.tarusProxy}` : "",
    creditorProfile?.pocketLink ? `Pocket: ${creditorProfile.pocketLink}` : "",
    "Sent from Vantage (non-custodial ledger).",
  ]
    .filter(Boolean)
    .join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      setProof(await imageFileToDataUrl(file, 1000, 0.65));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not read that image.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!mode) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUser: mode === "pay" ? currentUserId : debt.from,
          toUser: mode === "pay" ? debt.to : currentUserId,
          amountCents: debt.amountCents,
          rail,
          note,
          proofData: proof,
          confirmNow: mode === "received",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not record payment.");
      setOpen(false);
      setMode(null);
      setNote("");
      setProof(null);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not record payment.",
      );
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${
          isDebtor || isCreditor ? "border-teal-600/20 bg-teal-50/20" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative flex shrink-0 -space-x-2">
            <Avatar name={debt.fromName} color={debt.fromColor} size="md" ring />
            <Avatar name={debt.toName} color={debt.toColor} size="md" ring />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {debt.fromName}
              <span className="mx-1.5 text-muted">→</span>
              {debt.toName}
            </p>
            <p className="text-xs text-muted">
              {isDebtor
                ? "You pay"
                : isCreditor
                  ? "You receive"
                  : "Simplified transfer"}
              {creditorProfile?.preferredRail
                ? ` · ${RAIL_LABELS[creditorProfile.preferredRail]}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-lg font-extrabold tabular-nums">
            {formatBnd(debt.amountCents)}
          </span>
          {isDebtor ? (
            pendingClaim ? (
              <span className="chip bg-amber-100 text-ink/75">
                <Clock3 className="h-3.5 w-3.5" /> Awaiting confirm
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setMode("pay");
                }}
                className="btn text-xs"
              >
                <Wallet className="h-3.5 w-3.5" /> Settle up
              </button>
            )
          ) : isCreditor ? (
            <div className="flex items-center gap-1.5">
              <a
                href={reminderHref}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-xs"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Remind
              </a>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setMode("received");
                }}
                className="btn text-xs"
              >
                <Check className="h-3.5 w-3.5" /> Received
              </button>
            </div>
          ) : (
            <span className="chip">
              {debt.fromName.split(" ")[0]} pays {debt.toName.split(" ")[0]}
            </span>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setMode(null);
          setError("");
        }}
        title={mode === "received" ? "Record a received payment" : "Settle up"}
        subtitle={
          mode === "received"
            ? `Only mark this received after you can see the money in ${RAIL_LABELS[rail].toLowerCase()}.`
            : `${debt.fromName} → ${debt.toName} · ${groupName}`
        }
        icon={<Smartphone className="h-5 w-5" />}
      >
        <div className="space-y-5">
          <div className="rounded-3xl bg-teal-800 p-5 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
              {mode === "received" ? "Amount to receive" : "Amount to pay"}
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums">
              {formatBnd(debt.amountCents)}
            </p>
            <p className="mt-1 text-xs text-white/70">
              {mode === "received"
                ? `from ${debt.fromName}`
                : `to ${debt.toName} · ${creditor.phone ?? "phone not shared"}`}
            </p>
          </div>

          {mode === "pay" && (
            <div className="rounded-3xl border border-line bg-white/70 p-4">
              <div className="flex items-center gap-3">
                <Avatar
                  name={creditor.name}
                  color={creditor.avatarColor}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{creditor.name}</p>
                  <p className="text-xs text-muted">@{creditor.username}</p>
                  <p className="mt-0.5 text-xs font-semibold text-teal-800">
                    {creditorProfile
                      ? RAIL_LABELS[creditorProfile.preferredRail]
                      : "No payment rail saved"}
                  </p>
                </div>
                <QrCode className="h-5 w-5 text-teal-700" />
              </div>

              {creditorProfile?.tarusQrData && (
                <div className="mt-4 flex flex-col items-center rounded-2xl bg-paper p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={creditorProfile.tarusQrData}
                    alt={`${creditor.name}'s tarusQR`}
                    className="h-44 w-44 rounded-xl bg-white object-contain p-2"
                  />
                  <p className="mt-2 text-[11px] font-semibold text-muted">
                    Scan {creditor.name}’s tarusQR in your banking app, then come
                    back to mark it paid.
                  </p>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {creditorProfile?.tarusProxy && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">
                      tarus proxy
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {creditorProfile.tarusProxy}
                    </span>
                  </div>
                )}
                {creditorProfile?.pocketLink && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">
                      Pocket
                    </span>
                    <a
                      href={creditorProfile.pocketLink}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[55%] truncate text-sm font-bold text-teal-700 underline underline-offset-2"
                    >
                      {creditorProfile.pocketLink}
                    </a>
                  </div>
                )}
                {!creditorProfile?.tarusProxy &&
                  !creditorProfile?.pocketLink &&
                  !creditorProfile?.tarusQrData && (
                    <p className="rounded-2xl bg-amber-100/70 px-3 py-2.5 text-xs leading-relaxed text-ink/75">
                      {creditor.name} has not saved a tarus proxy, tarusQR or
                      Pocket link yet. Ask them to add one in Account, or settle
                      in cash.
                    </p>
                  )}
              </div>

              <button
                type="button"
                onClick={copy}
                className="btn-secondary mt-3 w-full text-xs"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-teal-700" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied amount & payment details" : "Copy amount & payment details"}
              </button>
            </div>
          )}

          {mode === "received" && (
            <div className="rounded-3xl border border-line bg-white/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Reminder to send
              </p>
              <a
                href={reminderHref}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary mt-2 w-full text-xs"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp {debt.fromName}
              </a>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {error && (
              <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
                {error}
              </p>
            )}

            <div>
              <label className="field-label" htmlFor="settle-rail">
                Payment method
              </label>
              <select
                id="settle-rail"
                className="field"
                value={rail}
                onChange={(event) =>
                  setRail(
                    event.target.value as
                      | "tarus"
                      | "tarusqr"
                      | "pocket"
                      | "cash"
                      | "other",
                  )
                }
              >
                {RAILS.map((code) => (
                  <option key={code} value={code}>
                    {RAIL_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="settle-note">
                Note <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="settle-note"
                className="field"
                placeholder="e.g. Ref 8831, paid via BIBD app"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div>
              <span className="field-label">
                Payment screenshot <span className="normal-case tracking-normal">(optional)</span>
              </span>
              {proof ? (
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-white/60 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proof}
                    alt="Payment proof preview"
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                  <span className="flex-1 text-sm font-bold">
                    Screenshot attached
                  </span>
                  <button
                    type="button"
                    onClick={() => setProof(null)}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-paper"
                    aria-label="Remove screenshot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-white/40 px-4 py-4 text-sm font-semibold text-muted transition hover:border-teal-400 hover:text-teal-800">
                  <Camera className="h-4 w-4" />
                  {uploading ? "Processing…" : "Attach payment screenshot"}
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

            <div className="rounded-2xl bg-amber-100/60 px-3.5 py-3 text-[11px] leading-relaxed text-ink/75">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              This is a claim, not a transfer. Vantage does not touch the money.
              {mode === "pay"
                ? ` ${creditor.name.split(" ")[0]} gets a WhatsApp alert and confirms the ledger entry.`
                : " You are confirming the money arrived outside Vantage."}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setMode(null);
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn flex-1">
                {saving
                  ? "Saving…"
                  : mode === "received"
                    ? "Mark received"
                    : "I’ve paid — mark it"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
