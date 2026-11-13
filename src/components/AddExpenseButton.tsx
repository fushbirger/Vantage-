"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import {
  CURRENCIES,
  CURRENCY_CODES,
  convertToBndCents,
  formatBnd,
  parseAmountToCents,
} from "@/lib/currency";
import { imageFileToDataUrl } from "@/lib/files";
import { computeSplits, SplitError } from "@/lib/split";
import { CATEGORY_META } from "@/lib/display";
import { CATEGORIES } from "@/lib/validation";
import { dateInputToMs, todayInputValue } from "@/lib/dates";
import type { CurrencyCode, SplitRule } from "@/lib/types";

interface MemberOption {
  userId: string;
  name: string;
  username: string;
  avatarColor: string;
}

interface ItemRow {
  id: string;
  name: string;
  amount: string;
}

const RULES: Array<{
  value: SplitRule;
  label: string;
  hint: string;
}> = [
  { value: "equal", label: "Equally", hint: "Same amount per person" },
  { value: "exact", label: "Exact", hint: "Type each person’s share" },
  { value: "percent", label: "Percent", hint: "Shares that total 100%" },
  { value: "shares", label: "Shares", hint: "Weighted, e.g. 2 : 1 : 1" },
];

export function AddExpenseButton({
  groupId,
  members,
  currentUserId,
  requireConfirmation = false,
}: {
  groupId: string;
  members: MemberOption[];
  currentUserId: string;
  /** When true, the other people involved must confirm before it counts. */
  requireConfirmation?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("BND");
  const [fxRate, setFxRate] = useState("1");
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [category, setCategory] = useState("general");
  const [spentDate, setSpentDate] = useState(todayInputValue());
  const [rule, setRule] = useState<SplitRule>("equal");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(members.map((member) => member.userId)),
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(members.map((member) => [member.userId, "1"])),
  );
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptKb, setReceiptKb] = useState("");
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [showItems, setShowItems] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const participants = useMemo(
    () =>
      members
        .filter((member) => selected.has(member.userId))
        .map((member) => ({
          userId: member.userId,
          value:
            rule === "exact"
              ? parseAmountToCents(values[member.userId] ?? "")
              : rule === "percent" || rule === "shares"
                ? Number(values[member.userId] ?? 0)
                : undefined,
        })),
    [members, selected, rule, values],
  );

  const amountCents = parseAmountToCents(amount);
  const rate = Number(fxRate) || 0;
  const amountBndCents = convertToBndCents(amountCents, rate);

  const preview = useMemo(() => {
    try {
      if (!amountCents || !amountBndCents || !participants.length) return null;
      const splits = computeSplits({
        rule,
        amountBndCents,
        amountCents,
        fxRateToBnd: rate,
        participants,
      });
      return {
        map: new Map(splits.map((split) => [split.userId, split.amountBndCents])),
        total: splits.reduce((sum, split) => sum + split.amountBndCents, 0),
      };
    } catch (caught) {
      return caught instanceof SplitError ? null : null;
    }
  }, [rule, amountCents, amountBndCents, rate, participants]);

  function toggleMember(userId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function distributeEvenly() {
    const chosen = members.filter((member) => selected.has(member.userId));
    if (!chosen.length) return;
    if (rule === "shares") {
      setValues((previous) => {
        const next = { ...previous };
        chosen.forEach((member) => (next[member.userId] = "1"));
        return next;
      });
      return;
    }
    if (rule === "percent") {
      const base = Math.floor((10000 / chosen.length) / 100) / 100;
      const next: Record<string, string> = { ...values };
      chosen.forEach((member, index) => {
        const value =
          index === chosen.length - 1
            ? (100 - base * (chosen.length - 1)).toFixed(2)
            : base.toFixed(2);
        next[member.userId] = value;
      });
      setValues(next);
      return;
    }
    if (rule === "exact") {
      const total = parseAmountToCents(amount);
      const base = Math.floor(total / chosen.length);
      const next: Record<string, string> = { ...values };
      chosen.forEach((member, index) => {
        const cents =
          index === chosen.length - 1
            ? total - base * (chosen.length - 1)
            : base;
        next[member.userId] = (cents / 100).toFixed(2);
      });
      setValues(next);
    }
  }

  async function uploadReceipt(file: File) {
    setUploading(true);
    setError("");
    try {
      const data = await imageFileToDataUrl(file);
      setReceipt(data);
      const base64 = data.split(",")[1] ?? "";
      setReceiptKb(`${Math.max(1, Math.round((base64.length * 3) / 4 / 1024))} KB`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read image.");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setTitle("");
    setAmount("");
    setCurrency("BND");
    setFxRate("1");
    setPaidBy(currentUserId);
    setCategory("general");
    setSpentDate(todayInputValue());
    setRule("equal");
    setSelected(new Set(members.map((member) => member.userId)));
    setValues(Object.fromEntries(members.map((member) => [member.userId, "1"])));
    setNotes("");
    setReceipt(null);
    setReceiptKb("");
    setItems([]);
    setShowItems(false);
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!title.trim()) return setError("Give the expense a name.");
    if (!amountCents) return setError("Enter an amount above zero.");
    if (!rate || rate <= 0) return setError("Enter a valid FX rate.");
    if (!participants.length) return setError("Choose at least one participant.");
    if (rule !== "equal") {
      try {
        computeSplits({
          rule,
          amountBndCents,
          amountCents,
          fxRateToBnd: rate,
          participants,
        });
      } catch (caught) {
        return setError(
          caught instanceof Error ? caught.message : "Check the split.",
        );
      }
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amount,
          currency,
          fxRate: rate,
          paidBy,
          category,
          splitRule: rule,
          spentAt: dateInputToMs(spentDate),
          notes,
          receiptData: receipt,
          items: items
            .filter((item) => item.name.trim() && parseAmountToCents(item.amount))
            .map((item) => ({
              name: item.name.trim(),
              amountCents: parseAmountToCents(item.amount),
            })),
          participants,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add expense.");
      setOpen(false);
      reset();
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add expense.",
      );
      setSaving(false);
    }
  }

  // Mirrors the server rule: payer + everyone in the split, except me.
  const confirmerNames = requireConfirmation
    ? members
        .filter(
          (member) =>
            member.userId !== currentUserId &&
            (selected.has(member.userId) || member.userId === paidBy),
        )
        .map((member) => member.name)
    : [];

  const itemsTotal = items.reduce(
    (sum, item) => sum + parseAmountToCents(item.amount),
    0,
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn">
        <Plus className="h-4 w-4" />
        Add expense
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add an expense"
        subtitle="The ledger keeps the original currency and converts to BND."
        icon={<Receipt className="h-5 w-5" />}
      >
        <form onSubmit={submit} className="space-y-5">
          {error && (
            <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
              {error}
            </p>
          )}

          <div>
            <label className="field-label" htmlFor="exp-title">
              What was it?
            </label>
            <input
              id="exp-title"
              className="field"
              placeholder="e.g. Seafood dinner at Miri Waterfront"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_0.8fr_0.8fr]">
            <div>
              <label className="field-label" htmlFor="exp-amount">
                Amount
              </label>
              <input
                id="exp-amount"
                className="field tabular-nums"
                placeholder="0.00"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="exp-currency">
                Currency
              </label>
              <select
                id="exp-currency"
                className="field"
                value={currency}
                onChange={(event) => {
                  const next = event.target.value as CurrencyCode;
                  setCurrency(next);
                  setFxRate(String(CURRENCIES[next].defaultRateToBnd));
                }}
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="field-label" htmlFor="exp-date">
                Date
              </label>
              <input
                id="exp-date"
                type="date"
                className="field"
                value={spentDate}
                onChange={(event) => setSpentDate(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white/60 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  FX to BND
                </p>
                <p className="mt-0.5 text-sm font-semibold">
                  1 {currency} = {rate || "—"} BND
                </p>
              </div>
              <input
                aria-label="FX rate to BND"
                className="field w-24 py-2 text-right tabular-nums"
                inputMode="decimal"
                value={fxRate}
                onChange={(event) => setFxRate(event.target.value)}
                disabled={currency === "BND"}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {CURRENCIES[currency].note}. Ledger total:{" "}
              <strong className="text-ink">{formatBnd(amountBndCents)}</strong>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="exp-payer">
                Paid by
              </label>
              <select
                id="exp-payer"
                className="field"
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
              >
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                    {member.userId === currentUserId ? " (you)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="exp-category">
                Category
              </label>
              <select
                id="exp-category"
                className="field"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((code: string) => (
                  <option key={code} value={code}>
                    {CATEGORY_META[code].emoji} {CATEGORY_META[code].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="field-label mb-0">Split rule</span>
              {rule !== "equal" && (
                <button
                  type="button"
                  onClick={distributeEvenly}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900"
                >
                  Fill evenly
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-2xl border border-line bg-paper p-1">
              {RULES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRule(option.value)}
                  className={`rounded-xl px-1 py-2 text-xs font-bold transition ${
                    rule === option.value
                      ? "bg-white text-teal-800 shadow-soft"
                      : "text-muted hover:text-ink"
                  }`}
                  aria-pressed={rule === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {RULES.find((option) => option.value === rule)?.hint}
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="field-label mb-0">Who is included?</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                <UsersRound className="h-3.5 w-3.5" /> {participants.length}
              </span>
            </div>
            <div className="space-y-2">
              {members.map((member) => {
                const isSelected = selected.has(member.userId);
                return (
                  <div
                    key={member.userId}
                    className={`rounded-2xl border p-2.5 transition ${
                      isSelected
                        ? "border-teal-600/30 bg-teal-50/40"
                        : "border-line bg-white/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleMember(member.userId)}
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[10px] font-bold transition ${
                          isSelected
                            ? "border-teal-700 bg-teal-700 text-white"
                            : "border-line bg-white text-transparent"
                        }`}
                        aria-pressed={isSelected}
                        aria-label={`Include ${member.name}`}
                      >
                        ✓
                      </button>
                      <Avatar
                        name={member.name}
                        color={member.avatarColor}
                        size="xs"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {member.name}
                        {member.userId === currentUserId && (
                          <span className="ml-1 text-xs font-normal text-muted">
                            you
                          </span>
                        )}
                      </span>
                      {isSelected && rule !== "equal" && (
                        <div className="flex items-center gap-1">
                          <input
                            aria-label={`${member.name} split value`}
                            className="field w-20 py-1.5 text-right text-sm tabular-nums"
                            inputMode="decimal"
                            value={values[member.userId] ?? ""}
                            placeholder={
                              rule === "percent"
                                ? "0"
                                : rule === "shares"
                                  ? "1"
                                  : "0.00"
                            }
                            onChange={(event) =>
                              setValues((previous) => ({
                                ...previous,
                                [member.userId]: event.target.value,
                              }))
                            }
                          />
                          <span className="w-7 text-[11px] font-bold text-muted">
                            {rule === "percent" ? "%" : rule === "shares" ? "sh" : currency}
                          </span>
                        </div>
                      )}
                      {isSelected && preview && (
                        <span className="w-20 text-right text-xs font-bold tabular-nums text-teal-800">
                          {formatBnd(preview.map.get(member.userId) ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {rule !== "equal" && !preview && (
              <p className="mt-2 text-xs font-semibold text-coral">
                Check the split values — they don’t balance yet.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white/50">
            <button
              type="button"
              onClick={() => setShowItems((value) => !value)}
              className="flex w-full items-center justify-between px-3.5 py-3 text-sm font-bold"
            >
              <span className="inline-flex items-center gap-2">
                <Receipt className="h-4 w-4 text-teal-700" />
                Itemise the receipt
                {items.length > 0 && (
                  <span className="chip chip-active">{items.length}</span>
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted transition ${showItems ? "rotate-180" : ""}`}
              />
            </button>
            {showItems && (
              <div className="space-y-2 border-t border-line/80 p-3.5">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2">
                    <input
                      className="field flex-1 py-2 text-sm"
                      placeholder="Item name"
                      value={item.name}
                      onChange={(event) =>
                        setItems((previous) =>
                          previous.map((row) =>
                            row.id === item.id
                              ? { ...row, name: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <input
                      className="field w-24 py-2 text-right text-sm tabular-nums"
                      placeholder="0.00"
                      inputMode="decimal"
                      value={item.amount}
                      onChange={(event) =>
                        setItems((previous) =>
                          previous.map((row) =>
                            row.id === item.id
                              ? { ...row, amount: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setItems((previous) =>
                          previous.filter((row) => row.id !== item.id),
                        )
                      }
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-coral/10 hover:text-coral"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setItems((previous) => [
                        ...previous,
                        {
                          id: Math.random().toString(36).slice(2),
                          name: "",
                          amount: "",
                        },
                      ])
                    }
                    className="btn-ghost text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </button>
                  {items.length > 0 && (
                    <span
                      className={`text-xs font-semibold ${
                        itemsTotal === amountCents
                          ? "text-teal-700"
                          : "text-muted"
                      }`}
                    >
                      Items: {formatBnd(convertToBndCents(itemsTotal, rate))}
                      {itemsTotal !== amountCents ? " (optional)" : " ✓"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  Itemisation is stored for reference; the split rule above
                  decides who owes what.
                </p>
              </div>
            )}
          </div>

          <div>
            <span className="field-label">Receipt photo</span>
            {receipt ? (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-white/60 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receipt}
                  alt="Receipt preview"
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Receipt attached</p>
                  <p className="text-xs text-muted">{receiptKb}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-paper"
                  aria-label="Remove receipt"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-white/40 px-4 py-4 text-sm font-semibold text-muted transition hover:border-teal-400 hover:text-teal-800">
                <Camera className="h-4 w-4" />
                {uploading ? "Processing…" : "Take or upload a receipt"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadReceipt(file);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor="exp-notes">
              Note <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="exp-notes"
              className="field min-h-[70px] resize-y"
              placeholder="Anything the group should know"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
            />
          </div>

          <div className="rounded-2xl bg-teal-50/70 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
              <Sparkles className="h-3.5 w-3.5" />
              {preview
                ? `${formatBnd(preview.total)} split across ${participants.length} ${participants.length === 1 ? "person" : "people"}`
                : "Choose people and enter an amount to preview"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-teal-900/70">
              Vantage records this as a ledger entry. No card is charged and no
              money moves through the app.
            </p>
          </div>

          {requireConfirmation && (
            <p className="rounded-2xl border border-amber-300/60 bg-amber-100/40 px-3.5 py-2.5 text-xs leading-relaxed text-ink/75">
              {confirmerNames.length > 0
                ? `Needs a yes from ${confirmerNames.join(", ")} before it counts toward anyone's balance.`
                : "Only you are involved, so this goes straight onto the ledger."}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn flex-1">
              {saving
                ? "Saving…"
                : confirmerNames.length > 0
                  ? "Send for confirmation"
                  : "Add expense"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
