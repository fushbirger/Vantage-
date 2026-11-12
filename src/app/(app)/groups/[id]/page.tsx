import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Handshake,
  MessageCircle,
  Receipt,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarStack } from "@/components/Avatar";
import { AddExpenseButton } from "@/components/AddExpenseButton";
import { CreatePoolButton } from "@/components/CreatePoolButton";
import { PledgeButton } from "@/components/PledgeButton";
import { ShareWhatsAppButton } from "@/components/ShareWhatsAppButton";
import {
  formatBnd,
  formatOriginal,
  formatPosition,
  pct,
} from "@/lib/currency";
import { daysUntil, formatDate, formatShortDate, relativeTime } from "@/lib/dates";
import {
  categoryFor,
  KIND_LABELS,
  RAIL_LABELS,
  SPLIT_RULE_LABELS,
} from "@/lib/display";
import { getGroup, getGroupLedger } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { buildShareSummary } from "@/lib/wa";
import type { ExpenseWithSplits } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = getGroup(id);
  return { title: group?.name ?? "Group" };
}

function ExpenseRow({
  expense,
  currentUserId,
}: {
  expense: ExpenseWithSplits;
  currentUserId: string;
}) {
  const category = categoryFor(expense.category);
  const mySplit = expense.splits.find((split) => split.userId === currentUserId);

  return (
    <details className="group card-flat overflow-hidden transition open:shadow-soft">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 sm:p-4 [&::-webkit-details-marker]:hidden">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-paper text-lg">
          {category.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold sm:text-[15px]">
              {expense.title}
            </span>
            {expense.receiptData && (
              <Receipt className="h-3.5 w-3.5 shrink-0 text-teal-600" />
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <span>Paid by {expense.paidBy === currentUserId ? "you" : expense.payerName}</span>
            <span className="opacity-40">·</span>
            <span>{formatShortDate(expense.spentAt)}</span>
            <span className="opacity-40">·</span>
            <span>{SPLIT_RULE_LABELS[expense.splitRule]}</span>
          </span>
        </span>
        <span className="text-right">
          <span className="block text-sm font-extrabold tabular-nums sm:text-base">
            {formatBnd(expense.amountBndCents)}
          </span>
          {mySplit && (
            <span className="block text-[11px] font-semibold text-muted">
              your share {formatBnd(mySplit.amountBndCents)}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>

      <div className="border-t border-line/80 bg-white/40 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-paper p-3">
            <p className="stat-label">Paid by</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Avatar name={expense.payerName} color={expense.payerColor} size="xs" />
              <span className="text-sm font-bold">{expense.payerName}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-paper p-3">
            <p className="stat-label">Original entry</p>
            <p className="mt-1 text-sm font-bold">
              {expense.currency === "BND"
                ? formatBnd(expense.amountBndCents)
                : `${formatOriginal(expense.amountCents, expense.currency)} @ ${expense.fxRateToBnd}`}
            </p>
            <p className="text-[11px] text-muted">
              {formatDate(expense.spentAt)}
            </p>
          </div>
        </div>

        <p className="stat-label mt-4">Split</p>
        <div className="mt-1.5 divide-soft rounded-2xl border border-line bg-card">
          {expense.splits.map((split) => (
            <div
              key={split.id}
              className="flex items-center gap-2.5 px-3 py-2.5"
            >
              <Avatar name={split.userName} color={split.userColor} size="xs" />
              <span className="flex-1 text-sm font-semibold">
                {split.userName}
                {split.userId === currentUserId && (
                  <span className="ml-1 text-xs font-normal text-muted">you</span>
                )}
              </span>
              {split.percent != null && (
                <span className="chip">{split.percent}%</span>
              )}
              {split.shareUnits != null && (
                <span className="chip">{split.shareUnits} shares</span>
              )}
              <span className="text-sm font-bold tabular-nums">
                {formatBnd(split.amountBndCents)}
              </span>
            </div>
          ))}
        </div>

        {expense.items.length > 0 && (
          <>
            <p className="stat-label mt-4">Items</p>
            <div className="mt-1.5 divide-soft rounded-2xl border border-line bg-card">
              {expense.items.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-muted">{item.name}</span>
                  <span className="font-semibold tabular-nums">
                    {formatOriginal(item.amountCents, expense.currency)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {expense.notes && (
          <p className="mt-3 rounded-2xl bg-amber-100/60 px-3 py-2.5 text-xs leading-relaxed text-ink/75">
            {expense.notes}
          </p>
        )}

        {expense.receiptData && (
          <a
            href={expense.receiptData}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-teal-700"
          >
            <Receipt className="h-3.5 w-3.5" /> View receipt photo
          </a>
        )}
      </div>
    </details>
  );
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ledger = getGroupLedger(id);
  if (!ledger) notFound();
  if (!ledger.members.some((member) => member.userId === user.id)) notFound();

  const myBalance =
    ledger.balances.find((balance) => balance.userId === user.id)?.amountCents ??
    0;
  const pending = ledger.settlements.filter(
    (settlement) => settlement.status === "pending",
  );
  const pendingForMe = pending.filter(
    (settlement) => settlement.toUser === user.id,
  );
  const myTransfers = ledger.transfers.filter(
    (transfer) => transfer.from === user.id || transfer.to === user.id,
  );
  const shareText = buildShareSummary({
    group: ledger.group,
    members: ledger.members,
    expenses: ledger.expenses,
    balances: ledger.balances,
    transfers: ledger.transfers,
  });
  const activePool = ledger.pools[0];

  return (
    <div className="space-y-5">
      <Link
        href="/groups"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted transition hover:text-teal-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All groups
      </Link>

      <header className="card overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-teal-700 via-teal-500 to-amber-400" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-paper text-3xl">
                {ledger.group.emoji}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    {ledger.group.name}
                  </h1>
                  <span className="pill bg-teal-50 text-teal-800">
                    {KIND_LABELS[ledger.group.kind]}
                  </span>
                </div>
                {ledger.group.description && (
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
                    {ledger.group.description}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <AvatarStack members={ledger.members} />
                  <span className="text-xs font-semibold text-muted">
                    {ledger.members.length} members
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="text-xs font-semibold text-muted">
                    started {relativeTime(ledger.group.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AddExpenseButton
                groupId={ledger.group.id}
                currentUserId={user.id}
                members={ledger.members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                  username: member.username,
                  avatarColor: member.avatarColor,
                }))}
              />
              <Link href={`/groups/${ledger.group.id}/settle`} className="btn-secondary">
                <Handshake className="h-4 w-4" /> Settle up
              </Link>
              <ShareWhatsAppButton text={shareText} compact label="Share" />
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <p className="stat-label">Total logged</p>
          <p className="stat-value">{formatBnd(ledger.totalCents)}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Your position</p>
          <p
            className={`stat-value ${
              myBalance > 0
                ? "text-teal-700"
                : myBalance < 0
                  ? "text-coral"
                  : ""
            }`}
          >
            {myBalance === 0 ? "Square" : formatPosition(myBalance)}
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Settle with</p>
          <p className="stat-value">{ledger.transfers.length} transfers</p>
        </div>
        <div className="stat">
          <p className="stat-label">Pools</p>
          <p className="stat-value">{ledger.pools.length}</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-5">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line/80 px-5 py-4">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-teal-700" /> Settle up
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {ledger.transfers.length
                    ? `${ledger.transfers.length} simplified transfer${ledger.transfers.length === 1 ? "" : "s"} clears the whole group`
                    : "Everyone is square"}
                </p>
              </div>
              <Link
                href={`/groups/${ledger.group.id}/settle`}
                className="btn-ghost text-xs"
              >
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {ledger.transfers.length ? (
              <div className="divide-soft">
                {ledger.transfers.slice(0, 4).map((transfer) => {
                  const isMine =
                    transfer.from === user.id || transfer.to === user.id;
                  return (
                    <div
                      key={`${transfer.from}-${transfer.to}`}
                      className={`flex items-center gap-3 px-5 py-3 ${isMine ? "bg-teal-50/40" : ""}`}
                    >
                      <Avatar
                        name={transfer.fromName}
                        color={transfer.fromColor}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {transfer.fromName}
                          <span className="mx-1.5 text-muted">→</span>
                          {transfer.toName}
                        </p>
                        <p className="text-[11px] text-muted">
                          {transfer.from === user.id
                            ? "you pay"
                            : transfer.to === user.id
                              ? "you receive"
                              : "between members"}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold tabular-nums">
                        {formatBnd(transfer.amountCents)}
                      </span>
                      {isMine && (
                        <Link
                          href={`/groups/${ledger.group.id}/settle`}
                          className="btn-ghost hidden text-[11px] sm:inline-flex"
                        >
                          {transfer.from === user.id ? "Pay" : "Collect"}
                        </Link>
                      )}
                    </div>
                  );
                })}
                {ledger.transfers.length > 4 && (
                  <p className="px-5 py-3 text-xs font-semibold text-muted">
                    +{ledger.transfers.length - 4} more on the settle-up page
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-5 py-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-100 text-teal-800">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">No one owes anyone.</p>
                  <p className="text-xs text-muted">
                    Add an expense and Vantage will recalculate instantly.
                  </p>
                </div>
              </div>
            )}

            {myTransfers.length > 0 && (
              <div className="border-t border-line/80 bg-paper/70 px-5 py-3">
                <p className="text-xs font-semibold text-muted">
                  For you:{" "}
                  {myTransfers
                    .map((transfer) =>
                      transfer.from === user.id
                        ? `pay ${transfer.toName} ${formatBnd(transfer.amountCents)}`
                        : `collect ${formatBnd(transfer.amountCents)} from ${transfer.fromName}`,
                    )
                    .join(" · ")}
                </p>
              </div>
            )}

            {pending.length > 0 && (
              <div className="border-t border-amber-300/50 bg-amber-100/50 px-5 py-3">
                <p className="text-xs font-semibold text-ink/75">
                  ⏳ {pending.length} payment{pending.length === 1 ? "" : "s"} awaiting confirmation
                  {pendingForMe.length > 0 && (
                    <Link
                      href={`/groups/${ledger.group.id}/settle`}
                      className="ml-1 font-bold text-teal-800 underline underline-offset-2"
                    >
                      Confirm {pendingForMe.length === 1 ? "it" : "them"}
                    </Link>
                  )}
                </p>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-teal-700" /> Expenses
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {ledger.expenses.length} entr
                  {ledger.expenses.length === 1 ? "y" : "ies"} · tap to expand
                </p>
              </div>
              <AddExpenseButton
                groupId={ledger.group.id}
                currentUserId={user.id}
                members={ledger.members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                  username: member.username,
                  avatarColor: member.avatarColor,
                }))}
              />
            </div>

            <div className="space-y-2.5">
              {ledger.expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  currentUserId={user.id}
                />
              ))}
              {ledger.expenses.length === 0 && (
                <div className="card flex flex-col items-center px-6 py-10 text-center">
                  <span className="text-3xl">🧾</span>
                  <p className="mt-3 text-sm font-bold">No expenses yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted">
                    Add the first receipt and Vantage will take care of the
                    maths.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Target className="h-4 w-4 text-teal-700" /> Money pools
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Pledges only — no cash held here
                </p>
              </div>
              <CreatePoolButton groupId={ledger.group.id} />
            </div>

            <div className="mt-4 space-y-4">
              {ledger.pools.map((pool) => {
                const progress = pct(pool.pledgedCents, pool.goalBndCents);
                const myPledge = pool.pledges.find(
                  (pledge) => pledge.userId === user.id,
                );
                return (
                  <div
                    key={pool.id}
                    className="rounded-2xl border border-line bg-paper/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{pool.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          by {pool.createdByName}
                          {pool.deadline
                            ? ` · ${daysUntil(pool.deadline)}`
                            : ""}
                        </p>
                      </div>
                      <span className="pill bg-amber-100 text-ink/75">
                        {Math.round(progress)}%
                      </span>
                    </div>

                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
                      <span className="tabular-nums text-teal-800">
                        {formatBnd(pool.pledgedCents)} pledged
                      </span>
                      <span className="tabular-nums text-muted">
                        of {formatBnd(pool.goalBndCents)}
                      </span>
                    </div>

                    {pool.receivedCents > 0 && (
                      <p className="mt-1 text-[11px] text-muted">
                        {formatBnd(pool.receivedCents)} already handed over
                        offline
                      </p>
                    )}

                    {pool.note && (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        {pool.note}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AvatarStack
                          members={pool.pledges.map((pledge) => ({
                            userId: pledge.userId,
                            name: pledge.userName,
                            avatarColor: pledge.userColor,
                          }))}
                          max={4}
                        />
                        <span className="text-[11px] font-semibold text-muted">
                          {pool.pledges.length} pledged
                        </span>
                      </div>
                      <PledgeButton
                        poolId={pool.id}
                        poolTitle={pool.title}
                        existingAmount={myPledge?.amountBndCents ?? null}
                        existingStatus={myPledge?.status ?? null}
                      />
                    </div>

                    {myPledge && (
                      <p className="mt-2 rounded-xl bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800">
                        You pledged {formatBnd(myPledge.amountBndCents)} ·{" "}
                        {myPledge.status === "received"
                          ? "handed over offline"
                          : "still pledged"}
                      </p>
                    )}
                  </div>
                );
              })}
              {ledger.pools.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center">
                  <span className="text-2xl">🎯</span>
                  <p className="mt-2 text-sm font-bold">No pools yet</p>
                  <p className="mt-1 text-xs text-muted">
                    Pool a gift, a photo book, or a shared deposit without
                    moving money into Vantage.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-teal-700" /> Members
              </h2>
              <span className="text-xs font-semibold text-muted">
                {ledger.members.length}
              </span>
            </div>
            <div className="mt-3 divide-soft">
              {ledger.members.map((member) => {
                const balance =
                  ledger.balances.find(
                    (entry) => entry.userId === member.userId,
                  )?.amountCents ?? 0;
                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-2.5 py-2.5"
                  >
                    <Avatar
                      name={member.name}
                      color={member.avatarColor}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {member.name}
                        {member.userId === user.id && (
                          <span className="ml-1 text-xs font-normal text-muted">
                            you
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        @{member.username}
                        {member.role === "owner" ? " · owner" : ""}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        balance > 0
                          ? "text-teal-700"
                          : balance < 0
                            ? "text-coral"
                            : "text-muted"
                      }`}
                    >
                      {balance === 0 ? "square" : formatPosition(balance)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {activePool && (
            <section className="rounded-3xl border border-amber-300/50 bg-amber-100/50 p-5">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/60">
                <TrendingUp className="h-3.5 w-3.5" /> Pool progress
              </p>
              <p className="mt-1.5 font-display text-lg font-semibold">
                {activePool.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink/65">
                {formatBnd(activePool.goalBndCents - activePool.pledgedCents)} to
                go. Pledges are tracked here, then paid directly to whoever is
                buying the gift.
              </p>
            </section>
          )}

          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-teal-700" /> Recent payments
            </h2>
            <div className="mt-3">
              {ledger.settlements.slice(0, 5).map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex items-center gap-2.5 border-b border-line/70 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {settlement.fromName} → {settlement.toName}
                    </p>
                    <p className="text-[11px] text-muted">
                      {formatDate(settlement.createdAt)} ·{" "}
                      {RAIL_LABELS[settlement.rail]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold tabular-nums">
                      {formatBnd(settlement.amountBndCents)}
                    </p>
                    <p
                      className={`text-[10px] font-bold uppercase ${
                        settlement.status === "completed"
                          ? "text-teal-700"
                          : settlement.status === "pending"
                            ? "text-amber-500"
                            : "text-coral"
                      }`}
                    >
                      {settlement.status}
                    </p>
                  </div>
                </div>
              ))}
              {ledger.settlements.length === 0 && (
                <p className="py-3 text-xs text-muted">
                  No payments recorded yet.
                </p>
              )}
            </div>
            <Link
              href={`/groups/${ledger.group.id}/settle`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-700"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Settle-up & payment
              routing
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
