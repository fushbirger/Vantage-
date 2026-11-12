"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UsersRound } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import type { Group } from "@/lib/types";

const EMOJIS = ["✈️", "🚗", "🍣", "🎁", "🏠", "🏖️", "🎉", "⛽"];
const KINDS: Array<{ value: Group["kind"]; label: string }> = [
  { value: "trip", label: "Trip" },
  { value: "dinner", label: "Dinner" },
  { value: "gift", label: "Gift" },
  { value: "home", label: "Household" },
  { value: "other", label: "Other" },
];

interface Person {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
}

export function CreateGroupButton({
  users,
  currentUserId,
  variant = "primary",
}: {
  users: Person[];
  currentUserId: string;
  variant?: "primary" | "secondary" | "large";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✈️");
  const [kind, setKind] = useState<Group["kind"]>("trip");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleMember(id: string) {
    setMemberIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          emoji,
          kind,
          description,
          memberIds: Array.from(memberIds),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create group.");
      setOpen(false);
      router.push(`/groups/${data.group.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create group.");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "btn"
            : variant === "large"
              ? "btn px-6 py-3 text-base"
              : "btn-secondary"
        }
      >
        <Plus className="h-4 w-4" />
        New group
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start a group"
        subtitle="A trip, a dinner, a shared gift — keep the ledger in one place."
        icon={<UsersRound className="h-5 w-5" />}
      >
        <form onSubmit={submit} className="space-y-5">
          {error && (
            <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
              {error}
            </p>
          )}

          <div>
            <label className="field-label" htmlFor="group-name">
              Group name
            </label>
            <input
              id="group-name"
              className="field"
              placeholder="e.g. Miri Road Trip"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </div>

          <div>
            <span className="field-label">Icon</span>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  className={`grid h-11 w-11 place-items-center rounded-2xl border text-xl transition ${
                    emoji === option
                      ? "border-teal-600 bg-teal-50 shadow-soft"
                      : "border-line bg-white hover:border-teal-300"
                  }`}
                  aria-label={`Use ${option}`}
                  aria-pressed={emoji === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="field-label">Type</span>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  className={`chip ${kind === option.value ? "chip-active" : ""}`}
                  aria-pressed={kind === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="group-description">
              Note <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="group-description"
              className="field"
              placeholder="What is this group for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={200}
            />
          </div>

          <div>
            <span className="field-label">
              Members <span className="normal-case tracking-normal">— you are included automatically</span>
            </span>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {users
                .filter((person) => person.id !== currentUserId)
                .map((person) => {
                  const selected = memberIds.has(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleMember(person.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                        selected
                          ? "border-teal-600/40 bg-teal-50/70"
                          : "border-line bg-white/60 hover:border-teal-300"
                      }`}
                      aria-pressed={selected}
                    >
                      <Avatar
                        name={person.name}
                        color={person.avatarColor}
                        size="sm"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-bold">
                          {person.name}
                        </span>
                        <span className="block text-xs text-muted">
                          @{person.username}
                        </span>
                      </span>
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold ${
                          selected
                            ? "border-teal-700 bg-teal-700 text-white"
                            : "border-line bg-white text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
            </div>
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
              {saving ? "Creating…" : "Create group"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
