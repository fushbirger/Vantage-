"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, UserRound } from "lucide-react";

export function ProfileForm({
  name,
  phone,
}: {
  name: string;
  phone: string | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [phoneNumber, setPhoneNumber] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName, phone: phoneNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save profile.");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p className="rounded-2xl border border-coral/25 bg-coral/5 px-3.5 py-2.5 text-sm font-semibold text-coral">
          {error}
        </p>
      )}
      <div>
        <label className="field-label" htmlFor="profile-name">
          Display name
        </label>
        <input
          id="profile-name"
          className="field"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={60}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="profile-phone">
          Phone for WhatsApp & tarus
        </label>
        <input
          id="profile-phone"
          className="field"
          inputMode="tel"
          placeholder="+673 8xx xxxx"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
        <p className="mt-1 text-[11px] text-muted">
          Shown to group members so they can remind you on WhatsApp and copy
          your tarus proxy.
        </p>
      </div>
      <button type="submit" disabled={saving} className="btn-secondary w-full">
        {saved ? (
          <>
            <Check className="h-4 w-4 text-teal-700" /> Saved
          </>
        ) : (
          <>
            <UserRound className="h-4 w-4" />
            {saving ? "Saving…" : "Save profile"}
          </>
        )}
      </button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      disabled={loading}
      className="btn-danger w-full"
    >
      <LogOut className="h-4 w-4" />
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
