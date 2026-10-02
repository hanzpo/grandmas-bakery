import { Hono } from "hono";
import { z } from "zod";
import { adminDb } from "../lib";
import { confirmSupplyOrder, recordQuote, startReclaim } from "../supply";

const QuoteBody = z.object({
  run_id: z.uuid(),
  supplier_id: z.uuid(),
  conversation_id: z.string().trim().min(1).max(80),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        available: z.boolean(),
        price: z.number().min(0).nullish(),
      }),
    )
    .min(1)
    .max(40),
});

const OrderBody = z.object({
  run_id: z.uuid(),
  supplier_id: z.uuid(),
  conversation_id: z.string().trim().min(1).max(80),
});

export const supply = new Hono<{ Bindings: Env }>();

supply.post("/poll", async (c) => {
  if (!authorized(c.env.ELEVENLABS_TOOL_SECRET, c.req.header("x-voice-secret"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = adminDb(c.env);
  const { data, error } = await db.from("supply_settings").select("polling_enabled").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data?.polling_enabled) {
    return c.json({ started: false, reason: "polling is off", run: null });
  }
  return c.json(await startReclaim(c.env, "poll"));
});

supply.post("/reclaim", async (c) => {
  const token = /^Bearer\s+(\S+)/i.exec(c.req.header("authorization") ?? "")?.[1];
  if (!token) return c.json({ error: "Sign in required." }, 401);
  const db = adminDb(c.env);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return c.json({ error: "Sign in required." }, 401);
  const staff = await db.from("staff").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (staff.error) throw staff.error;
  if (!staff.data) return c.json({ error: "Staff only." }, 403);
  return c.json(await startReclaim(c.env, "manual"));
});

supply.post("/quote", async (c) => {
  if (!authorized(c.env.ELEVENLABS_TOOL_SECRET, c.req.header("x-voice-secret"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const parsed = QuoteBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ recorded: false, error: z.prettifyError(parsed.error) }, 400);
  const result = await recordQuote(c.env, parsed.data);
  if (!result.ok) return c.json({ recorded: false, error: result.error }, result.status);
  return c.json(result.body);
});

supply.post("/order", async (c) => {
  if (!authorized(c.env.ELEVENLABS_TOOL_SECRET, c.req.header("x-voice-secret"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const parsed = OrderBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ placed: false, error: z.prettifyError(parsed.error) }, 400);
  const result = await confirmSupplyOrder(c.env, parsed.data);
  if (!result.ok) return c.json({ placed: false, error: result.error }, result.status);
  return c.json(result.body);
});

function authorized(expected: string | undefined, got: string | undefined) {
  if (!expected || !got) return false;
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(got);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
