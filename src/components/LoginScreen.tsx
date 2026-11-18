"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import type { User } from "@/lib/types";

export function LoginScreen({ users }: { users: User[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");

  async function signIn(userId: string) {
    setError("");
    setLoading(userId);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not sign in.");
      router.push("/groups");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
      setLoading(null);
    }
  }

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading("register");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create account.");
      router.push("/groups");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create account.",
      );
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10">
      <section>
        <div>
          <Logo />
        </div>
        <p className="mt-10 inline-flex items-center gap-2 border border-line bg-white px-3 py-1.5 text-xs font-medium text-black">
          Made for Brunei
        </p>
        <h1 className="mt-5 max-w-xl text-2xl font-semibold leading-tight text-black">
          Split the bill.
          <br />
          Keep the friendship.
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
          Vantage tracks group spending, nets out who owes whom, and routes you
          to tarus or Pocket. Your money never leaves your account.
        </p>

        <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3">
          {[
            { icon: UsersRound, title: "Group ledger", text: "Trips, dinners, gifts" },
            { icon: Sparkles, title: "Pairwise maths", text: "One net figure per pair" },
            { icon: ShieldCheck, title: "Non-custodial", text: "No wallet, no float" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="border border-line bg-white p-3.5">
              <Icon className="h-4 w-4 text-green-700" />
              <p className="mt-2 text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted">{text}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 flex items-center gap-2 text-xs font-semibold text-muted">
          <LockKeyhole className="h-3.5 w-3.5" />
          Demo workspace — sessions are simulated, no real funds are moved.
        </p>
      </section>

      <section className="border border-line bg-white p-5 sm:p-7">
        <div className="mb-5 flex border border-line">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
            }}
            className={`flex-1 border-r border-line px-4 py-2 text-sm font-semibold transition ${
              mode === "signin" ? "bg-black text-white" : "bg-white text-black"
            }`}
          >
            Demo sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`flex-1 px-4 py-2 text-sm font-semibold transition ${
              mode === "register" ? "bg-black text-white" : "bg-white text-black"
            }`}
          >
            New account
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-none border border-red-600/40 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        {mode === "signin" ? (
          <div>
            <p className="text-sm text-muted">
              Pick a seeded account to explore a group that already has expenses,
              debts and a pool.
            </p>
            <div className="mt-4 space-y-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => signIn(user.id)}
                  disabled={loading !== null}
                  className="flex w-full items-center gap-3 border border-line bg-white p-3 text-left transition hover:border-green-700 disabled:opacity-60"
                >
                  <Avatar name={user.name} color={user.avatarColor} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {user.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      @{user.username}
                      {user.phone ? ` · ${user.phone}` : ""}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-green-700" />
                </button>
              ))}
            </div>
            <p className="mt-4 border border-line bg-neutral-50 px-3.5 py-3 text-xs leading-relaxed text-muted">
              Tip: sign in as <strong className="text-black">Aiman</strong> to see
              the Miri road-trip debts. Then switch to{" "}
              <strong className="text-black">Nurul</strong> to confirm a payment.
            </p>
          </div>
        ) : (
          <form onSubmit={register} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="name">
                Display name
              </label>
              <input
                id="name"
                className="field"
                placeholder="e.g. Aisyah Rahman"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="field"
                placeholder="3–20 letters, numbers, underscores"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="phone">
                Phone for tarus / WhatsApp
              </label>
              <input
                id="phone"
                className="field"
                placeholder="+673 8xx xxxx"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="btn w-full"
            >
              {loading === "register" ? "Creating…" : "Create demo account"}
            </button>
            <p className="text-center text-xs text-muted">
              You can add a tarus proxy, QR and Pocket link after signing in.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
