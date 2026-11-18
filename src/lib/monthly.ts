/** Pure monthly-date helpers, kept separate so they are easy to unit test. */

/** First monthly run at 09:00 UTC on `day`, strictly after `from`. */
export function nextMonthlyRun(day: number, from = Date.now()): number {
  const safeDay = Math.min(28, Math.max(1, Math.round(day)));
  const date = new Date(from);
  let candidate = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    safeDay,
    9,
  );
  if (candidate <= from) {
    candidate = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      safeDay,
      9,
    );
  }
  return candidate;
}

export function addOneMonth(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    9,
  );
}

export function periodKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
