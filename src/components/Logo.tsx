import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/groups" className="inline-flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center bg-green-700 text-white">
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
      </span>
      {!compact && (
        <span className="text-xl font-semibold text-black">Vantage</span>
      )}
    </Link>
  );
}
