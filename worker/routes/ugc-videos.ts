import { Hono } from "hono";
import { z } from "zod";
import { adminDb, authorized } from "../lib";

/**
 * UGC marketing videos. Staff send a one-line brief; this route wraps it in the creative
 * prompt below (kept server-side so the admin never sees or edits it), records a
 * `ugc_videos` row and hands the job to the external video pipeline.
 *
 * Pipeline contract:
 *   → POST UGC_PIPELINE_URL, `Authorization: Bearer UGC_PIPELINE_SECRET`
 *     { job_id, brief, system_prompt, prompt, callback_url }
 *   ← POST /api/ugc-videos/callback, `x-ugc-secret: UGC_PIPELINE_SECRET`
 *     { job_id, status: "generating" | "ready" | "failed", video_url?, thumbnail_url?, error? }
 */
const SYSTEM_PROMPT = `You write and direct short, vertical (9:16) user-generated-content style videos for Grandma's Bakery, a small family parfait shop run by one grandmother.

Style:
- Feels like a real customer filmed it on their phone: handheld, natural light, casual voiceover or on-screen captions, no studio polish.
- 15 to 30 seconds. Hook in the first 2 seconds, then show the parfait up close (layers, spoon dig, first bite reaction), end with a soft call to action to order for pickup at getgrandma.com.
- Warm, cozy, homemade tone. Celebrate Grandma and her recipes; never mock her or make her the punchline.

Rules:
- Only feature items from the menu below, by their real names. Don't invent products, prices, discounts or health claims.
- No other brands, logos, celebrities or copyrighted music.
- Keep it family-friendly.`;

const CreateBody = z.object({ brief: z.string().trim().min(3).max(500) });

const CallbackBody = z.object({
  job_id: z.guid(),
  status: z.enum(["generating", "ready", "failed"]),
  video_url: z.url().optional(),
  thumbnail_url: z.url().optional(),
  error: z.string().max(1000).optional(),
});

export const ugcVideos = new Hono<{ Bindings: Env }>()
  .post("/", async (c) => {
    const db = adminDb(c.env);

    // Admin pages talk to Supabase directly; this is the one admin call that needs the Worker,
    // so check the caller's session and staff row here.
    const token = c.req.header("authorization")?.replace(/^Bearer /i, "");
    const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!auth.user) return c.json({ error: "Please sign in again." }, 401);
    const { data: staff } = await db.from("staff").select("user_id").eq("user_id", auth.user.id).maybeSingle();
    if (!staff) return c.json({ error: "Not on the staff list." }, 403);

    const parsed = CreateBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Tell us a bit more about the video (at least a few words)." }, 400);
    const { brief } = parsed.data;

    if (!c.env.UGC_PIPELINE_URL || !c.env.UGC_PIPELINE_SECRET) {
      return c.json({ error: "The video maker isn't connected yet." }, 503);
    }

    const { data: products, error: menuError } = await db
      .from("products")
      .select("name, description, price_cents")
      .eq("is_active", true)
      .order("sort_order");
    if (menuError) throw menuError;
    const menu = products
      .map((p) => `- ${p.name} ($${(p.price_cents / 100).toFixed(2)})${p.description ? `: ${p.description}` : ""}`)
      .join("\n");

    const { data: video, error } = await db
      .from("ugc_videos")
      .insert({ brief, created_by: auth.user.id })
      .select("*")
      .single();
    if (error) throw error;

    const res = await fetch(c.env.UGC_PIPELINE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.env.UGC_PIPELINE_SECRET}` },
      body: JSON.stringify({
        job_id: video.id,
        brief,
        system_prompt: `${SYSTEM_PROMPT}\n\nMenu:\n${menu}`,
        prompt: `Make a UGC video about: ${brief}`,
        callback_url: `${new URL(c.req.url).origin}/api/ugc-videos/callback`,
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch((e: unknown) => e as Error);

    if (res instanceof Error || !res.ok) {
      const reason = res instanceof Error ? res.message : `Pipeline responded ${res.status}`;
      console.error("ugc pipeline:", reason);
      const { data: failed } = await db
        .from("ugc_videos")
        .update({ status: "failed", error: "The video maker didn't pick this up. Try again in a bit.", updated_at: new Date().toISOString() })
        .eq("id", video.id)
        .select("*")
        .single();
      return c.json({ video: failed ?? video }, 502);
    }

    const accepted = (await res.json().catch(() => ({}))) as { id?: unknown };
    const { data: started } = await db
      .from("ugc_videos")
      .update({
        status: "generating",
        external_id: typeof accepted.id === "string" ? accepted.id : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", video.id)
      .eq("status", "queued") // the callback may already have landed
      .select("*")
      .maybeSingle();
    return c.json({ video: started ?? video });
  })

  .post("/callback", async (c) => {
    if (!authorized(c.env.UGC_PIPELINE_SECRET, c.req.header("x-ugc-secret"))) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const parsed = CallbackBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
    const body = parsed.data;
    if (body.status === "ready" && !body.video_url) return c.json({ error: "video_url is required when ready" }, 400);

    const { data, error } = await adminDb(c.env)
      .from("ugc_videos")
      .update({
        status: body.status,
        video_url: body.video_url ?? null,
        thumbnail_url: body.thumbnail_url ?? null,
        error: body.status === "failed" ? (body.error ?? "Something went wrong making this video.") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.job_id)
      .neq("status", "ready") // a finished video doesn't go back
      .select("id");
    if (error) throw error;
    return c.json({ ok: true, updated: data.length > 0 });
  });
