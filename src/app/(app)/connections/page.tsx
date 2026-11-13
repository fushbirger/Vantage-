import { redirect } from "next/navigation";
import { Link2, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AddConnectionForm, ConnectionButtons } from "@/components/ConnectionActions";
import { getConnectionOverview } from "@/lib/collab";
import { relativeTime } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";
import type { ConnectionEntry } from "@/lib/types";

export const metadata = { title: "People" };

function PersonRow({
  entry,
  kind,
  note,
}: {
  entry: ConnectionEntry;
  kind: "incoming" | "outgoing" | "connected";
  note: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar name={entry.user.name} color={entry.user.avatarColor} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{entry.user.name}</p>
        <p className="truncate text-[11px] text-muted">
          @{entry.user.username} · {note}
        </p>
      </div>
      <ConnectionButtons connectionId={entry.id} kind={kind} />
    </div>
  );
}

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const overview = getConnectionOverview(user.id);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-700">
          Your circle
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          People
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Connect with the people you split costs with. Only connected accounts
          can be invited to your groups, and nobody joins a group without
          accepting.
        </p>
      </header>

      <section className="card p-5">
        <AddConnectionForm />
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
          Connecting shares nothing. It only lets you invite each other to groups.
        </p>
      </section>

      {overview.incoming.length > 0 && (
        <section className="card border-amber-300/60 bg-amber-100/30 p-5">
          <h2 className="section-title">Requests for you</h2>
          <div className="divide-soft mt-1">
            {overview.incoming.map((entry) => (
              <PersonRow
                key={entry.id}
                entry={entry}
                kind="incoming"
                note={`asked ${relativeTime(entry.createdAt)}`}
              />
            ))}
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="section-title flex items-center gap-2">
          <Link2 className="h-4 w-4 text-teal-700" /> Connected
          <span className="text-xs font-semibold text-muted">
            {overview.connected.length}
          </span>
        </h2>
        {overview.connected.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No connections yet. Add a friend by username to start a shared group.
          </p>
        ) : (
          <div className="divide-soft mt-1">
            {overview.connected.map((entry) => (
              <PersonRow key={entry.id} entry={entry} kind="connected" note="connected" />
            ))}
          </div>
        )}
      </section>

      {overview.outgoing.length > 0 && (
        <section className="card p-5">
          <h2 className="section-title">Waiting for them</h2>
          <div className="divide-soft mt-1">
            {overview.outgoing.map((entry) => (
              <PersonRow
                key={entry.id}
                entry={entry}
                kind="outgoing"
                note={`sent ${relativeTime(entry.createdAt)}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
