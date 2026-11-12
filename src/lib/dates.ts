export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return "just now";
  if (abs < hour) {
    const n = Math.floor(abs / minute);
    return diff > 0 ? `${n}m ago` : `in ${n}m`;
  }
  if (abs < day) {
    const n = Math.floor(abs / hour);
    return diff > 0 ? `${n}h ago` : `in ${n}h`;
  }
  if (abs < 30 * day) {
    const n = Math.floor(abs / day);
    return diff > 0 ? `${n}d ago` : `in ${n}d`;
  }
  return formatDate(ms);
}

export function daysUntil(ms: number): string {
  const days = Math.ceil((ms - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `${days}d left`;
}

export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dateInputToMs(value: string): number {
  const parsed = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}
