export const fmtPoints = (n: number) => n.toLocaleString("en-US");

/** "+110" or "−150", with a real minus sign. */
export const fmtPointsChange = (n: number) => `${n < 0 ? "−" : "+"}${fmtPoints(Math.abs(n))}`;

/** "2026-11-30" -> "Nov 30, 2026". UTC so the server's time zone can't shift the day. */
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}
