import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  FlaskConical,
  Inbox,
  MessageCircle,
  TriangleAlert,
  Webhook,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ExpenseConfirmButtons } from "@/components/ExpenseConfirmButtons";
import { getExpensesAwaitingUser } from "@/lib/collab";
import { RetryMessageButton } from "@/components/RetryMessageButton";
import { formatBnd } from "@/lib/currency";
import { relativeTime } from "@/lib/dates";
import { getActivityForUser, getPendingSettlementsForUser } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { integrationStatus } from "@/lib/whatsapp";
import { TEMPLATE_LABELS, type WhatsAppTemplate } from "@/lib/wa";

export const metadata = { title: "Activity" };

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-teal-100 text-teal-800",
  simulated: "bg-amber-100 text-ink/75",
  queued: "bg-paper text-muted",
  failed: "bg-coral/10 text-coral",
};

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const messages = getActivityForUser(user.id);
  const pending = getPendingSettlementsForUser(user.id);
  const expensesAwaiting = getExpensesAwaitingUser(user.id);
  const integration = integrationStatus();
  const awaitingMe = pending.filter(
    (settlement) => settlement.toUser === user.id,
  );
  const awaitingThem = pending.filter(
    (settlement) => settlement.fromUser === user.id,
  );
  const failed = messages.filter((message) => message.status === "failed").length;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-700">
          Notifications
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Activity
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Every WhatsApp notification Vantage has queued for you, plus payments
          waiting on your confirmation.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <p className="stat-label">Messages</p>
          <p className="stat-value">{messages.length}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Awaiting you</p>
          <p className="stat-value">{awaitingMe.length}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Your pending</p>
          <p className="stat-value">{awaitingThem.length}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Failed sends</p>
          <p className={`stat-value ${failed ? "text-coral" : ""}`}>{failed}</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-5">
          {expensesAwaiting.length > 0 && (
            <section className="card p-5">
              <h2 className="section-title flex items-center gap-2">
                <BellRing className="h-4 w-4 text-coral" /> Needs your yes
              </h2>
              <p className="mt-1 text-xs text-muted">
                Someone added these expenses on your behalf. They only count
                once you confirm.
              </p>
              <div className="mt-3 space-y-2.5">
                {expensesAwaiting.map((expense) => (
                  <div
                    key={expense.id}
                    className="rounded-2xl border border-amber-300/60 bg-amber-100/40 p-3"
                  >
                    <p className="text-sm font-bold">
                      {expense.title} · {formatBnd(expense.amountBndCents)}
                    </p>
                    <p className="mb-2.5 mt-0.5 text-[11px] text-muted">
                      {expense.groupEmoji} {expense.groupName} · added by{" "}
                      {expense.creatorName} ·{" "}
                      {expense.paidByYou
                        ? "it says you paid"
                        : `your share ${formatBnd(expense.yourShareCents)}`}
                    </p>
                    <ExpenseConfirmButtons expenseId={expense.id} mode="answer" compact />
                  </div>
                ))}
              </div>
            </section>
          )}

          {awaitingMe.length > 0 && (
            <section className="card p-5">
              <h2 className="section-title flex items-center gap-2">
                <BellRing className="h-4 w-4 text-amber-500" /> Confirm payments
              </h2>
              <p className="mt-1 text-xs text-muted">
                These members say they paid you. Check your banking app, then
                confirm or reject.
              </p>
              <div className="mt-3 space-y-2.5">
                {awaitingMe.map((settlement) => (
                  <div
                    key={settlement.id}
                    className="flex items-center gap-3 rounded-2xl border border-amber-300/60 bg-amber-100/40 p-3"
                  >
                    <Avatar
                      name={settlement.fromName}
                      color={settlement.fromColor}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {settlement.fromName} ·{" "}
                        {formatBnd(settlement.amountBndCents)}
                      </p>
                      <p className="text-[11px] text-muted">
                        {relativeTime(settlement.createdAt)} ·{" "}
                        {settlement.rail}
                      </p>
                    </div>
                    <Link
                      href={`/groups/${settlement.groupId}/settle`}
                      className="btn text-xs"
                    >
                      Review <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-teal-700" /> WhatsApp outbox
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Service layer output, newest first
                </p>
              </div>
              <span className="chip">{messages.length}</span>
            </div>

            <div className="space-y-2.5">
              {messages.map((message) => (
                <article key={message.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-teal-800">
                        <MessageCircle className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-bold">
                          {TEMPLATE_LABELS[
                            message.template as WhatsAppTemplate
                          ] ?? message.template}
                        </p>
                        <p className="text-[11px] text-muted">
                          {message.groupName ?? "Vantage"} ·{" "}
                          {relativeTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`pill ${
                        STATUS_STYLE[message.status] ?? "bg-paper text-muted"
                      }`}
                    >
                      {message.status}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-paper/80 px-3.5 py-3 text-xs leading-relaxed text-ink/80">
                    {message.body}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      to {message.phone ?? "no phone"} ·{" "}
                      {message.userName ?? "member"}
                    </p>
                    {(message.status === "failed" ||
                      message.status === "queued") && (
                      <RetryMessageButton messageId={message.id} />
                    )}
                  </div>
                  {message.error && (
                    <p className="mt-1.5 rounded-xl bg-coral/5 px-2.5 py-1.5 text-[10px] text-coral">
                      {message.error}
                    </p>
                  )}
                </article>
              ))}
              {messages.length === 0 && (
                <div className="card flex flex-col items-center px-6 py-12 text-center">
                  <span className="text-3xl">🔔</span>
                  <p className="mt-3 text-sm font-bold">Nothing yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted">
                    Add an expense or start a pool and the notification service
                    will queue a message here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              {integration.configured ? (
                <CheckCircle2 className="h-4 w-4 text-teal-700" />
              ) : (
                <FlaskConical className="h-4 w-4 text-amber-500" />
              )}
              Integration
            </h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-2xl bg-paper px-3 py-2.5">
                <span className="text-xs font-semibold text-muted">Mode</span>
                <span
                  className={`pill ${
                    integration.configured
                      ? "bg-teal-100 text-teal-800"
                      : "bg-amber-100 text-ink/75"
                  }`}
                >
                  {integration.configured ? "Live Cloud API" : "Simulated"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-paper px-3 py-2.5">
                <span className="text-xs font-semibold text-muted">Webhook</span>
                <span className="text-xs font-bold">
                  {integration.verifyTokenSet ? "Ready" : "Token missing"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-paper px-3 py-2.5">
                <span className="text-xs font-semibold text-muted">
                  API version
                </span>
                <span className="text-xs font-bold">{integration.apiVersion}</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Add `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and
              `WHATSAPP_VERIFY_TOKEN` to switch from simulation to live
              delivery.
            </p>
          </section>

          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <Webhook className="h-4 w-4 text-teal-700" /> Webhook endpoints
            </h2>
            <div className="mt-3 space-y-2 text-[11px]">
              <p className="rounded-xl bg-paper px-3 py-2 font-mono">
                GET /api/whatsapp/webhook
              </p>
              <p className="rounded-xl bg-paper px-3 py-2 font-mono">
                POST /api/whatsapp/webhook
              </p>
              <p className="rounded-xl bg-paper px-3 py-2 font-mono">
                POST /api/whatsapp/outbox/:id/retry
              </p>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Inbound payloads are verified against the hub token and stored in
              `whatsapp_events` for audit.
            </p>
          </section>

          {awaitingThem.length > 0 && (
            <section className="card p-5">
              <h2 className="section-title flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-500" /> Waiting for
                them
              </h2>
              <div className="mt-3 space-y-2">
                {awaitingThem.map((settlement) => (
                  <div
                    key={settlement.id}
                    className="rounded-2xl bg-paper px-3 py-2.5"
                  >
                    <p className="text-xs font-bold">
                      {formatBnd(settlement.amountBndCents)} to{" "}
                      {settlement.toName}
                    </p>
                    <p className="text-[11px] text-muted">
                      marked {relativeTime(settlement.createdAt)} · awaiting
                      confirmation
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-amber-300/50 bg-amber-100/50 p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/60">
              Zero-friction sharing
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
              Every group has a “Share to WhatsApp” button that formats the
              expense summary and a deep link to the settle-up page. Paste it
              straight into the group chat.
            </p>
            <Link href="/groups" className="btn-secondary mt-3 text-xs">
              Pick a group
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
