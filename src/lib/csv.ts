type Cell = string | number | boolean | null | undefined;

const escape = (v: Cell) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows → CSV text (first row is the header). Opens cleanly in Excel, Numbers and Google Sheets. */
export const toCsv = (rows: Cell[][]) => rows.map((r) => r.map(escape).join(",")).join("\r\n");

/** Save rows as a .csv file in the browser. */
export function downloadCsv(filename: string, rows: Cell[][]) {
  // BOM so Excel reads accents and Chinese names as UTF-8.
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Cents → plain dollars for spreadsheets ("12.50", no currency symbol). */
export const csvDollars = (cents: number | null | undefined) => ((cents ?? 0) / 100).toFixed(2);
