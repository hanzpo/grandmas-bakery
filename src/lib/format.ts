export const money = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

// Date-only values ("2026-10-04") parse as UTC midnight; pin them to local midnight so they don't show a day early.
const parse = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00` : iso);

export const date = (iso: string | null | undefined) =>
  iso ? parse(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** Short date for nearby days, e.g. "Fri, Oct 4". */
export const shortDate = (iso: string | null | undefined) =>
  iso ? parse(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";

/** Local calendar date as YYYY-MM-DD (for date inputs and Postgres `date` columns). */
export const isoDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
};
