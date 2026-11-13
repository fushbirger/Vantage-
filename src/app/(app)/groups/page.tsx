import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Layers,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wallet,
} from "lucide-react";
import { AvatarStack } from "@/components/Avatar";
import { CreateGroupButton } from "@/components/CreateGroupButton";
import { formatBnd, formatPosition } from "@/lib/currency";
import { relativeTime } from "@/lib/dates";
import { KIND_LABELS } from "@/lib/display";
import { getConnectedUsers, getGroupInvitesForUser } from "@/lib/collab";
import { InviteResponseButtons } from "@/components/InviteResponseButtons";
import { getGroupSummariesForUser } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Your groups" };

export default async function GroupsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const summaries = getGroupSummariesForUser(user.id);
  // Only accepted connections can be invited to a new group.
  const people = getConnectedUsers(user.id);
  const invites = getGroupInvitesForUser(user.id);
  const net = summaries.reduce((sum, group) => sum + group.myBalanceCents, 0);
  const total = summaries.reduce((sum, group) => sum + group.totalCents, 0);

  const hour = new Date().getHours();
  const greeting =
    hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat tengah hari" : "Selamat petang";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-700">
            {greeting}, {user.name.split(" ")[0]}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Your groups
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Every shared receipt, pledge and settle-up in one calm ledger.
          </p>
        </div>
        <CreateGroupButton
          users={people.map((person) => ({
            id: person.id,
            name: person.name,
            username: person.username,
            avatarColor: person.avatarColor,
          }))}
          currentUserId={user.id}
        />
      </header>

      {invites.length > 0 && (
        <section className="card border-amber-300/60 bg-amber-100/30 p-5">
          <h2 className="section-title">Group invitations</h2>
          <p className="mt-1 text-xs text-muted">
            You are not in these groups yet. Nothing is added to your ledger
            until you accept.
          </p>
          <div className="divide-soft mt-2">
            {invites.map((invite) => (
              <div key={invite.groupId} className="flex items-center gap-3 py-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-paper text-lg">
                  {invite.groupEmoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{invite.groupName}</p>
                  <p className="text-[11px] text-muted">
                    invited by {invite.invitedByName ?? "someone"} ·{" "}
                    {relativeTime(invite.invitedAt)}
                  </p>
                </div>
                <InviteResponseButtons groupId={invite.groupId} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <p className="stat-label">Groups</p>
          <p className="stat-value">{summaries.length}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Logged</p>
          <p className="stat-value">{formatBnd(total)}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Your net</p>
          <p
            className={`stat-value ${
              net > 0 ? "text-teal-700" : net < 0 ? "text-coral" : ""
            }`}
          >
            {formatPosition(net)}
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Held by Vantage</p>
          <p className="stat-value flex items-center gap-1.5 text-base sm:text-lg">
            <ShieldCheck className="h-4 w-4 text-teal-700" /> BND 0.00
          </p>
        </div>
      </section>

      {summaries.length === 0 ? (
        <section className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-teal-100 text-3xl">
            🧾
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold">
            No groups yet
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Start with the next road trip, mamak dinner or shared gift. Add
            friends, log the first receipt, and let Vantage work out the rest.
          </p>
          <div className="mt-6">
            <CreateGroupButton
              users={people.map((person) => ({
                id: person.id,
                name: person.name,
                username: person.username,
                avatarColor: person.avatarColor,
              }))}
              currentUserId={user.id}
              variant="large"
            />
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="section-title">Active ledgers</h2>
            <span className="text-xs font-semibold text-muted">
              {summaries.length} group{summaries.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {summaries.map((summary) => {
              const position = summary.myBalanceCents;
              return (
                <Link
                  key={summary.group.id}
                  href={`/groups/${summary.group.id}`}
                  className="card group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-teal-600/25 hover:shadow-lift"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-paper text-2xl">
                      {summary.group.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate font-display text-xl font-semibold tracking-tight">
                          {summary.group.name}
                        </h3>
                        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:text-teal-700" />
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-muted">
                        <span className="pill bg-teal-50 text-teal-800">
                          {KIND_LABELS[summary.group.kind]}
                        </span>
                        {summary.poolCount > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {summary.poolCount} pool
                            {summary.poolCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="stat-label">Total logged</p>
                      <p className="mt-0.5 text-base font-bold tabular-nums">
                        {formatBnd(summary.totalCents)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="stat-label">You</p>
                      <p
                        className={`mt-0.5 text-base font-extrabold tabular-nums ${
                          position > 0
                            ? "text-teal-700"
                            : position < 0
                              ? "text-coral"
                              : "text-muted"
                        }`}
                      >
                        {position === 0 ? "Square" : formatPosition(position)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line/80 pt-3">
                    <AvatarStack members={summary.members} />
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                      <UsersRound className="h-3.5 w-3.5" />
                      {summary.members.length}
                      <span className="mx-1 opacity-40">·</span>
                      {relativeTime(summary.lastActivityAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-3 sm:divide-x sm:divide-line">
          {[
            {
              icon: Wallet,
              title: "Log it once",
              text: "Snap the receipt, choose a split rule, done. Multi-currency auto-converts to BND.",
            },
            {
              icon: Sparkles,
              title: "Simplify the web",
              text: "A→B→C becomes A→C. Vantage finds the fewest transfers for the whole group.",
            },
            {
              icon: ShieldCheck,
              title: "Settle off-platform",
              text: "Pay by tarus or Pocket. Vantage only shows the QR, amount and marks it paid.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="p-5">
              <Icon className="h-5 w-5 text-teal-700" />
              <p className="mt-3 text-sm font-bold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
