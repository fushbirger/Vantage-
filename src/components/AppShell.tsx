"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Inbox,
  Link2,
  LogOut,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";

interface ShellUser {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
}

const NAV = [
  { href: "/groups", label: "Groups", icon: UsersRound },
  { href: "/connections", label: "People", icon: Link2 },
  { href: "/activity", label: "Activity", icon: Inbox },
  { href: "/account", label: "Account", icon: UserRound },
];

export function AppShell({
  user,
  unread,
  peopleBadge = 0,
  groupsBadge = 0,
  children,
}: {
  user: ShellUser;
  unread: number;
  /** Connection requests waiting for me. */
  peopleBadge?: number;
  /** Group invitations waiting for me. */
  groupsBadge?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const badgeFor = (href: string) =>
    href === "/activity" ? unread : href === "/connections" ? peopleBadge : href === "/groups" ? groupsBadge : 0;

  const isActive = (href: string) =>
    href === "/groups" ? pathname.startsWith("/groups") : pathname === href;

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh">
      {/* mobile header */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white px-4 py-3  lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            <Link
              href="/activity"
              className="relative grid h-10 w-10 place-items-center rounded-none text-muted transition hover:bg-white hover:text-green-800"
              aria-label="Activity"
            >
              <Inbox className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-none bg-red-600 ring-2 ring-white" />
              )}
            </Link>
            <Link href="/account" aria-label="Account">
              <Avatar name={user.name} color={user.avatarColor} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line/70 bg-white px-5 py-6  lg:flex">
        <Logo />
        <nav className="mt-10 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-none px-3.5 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-green-800 text-white "
                    : "text-muted hover:bg-white hover:text-green-900"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
                {badgeFor(item.href) > 0 && (
                  <span
                    className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-none px-1.5 text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-red-600 text-white"
                    }`}
                  >
                    {badgeFor(item.href)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="rounded-none border border-neutral-300/50 bg-neutral-100/60 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold   text-black/70">
              <ShieldCheck className="h-3.5 w-3.5" /> Non-custodial
            </p>
            <p className="mt-1 text-xs leading-relaxed text-black/65">
              Vantage is a ledger. It never holds, stores or moves your money.
            </p>
          </div>
          <div className="flex items-center gap-2.5 rounded-none border border-line bg-white/70 p-2.5">
            <Avatar name={user.name} color={user.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-muted">@{user.username}</p>
            </div>
            <button
              onClick={signOut}
              disabled={signingOut}
              className="grid h-8 w-8 place-items-center rounded-none text-muted transition hover:bg-neutral-100 hover:text-red-600"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="w-full px-4 pb-28 pt-5 sm:px-6 lg:pl-72 lg:pr-8 lg:pb-16 lg:pt-10 xl:pr-12">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-white px-3 pt-1.5  lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-none px-3 py-2 text-[11px] font-bold transition ${
                  active ? "text-green-800" : "text-muted"
                }`}
              >
                <span
                  className={`grid h-8 w-12 place-items-center rounded-none transition ${
                    active ? "bg-green-100" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {badgeFor(item.href) > 0 && (
                    <span className="absolute right-4 top-1 h-2 w-2 rounded-none bg-red-600" />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
