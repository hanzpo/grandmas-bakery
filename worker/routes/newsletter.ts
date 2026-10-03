import { Hono, type Context } from "hono";
import { z } from "zod";
import { adminDb } from "../lib";
import { buildNewsletter, sendOne, SITE } from "../newsletter";

type C = Context<{ Bindings: Env }>;

/** Staff session check (admin pages pass their Supabase access token). Returns the user id or a Response. */
async function staffUser(c: C): Promise<string | Response> {
  const token = /^Bearer\s+(\S+)/i.exec(c.req.header("authorization") ?? "")?.[1];
  if (!token) return c.json({ error: "Please sign in again." }, 401);
  const db = adminDb(c.env);
  const { data } = await db.auth.getUser(token);
  if (!data.user) return c.json({ error: "Please sign in again." }, 401);
  const { data: staff } = await db.from("staff").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!staff) return c.json({ error: "Staff only." }, 403);
  return data.user.id;
}

const Note = z.object({ note: z.string().max(2000).optional() });

async function subscribers(env: Env) {
  const { data, error } = await adminDb(env)
    .from("customers")
    .select("id, name, email, unsubscribe_token")
    .eq("marketing_opt_in", true)
    .not("email", "is", null);
  if (error) throw error;
  return data.filter((s) => s.email);
}

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="margin:0;background:#FFFDF8;color:#4A2E22;font-family:Nunito,Arial,sans-serif;display:grid;place-items:center;min-height:100vh">
<div style="max-width:420px;padding:32px;text-align:center;background:#fff;border:2px solid #E8DDCC;border-radius:24px">
<div style="font-size:22px;font-weight:900">Grandma's <span style="color:#D4335A">Bakery</span></div>
<p style="font-size:17px;font-weight:700;line-height:1.5">${body}</p>
<a href="${SITE}" style="color:#2672C9;font-weight:900">Back to the bakery</a></div></body>`;

export const newsletter = new Hono<{ Bindings: Env }>()
  // This week's issue + subscriber count, for the admin preview.
  .post("/preview", async (c) => {
    const user = await staffUser(c);
    if (user instanceof Response) return user;
    const { note } = Note.parse(await c.req.json().catch(() => ({})));
    const nl = await buildNewsletter(adminDb(c.env), note);
    const subs = await subscribers(c.env);
    return c.json({ subject: nl.subject, html: nl.html.replaceAll("{{UNSUBSCRIBE_URL}}", "#"), subscribers: subs.length });
  })

  .post("/test", async (c) => {
    const user = await staffUser(c);
    if (user instanceof Response) return user;
    const body = Note.extend({ to: z.email() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Enter a valid email address." }, 400);
    const nl = await buildNewsletter(adminDb(c.env), body.data.note);
    try {
      await sendOne(c.env, { ...nl, subject: `[Test] ${nl.subject}` }, { email: body.data.to }, null);
    } catch (e) {
      return c.json({ error: sendError(e) }, 502);
    }
    return c.json({ ok: true });
  })

  // Send to every opted-in customer, one personalized copy each (own unsubscribe link).
  .post("/send", async (c) => {
    const user = await staffUser(c);
    if (user instanceof Response) return user;
    const { note } = Note.parse(await c.req.json().catch(() => ({})));
    const db = adminDb(c.env);
    const nl = await buildNewsletter(db, note);
    const subs = await subscribers(c.env);
    if (!subs.length) return c.json({ error: "No subscribers yet." }, 400);

    let sent = 0;
    const errors: string[] = [];
    for (const s of subs) {
      try {
        await sendOne(c.env, nl, { email: s.email!, name: s.name }, s.unsubscribe_token);
        sent++;
      } catch (e) {
        errors.push(sendError(e));
      }
    }
    await db.from("newsletter_issues").insert({ subject: nl.subject, note: note ?? null, recipients: sent, failed: errors.length, sent_by: user });
    if (!sent) return c.json({ error: errors[0] ?? "Nothing was sent." }, 502);
    return c.json({ sent, failed: errors.length });
  })

  // One-click unsubscribe: GET from the email link, POST from mail apps (RFC 8058).
  .on(["GET", "POST"], "/unsubscribe", async (c) => {
    const token = c.req.query("token") ?? "";
    if (!z.guid().safeParse(token).success) return c.html(page("Unsubscribe", "That unsubscribe link doesn't look right."), 400);
    await adminDb(c.env).from("customers").update({ marketing_opt_in: false }).eq("unsubscribe_token", token);
    return c.html(page("Unsubscribed", "You're unsubscribed. Grandma will miss you, but you're always welcome at the counter."));
  });

function sendError(e: unknown) {
  const err = e as { code?: string; message?: string };
  if (/not (verified|onboarded|enabled)|domain/i.test(err.message ?? "")) {
    return "Email sending isn't set up for getgrandma.com yet (Cloudflare → Email → Email Sending).";
  }
  return err.message ?? "Couldn't send the email.";
}
