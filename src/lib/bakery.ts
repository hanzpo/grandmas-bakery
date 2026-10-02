// Shop details shown on the public site.
export const BAKERY = {
  address: "280 Lester St, Waterloo, ON",
  phone: "(236) 242-3768",
  phoneHref: "tel:+12362423768",
  mapsEmbed: "https://www.google.com/maps?q=280+Lester+St,+Waterloo,+ON&output=embed",
  mapsLink: "https://www.google.com/maps/search/?api=1&query=280+Lester+St,+Waterloo,+ON",
  // Index = Date.getDay() (0 = Sunday). null = closed.
  hours: [
    ["8 AM", "2 PM"],
    null,
    ["7 AM", "6 PM"],
    ["7 AM", "6 PM"],
    ["7 AM", "6 PM"],
    ["7 AM", "7 PM"],
    ["7 AM", "5 PM"],
  ] as ([string, string] | null)[],
  hoursSummary: "Tue–Fri 7–6 · Sat 7–5 · Sun 8–2 · Closed Mon",
};

export function todaysHours(date = new Date()) {
  const h = BAKERY.hours[date.getDay()];
  return h ? `Open today · ${h[0]} – ${h[1]}` : "Closed today · back tomorrow";
}
