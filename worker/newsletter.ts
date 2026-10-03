import type { adminDb } from "./lib";

type Db = ReturnType<typeof adminDb>;

export const SITE = "https://getgrandma.com";
const FROM = { email: "grandma@getgrandma.com", name: "Grandma's Bakery" };
const ADDRESS = "280 Lester St, Waterloo, ON";
const PHONE = "(236) 242-3768";
const HOURS = "Tue–Thu 7–6 · Fri 7–7 · Sat 7–5 · Sun 8–2 · Closed Mon";

type Item = { name: string; description: string | null; price_cents: number; image_url: string | null; slug: string };

export interface Newsletter {
  subject: string;
  /** HTML with an {{UNSUBSCRIBE_URL}} placeholder, filled per recipient. */
  html: string;
  text: string;
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const img = (url: string | null) => (url ? (url.startsWith("http") ? url : `${SITE}${url}`) : null);

export const DEFAULT_NOTE =
  "Hello, dears! The ovens have been busy this week. Here's what's fresh, what's new, and what I'd save a spoon for. Come say hi, or order ahead and it'll be waiting for you, still warm.";

/** This week's issue: flavor of the month, what's new, and Grandma's picks. */
export async function buildNewsletter(db: Db, note?: string): Promise<Newsletter> {
  const { data: products, error } = await db
    .from("products")
    .select("name, description, price_cents, image_url, slug, is_flavor_of_month, created_at, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;

  const featured = products.find((p) => p.is_flavor_of_month) ?? products[0];
  const twoWeeksAgo = Date.now() - 14 * 86400_000;
  let fresh = products.filter((p) => p !== featured && new Date(p.created_at).getTime() > twoWeeksAgo);

  // Best sellers make good "Grandma's picks" when nothing is brand new.
  const { data: sales } = await db.from("product_sales").select("name, units").order("units", { ascending: false }).limit(6);
  const ranked = (sales ?? []).map((s) => products.find((p) => p.name === s.name)).filter((p): p is (typeof products)[number] => !!p && p !== featured);
  const picks = (fresh.length >= 3 ? fresh : [...fresh, ...ranked, ...products.filter((p) => p !== featured)])
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .slice(0, 3);
  fresh = fresh.slice(0, 3);

  const date = new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric", timeZone: "America/Toronto" });
  const subject = featured ? `Fresh this week: ${featured.name} 🥐` : "Fresh this week at Grandma's";
  const body = (note?.trim() || DEFAULT_NOTE).trim();
  const heading = fresh.length ? "New on the menu" : "Grandma's picks this week";

  return {
    subject,
    html: renderHtml({ date, body, featured, picks, heading }),
    text: renderText({ date, body, featured, picks, heading }),
  };
}

function card(p: Item) {
  const src = img(p.image_url);
  return `
  <td width="33%" valign="top" style="padding:6px">
    <a href="${SITE}/#menu" style="text-decoration:none;color:#4A2E22">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid #E8DDCC;border-radius:18px">
        <tr><td style="padding:8px">
          ${src ? `<img src="${esc(src)}" width="100%" alt="${esc(p.name)}" style="display:block;width:100%;height:auto;border-radius:12px">` : ""}
        </td></tr>
        <tr><td style="padding:2px 12px 12px;font-family:Nunito,Arial,sans-serif">
          <div style="font-size:15px;font-weight:800;line-height:1.25">${esc(p.name)}</div>
          <div style="font-size:14px;font-weight:800;color:#D4335A;margin-top:4px">${money(p.price_cents)}</div>
        </td></tr>
      </table>
    </a>
  </td>`;
}

function renderHtml({ date, body, featured, picks, heading }: { date: string; body: string; featured?: Item; picks: Item[]; heading: string }) {
  const hero = featured && img(featured.image_url);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grandma's Bakery</title></head>
<body style="margin:0;background:#FFFDF8;color:#4A2E22">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFDF8">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:Nunito,Arial,sans-serif">

  <tr><td style="padding:0 8px 16px">
    <span style="font-size:22px;font-weight:900">Grandma's <span style="color:#D4335A">Bakery</span></span>
    <span style="float:right;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8A6A58;line-height:30px">${esc(date)}</span>
  </td></tr>

  <tr><td style="background:#FFF1CC;border-radius:24px;padding:24px 26px">
    <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8A6A58">A note from Grandma</div>
    <p style="margin:8px 0 0;font-size:17px;line-height:1.55;font-weight:600">${esc(body).replace(/\n/g, "<br>")}</p>
  </td></tr>

  ${
    featured
      ? `<tr><td style="padding-top:22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid #E8DDCC;border-radius:24px">
      ${hero ? `<tr><td style="padding:10px 10px 0"><img src="${esc(hero)}" width="100%" alt="${esc(featured.name)}" style="display:block;width:100%;height:auto;border-radius:16px"></td></tr>` : ""}
      <tr><td style="padding:18px 22px 22px">
        <div style="display:inline-block;background:#FFF1CC;color:#9A7206;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;border-radius:8px;padding:4px 9px">Flavor of the month</div>
        <div style="font-size:26px;font-weight:900;margin-top:10px">${esc(featured.name)} <span style="color:#D4335A">${money(featured.price_cents)}</span></div>
        ${featured.description ? `<p style="margin:6px 0 16px;font-size:16px;line-height:1.5;color:#8A6A58;font-weight:700">${esc(featured.description)}</p>` : ""}
        <a href="${SITE}/#menu" style="display:inline-block;background:#D4335A;color:#ffffff;text-decoration:none;font-weight:900;letter-spacing:.08em;text-transform:uppercase;font-size:15px;border-radius:16px;padding:14px 26px;border-bottom:4px solid #A52342">Order for pickup</a>
      </td></tr>
    </table>
  </td></tr>`
      : ""
  }

  ${
    picks.length
      ? `<tr><td style="padding:26px 2px 4px;font-size:22px;font-weight:900">${esc(heading)}</td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${picks.map(card).join("")}</tr></table></td></tr>`
      : ""
  }

  <tr><td style="padding-top:22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6EFE4;border-radius:24px">
      <tr><td style="padding:20px 24px;font-size:15px;line-height:1.6;font-weight:700">
        <div style="font-size:18px;font-weight:900">Come say hi</div>
        ${ADDRESS}<br>${HOURS}<br>Call or text <a href="tel:+12362423768" style="color:#2672C9;font-weight:900;text-decoration:none">${PHONE}</a>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 8px;font-size:12px;line-height:1.6;color:#8A6A58;font-weight:700;text-align:center">
    You're getting this because you asked for Grandma's specials when you ordered.<br>
    Grandma's Bakery · ${ADDRESS}<br>
    <a href="{{UNSUBSCRIBE_URL}}" style="color:#8A6A58">Unsubscribe</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function renderText({ date, body, featured, picks, heading }: { date: string; body: string; featured?: Item; picks: Item[]; heading: string }) {
  return [
    `GRANDMA'S BAKERY · ${date}`,
    "",
    body,
    "",
    featured ? `FLAVOR OF THE MONTH: ${featured.name} (${money(featured.price_cents)})\n${featured.description ?? ""}\nOrder for pickup: ${SITE}` : "",
    "",
    picks.length ? `${heading.toUpperCase()}:\n${picks.map((p) => `- ${p.name} (${money(p.price_cents)})`).join("\n")}` : "",
    "",
    `Come say hi: ${ADDRESS} · ${HOURS} · ${PHONE}`,
    "",
    `Unsubscribe: {{UNSUBSCRIBE_URL}}`,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
}

export const unsubscribeUrl = (token: string) => `${SITE}/api/newsletter/unsubscribe?token=${token}`;

/** Send one personalized copy. Sending is isolated here so bulk sends can move to a marketing provider later. */
export async function sendOne(env: Env, nl: Newsletter, to: { email: string; name?: string | null }, token: string | null) {
  const url = token ? unsubscribeUrl(token) : `${SITE}`;
  return env.EMAIL.send({
    to: to.name ? { email: to.email, name: to.name } : to.email,
    from: FROM,
    subject: nl.subject,
    html: nl.html.replaceAll("{{UNSUBSCRIBE_URL}}", url),
    text: nl.text.replaceAll("{{UNSUBSCRIBE_URL}}", url),
    headers: token ? { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
  });
}
