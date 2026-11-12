import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Handshake,
  Info,
  Scale,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SettleDebtCard } from "@/components/SettleDebtCard";
import { SettlementClaimCard } from "@/components/SettlementClaimCard";
import { ShareWhatsAppButton } from "@/components/ShareWhatsAppButton";
import { formatBnd, formatPosition } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/dates";
import { RAIL_LABELS } from "@/lib/display";
import { getPaymentProfile, getGroupLedger } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { buildShareSummary, reminderBody, waLink } from "@/lib/wa";
import type { PaymentProfile } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ledger = getGroupLedger(id);
  return { title: ledger ? `Settle up · ${ledger.group.name}` : "Settle up" };
}

export default async function SettlePage({
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

  const profileMap = new Map<string, PaymentProfile | null>();
  for (const member of ledger.members) {
    profileMap.set(member.userId, getPaymentProfile(member.userId));
  }

  const myBalance =
    ledger.balances.find((balance) => balance.userId === user.id)?.amountCents ??
    0;
  const pendingClaims = ledger.settlements.filter(
    (settlement) => settlement.status === "pending",
  );
  const pendingByTransfer = new Map(
    pendingClaims.map((claim) => [
      `${claim.fromUser}-${claim.toUser}-${claim.amountBndCents}`,
      claim,
    ]),
  );
  const history = ledger.settlements.filter(
    (settlement) => settlement.status !== "pending",
  );
  const outstanding = ledger.transfers.reduce(
    (sum, transfer) => sum + transfer.amountCents,
    0,
  );
  const shareText = buildShareSummary({
    group: ledger.group,
    members: ledger.members,
    expenses: ledger.expenses,
    balances: ledger.balances,
    transfers: ledger.transfers,
  });

  return (
    <div className="space-y-5">
      <Link
        href={`/groups/${ledger.group.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted transition hover:text-teal-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {ledger.group.name}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-700">
            {ledger.group.emoji} {ledger.group.name}
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            <Handshake className="h-8 w-8 text-teal-700" /> Settle up
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Vantage nets out the whole group first, then routes each remaining
            transfer to a real payment rail. The money moves directly between
            you — never through Vantage.
          </p>
        </div>
        <ShareWhatsAppButton text={shareText} compact label="Share summary" />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <p className="stat-label">Outstanding</p>
          <p className="stat-value">{formatBnd(outstanding)}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Transfers</p>
          <p className="stat-value">{ledger.transfers.length}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Your position</p>
          <p
            className={`stat-value ${
              myBalance > 0 ? "text-teal-700" : myBalance < 0 ? "text-coral" : ""
            }`}
          >
            {myBalance === 0 ? "Square" : formatPosition(myBalance)}
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Awaiting confirm</p>
          <p className="stat-value">{pendingClaims.length}</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="min-w-0 space-y-5">
          {pendingClaims.length > 0 && (
            <section>
              <div className="mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-amber-500" /> Awaiting
                  confirmation
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  A marked payment only changes the ledger once the recipient
                  confirms it.
                </p>
              </div>
              <div className="space-y-2.5">
                {pendingClaims.map((settlement) => (
                  <SettlementClaimCard
                    key={settlement.id}
                    settlement={settlement}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Scale className="h-4 w-4 text-teal-700" /> Simplified
                  transfers
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Greedy min-cash-flow · the fewest practical payments for this
                  group
                </p>
              </div>
              <span className="chip chip-active">
                {ledger.transfers.length} payment
                {ledger.transfers.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-2.5">
              {ledger.transfers.map((transfer) => {
                const debtor = ledger.members.find(
                  (member) => member.userId === transfer.from,
                );
                const creditor = ledger.members.find(
                  (member) => member.userId === transfer.to,
                );
                if (!debtor || !creditor) return null;
                const creditorProfile = profileMap.get(creditor.userId) ?? null;
                const reminderHref = waLink(
                  reminderBody({
                    actorName: creditor.name,
                    amountBndCents: transfer.amountCents,
                    toName: creditor.name,
                    groupName: ledger.group.name,
                    groupId: ledger.group.id,
                  }),
                  debtor.phone,
                );
                return (
                  <SettleDebtCard
                    key={`${transfer.from}-${transfer.to}`}
                    groupId={ledger.group.id}
                    groupName={ledger.group.name}
                    debt={{
                      from: transfer.from,
                      to: transfer.to,
                      amountCents: transfer.amountCents,
                      fromName: transfer.fromName,
                      fromColor: transfer.fromColor,
                      toName: transfer.toName,
                      toColor: transfer.toColor,
                    }}
                    currentUserId={user.id}
                    creditor={{
                      userId: creditor.userId,
                      name: creditor.name,
                      username: creditor.username,
                      avatarColor: creditor.avatarColor,
                      phone: creditor.phone,
                    }}
                    debtor={{
                      userId: debtor.userId,
                      name: debtor.name,
                      username: debtor.username,
                      avatarColor: debtor.avatarColor,
                      phone: debtor.phone,
                    }}
                    creditorProfile={creditorProfile}
                    reminderHref={reminderHref}
                    pendingClaim={pendingByTransfer.has(
                      `${transfer.from}-${transfer.to}-${transfer.amountCents}`,
                    )}
                  />
                );
              })}

              {ledger.transfers.length === 0 && (
                <div className="card flex flex-col items-center px-6 py-12 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-teal-800">
                    <CheckCircle2 className="h-7 w-7" />
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-semibold">
                    Everyone is square
                  </h3>
                  <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
                    No simplified transfers remain. Add a new expense and
                    Vantage will rebalance the group automatically.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-teal-700" /> Payment
              history
            </h2>
            <div className="mt-3 divide-soft">
              {history.map((settlement) => (
                <div key={settlement.id} className="py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name={settlement.fromName}
                      color={settlement.fromColor}
                      size="xs"
                    />
                    <p className="min-w-0 flex-1 truncate text-xs font-semibold">
                      {settlement.fromName} → {settlement.toName}
                    </p>
                    <span className="text-xs font-bold tabular-nums">
                      {formatBnd(settlement.amountBndCents)}
                    </span>
                    <span
                      className={`pill ${
                        settlement.status === "completed"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-coral/10 text-coral"
                      }`}
                    >
                      {settlement.status === "completed" ? "Completed" : "Rejected"}
                    </span>
                  </div>
                  <p className="mt-1 pl-9 text-[11px] text-muted">
                    {formatDateTime(settlement.createdAt)} ·{" "}
                    {RAIL_LABELS[settlement.rail]}
                    {settlement.note ? ` · “${settlement.note}”` : ""}
                  </p>
                  {settlement.proofData && (
                    <a
                      href={settlement.proofData}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-9 text-[11px] font-bold text-teal-700"
                    >
                      View proof
                    </a>
                  )}
                </div>
              ))}
              {history.length === 0 && (
                <p className="py-3 text-xs text-muted">
                  No completed payments yet. Once a claim is confirmed it lands
                  here.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-teal-700" /> Local rails
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Each member can save a tarus proxy, a tarusQR image, or a Pocket
              link. Vantage only displays it when you settle up.
            </p>
            <div className="mt-3 space-y-2.5">
              {ledger.members.map((member) => {
                const profile = profileMap.get(member.userId);
                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-2.5 rounded-2xl border border-line bg-paper/60 p-2.5"
                  >
                    <Avatar
                      name={member.name}
                      color={member.avatarColor}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{member.name}</p>
                      <p className="truncate text-[11px] text-muted">
                        {profile
                          ? RAIL_LABELS[profile.preferredRail]
                          : "No rail saved"}
                        {profile?.tarusProxy ? ` · ${profile.tarusProxy}` : ""}
                      </p>
                    </div>
                    {profile?.tarusQrData && (
                      <span className="pill bg-teal-50 text-teal-800">QR</span>
                    )}
                  </div>
                );
              })}
            </div>
            <Link
              href="/account"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-teal-700"
            >
              Manage my payment details
            </Link>
          </section>

          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <Info className="h-4 w-4 text-teal-700" /> How this works
            </h2>
            <ol className="mt-3 space-y-3">
              {[
                "Vantage simplifies the ledger into the fewest transfers.",
                "You pay the exact BND amount directly with tarus, tarusQR or Pocket.",
                "Tap “mark as paid”, optionally attach a screenshot.",
                "The recipient confirms — then the ledger is square.",
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-100 text-[11px] font-extrabold text-teal-800">
                    {index + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-muted">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-2xl bg-amber-100/60 px-3.5 py-3 text-[11px] leading-relaxed text-ink/75">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              Vantage holds BND 0.00. It is a ledger and routing layer, not an
              e-wallet.
            </div>
          </section>

          <section className="card p-5">
            <h2 className="section-title">Net positions</h2>
            <div className="mt-3 divide-soft">
              {ledger.balances.map((balance) => (
                <div
                  key={balance.userId}
                  className="flex items-center gap-2.5 py-2.5"
                >
                  <Avatar
                    name={balance.name}
                    color={balance.avatarColor}
                    size="xs"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {balance.name}
                  </span>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      balance.amountCents > 0
                        ? "text-teal-700"
                        : balance.amountCents < 0
                          ? "text-coral"
                          : "text-muted"
                    }`}
                  >
                    {balance.amountCents === 0
                      ? "square"
                      : formatPosition(balance.amountCents)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Positive means the member is owed. Pending claims are not counted
              until confirmed.
            </p>
          </section>

          <section className="rounded-3xl border border-line bg-card p-5">
            <h2 className="section-title">Last activity</h2>
            <p className="mt-1 text-xs text-muted">
              {ledger.expenses.length} expenses · {ledger.settlements.length}{" "}
              payments · updated {formatDate(ledger.lastActivityAt)}
            </p>
            <Link
              href={`/groups/${ledger.group.id}`}
              className="btn-secondary mt-3 w-full text-xs"
            >
              Back to group dashboard
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
