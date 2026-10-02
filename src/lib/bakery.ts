// Shop details shown on the public site.
export const BAKERY = {
  address: "280 Lester St, Waterloo, ON",
  phone: "(236) 242-3768",
  phoneHref: "tel:+12362423768",
  mapsEmbed: "https://www.google.com/maps?q=280+Lester+St,+Waterloo,+ON&output=embed",
  mapsLink: "https://www.google.com/maps/search/?api=1&query=280+Lester+St,+Waterloo,+ON",
  // Opening hours in 24h clock. Index = Date.getDay() (0 = Sunday). null = closed.
  hours: [
    [8, 14],
    null,
    [7, 18],
    [7, 18],
    [7, 18],
    [7, 19],
    [7, 17],
  ] as ([number, number] | null)[],
  // ElevenLabs agent behind the Bun-bun chat. Agent ids are public (the browser connects with it directly).
  voiceAgentId: "agent_5001m3zc4jajftt9zy1y4y1b9fa7",
};

// Monday-first week for display.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Hours grouped into runs of days with the same times, formatted for `locale`. */
export function hoursSummary(locale: string, closedLabel: string) {
  // 2024-01-07 was a Sunday, so day d is 2024-01-(7 + d).
  const day = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric" });
  const dayName = (d: number) => day.format(new Date(2024, 0, 7 + d));
  const at = (h: number) => time.format(new Date(2024, 0, 1, h));

  const runs: { days: number[]; hours: [number, number] | null }[] = [];
  for (const d of WEEK) {
    const h = BAKERY.hours[d];
    const last = runs[runs.length - 1];
    if (last && String(last.hours) === String(h)) last.days.push(d);
    else runs.push({ days: [d], hours: h });
  }
  return runs.map(({ days, hours }) => ({
    days: days.length > 1 ? `${dayName(days[0])}–${dayName(days[days.length - 1])}` : dayName(days[0]),
    time: hours ? `${at(hours[0])} – ${at(hours[1])}` : closedLabel,
  }));
}
