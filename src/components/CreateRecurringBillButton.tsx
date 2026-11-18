"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import {
  CURRENCIES,
  CURRENCY_CODES,
  parseAmountToCents,
} from "@/lib/currency";
import { CATEGORY_META } from "@/lib/display";
import { CATEGORIES } from "@/lib/validation";
import type { CurrencyCode } from "@/lib/types";

interface MemberOption {
  userId: string;
  name: string;
  avatarColor: string;
}

export function CreateRecurringBillButton({
  groupId,
  members,
  currentUserId,
}: {
  groupId: string;
  members: MemberOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("BND");
  const [fxRate, setFxRate] = useState("1");
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [category, setCategory] = useState("general");
  const [day, setDay] = useState("1");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(members.map((member) => member.userId)),
  );
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
    const amountCents = parseAmountToCents(amount);
    if (!title.trim()) return setError("Give the monthly bill a name.");
    if (!amountCents) return setError("Enter an amount above zero.");
    if (!selected.size) return setError("Choose at least one participant.");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/recurring-bills`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            amount,
            currency,
            fxRate,
            paidBy,
            category,
            splitRule: "equal",
            dayOfMonth: Number(day),
            participants: Array.from(selected).map((userId) => ({ userId })),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not create the schedule.");
      }
      setOpen(false);
      setTitle("");
      setAmount("");
      setCurrency("BND");
      setFxRate("1");
      setCategory("general");
      setDay("1");
      setSelected(new Set(members.map((member) => member.userId)));
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the schedule.",
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
        <CalendarClock className="h-3.5 w-3.5" /> Schedule monthly
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule a monthly bill"
        subtitle="Vantage posts it automatically when the database date arrives."
        icon={<CalendarClock className="h-5 w-5" />}
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
              {error}
            </p>
          )}

          <div>
            <label className="field-label" htmlFor="bill-title">
              Bill name
            </label>
            <input
              id="bill-title"
              className="field"
              placeholder="e.g. Apartment rent"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="bill-amount">
                Amount
              </label>
              <input
                id="bill-amount"
                className="field tabular-nums"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="bill-day">
                Day of month
              </label>
              <input
                id="bill-day"
                type="number"
                min={1}
                max={28}
                className="field tabular-nums"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="bill-currency">
                Currency
              </label>
              <select
                id="bill-currency"
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
            <div>
              <label className="field-label" htmlFor="bill-category">
                Category
              </label>
              <select
                id="bill-category"
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

          {currency !== "BND" && (
            <div>
              <label className="field-label" htmlFor="bill-fx">
                FX to BND
              </label>
              <input
                id="bill-fx"
                className="field tabular-nums"
                inputMode="decimal"
                value={fxRate}
                onChange={(event) => setFxRate(event.target.value)}
              />
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="bill-payer">
              Paid by
            </label>
            <select
              id="bill-payer"
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
            <div className="mb-2 flex items-center justify-between">
              <span className="field-label mb-0">Split equally between</span>
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
          </div>

          <div className="rounded-2xl bg-amber-100/70 px-3.5 py-3 text-[11px] leading-relaxed text-ink/75">
            The bill posts on day {Math.min(28, Math.max(1, Number(day) || 1))}{" "}
            each month (days 1–28 only). You can pause it from the group page.
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
              {saving ? "Scheduling…" : "Schedule bill"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
