import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/groups" className="group inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-2xl bg-teal-800 text-white shadow-soft transition group-hover:rotate-3">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4 6.5 12 19l8-12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-paper" />
      </span>
      {!compact && (
        <span className="font-display text-xl font-semibold tracking-tight text-ink">
          Vantage
        </span>
      )}
    </Link>
  );
}
