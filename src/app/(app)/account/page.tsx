import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PaymentProfileForm } from "@/components/PaymentProfileForm";
import { ProfileForm, SignOutButton } from "@/components/ProfileForms";
import { formatDateTime } from "@/lib/dates";
import { getGroupsForUser, getPaymentProfile } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { integrationStatus } from "@/lib/whatsapp";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = getPaymentProfile(user.id);
  const groups = getGroupsForUser(user.id);
  const integration = integrationStatus();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-700">
          Account
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Your profile
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Payment details are shown only to people settling a debt with you.
          Vantage never stores card numbers or moves funds.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <Avatar
                name={user.name}
                color={user.avatarColor}
                size="xl"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-2xl font-semibold">
                  {user.name}
                </h2>
                <p className="truncate text-sm text-muted">@{user.username}</p>
                <p className="mt-1 text-xs text-muted">
                  {user.phone ?? "No phone linked"} · {groups.length} group
                  {groups.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="pill bg-teal-50 text-teal-800">Demo</span>
            </div>
            <div className="mt-5 border-t border-line/80 pt-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <UserRound className="h-4 w-4 text-teal-700" /> Profile details
              </h3>
              <ProfileForm name={user.name} phone={user.phone} />
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="section-title flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-teal-700" /> Payment routing
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Save a tarus proxy, a tarusQR image and a Pocket link. The
                settle-up screen uses whichever rail you prefer.
              </p>
            </div>
            <PaymentProfileForm profile={profile} />
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-teal-700" /> WhatsApp
              service
            </h2>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2.5">
                <span className="text-xs font-semibold text-muted">
                  Cloud API
                </span>
                <span
                  className={`pill ${
                    integration.configured
                      ? "bg-teal-100 text-teal-800"
                      : "bg-amber-100 text-ink/75"
                  }`}
                >
                  {integration.configured ? "Connected" : "Simulation"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2.5">
                <span className="text-xs font-semibold text-muted">
                  API version
                </span>
                <span className="text-xs font-bold">{integration.apiVersion}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2.5">
                <span className="text-xs font-semibold text-muted">
                  Webhook token
                </span>
                <span className="text-xs font-bold">
                  {integration.verifyTokenSet ? "Configured" : "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2.5">
                <span className="text-xs font-semibold text-muted">
                  Phone number ID
                </span>
                <span className="text-xs font-bold">
                  {integration.phoneNumberIdSet ? "Configured" : "Not set"}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              {integration.configured
                ? "Outbound messages go through the WhatsApp Business Cloud API."
                : "No credentials found. Notifications are queued in Activity as simulated messages so the full flow stays demoable."}
            </p>
            <Link href="/activity" className="btn-secondary mt-3 w-full text-xs">
              <Activity className="h-3.5 w-3.5" /> Open notification activity
            </Link>
          </section>

          <section className="rounded-3xl border border-teal-700/15 bg-teal-800 p-5 text-white">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/60">
              <ShieldCheck className="h-3.5 w-3.5" /> Non-custodial by design
            </p>
            <p className="mt-2 font-display text-2xl font-semibold">
              BND 0.00 under management.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70">
              Vantage is a smart ledger and payment-routing layer. It never
              holds, stores or processes your funds — avoiding e-money licensing
              and keeping your money in your own bank account.
            </p>
          </section>

          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal-700" /> Data boundaries
            </h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
              <li>• No card numbers or bank logins are collected.</li>
              <li>• Payment details are visible only on settle-up screens.</li>
              <li>• Screenshots are optional verification, not proof of funds.</li>
              <li>
                • WhatsApp opt-out is respected for every automated
                notification.
              </li>
            </ul>
            {profile?.updatedAt && (
              <p className="mt-3 text-[11px] text-muted">
                Payment details updated {formatDateTime(profile.updatedAt)}.
              </p>
            )}
          </section>

          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
