"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { sendJson } from "@/lib/client";

interface Person {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
}

/** Owner picks from accepted connections who are not in the group yet. */
export function InviteMembersButton({
  groupId,
  candidates,
}: {
  groupId: string;
  candidates: Person[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await sendJson(`/api/groups/${groupId}/invite`, {
        userIds: Array.from(selected),
      });
      setOpen(false);
      setSelected(new Set());
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs">
        <UserPlus className="h-3.5 w-3.5" /> Invite
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite people"
        subtitle="They join only after they accept. Nothing lands on their ledger before that."
        icon={<UserPlus className="h-5 w-5" />}
      >
        <div className="space-y-4">
          {error && (
            <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
              {error}
            </p>
          )}
          {candidates.length === 0 ? (
            <p className="rounded-2xl bg-paper p-4 text-sm text-muted">
              Everyone you are connected with is already here. Add more people on{" "}
              <Link href="/connections" className="font-bold text-teal-700 underline">
                the People page
              </Link>
              .
            </p>
          ) : (
            <div className="divide-soft rounded-2xl border border-line bg-card">
              {candidates.map((person) => {
                const on = selected.has(person.id);
                return (
                  <label
                    key={person.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(person.id)}
                      className="h-4 w-4 accent-teal-700"
                    />
                    <Avatar name={person.name} color={person.avatarColor} size="xs" />
                    <span className="flex-1 text-sm font-semibold">
                      {person.name}
                      <span className="ml-1 text-xs font-normal text-muted">
                        @{person.username}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={submit}
              className="btn flex-1"
            >
              {busy ? "Inviting…" : `Invite ${selected.size || ""}`.trim()}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Owner withdraws a pending invitation. */
export function CancelInviteButton({
  groupId,
  userId,
}: {
  groupId: string;
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await sendJson(`/api/groups/${groupId}/members`, { userId }, "DELETE");
          router.refresh();
        } catch {
          setBusy(false);
        }
      }}
      className="btn-ghost text-xs"
    >
      Withdraw
    </button>
  );
}
