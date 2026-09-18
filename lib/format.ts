export function fmtCurrency(n: number) {
  return n.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

// Calendar date (YYYY-MM-DD) in the device's local timezone. Never use
// `toISOString()` for this: it serializes in UTC, which moves the calendar
// day backward for timezones ahead of UTC (e.g. Asia/Jakarta).
export function toLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
