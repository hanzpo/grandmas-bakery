import { Hono } from "hono";
import { z } from "zod";
import { adminDb, priceItems, upsertCustomer } from "../lib";

/**
 * ElevenLabs calls POST /order after Grandma confirms a pickup order.
 * The order is written as source `voice_agent` and status `new` (pay at pickup).
 * Inventory deduction runs when the status moves to `new`, so items are inserted first.
 */
const OrderBody = z.object({
  customer_name: z.string().trim().min(1).max(100),
  items: z
    .array(z.object({ name: z.string().trim().min(1).max(80), quantity: z.number().int().min(1).max(30) }))
    .min(1)
    .max(20),
  phone: z.string().trim().max(30).optional(),
  pickup_at: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  conversation_id: z.string().trim().max(80).optional(),
});

const PLACEHOLDER_NAMES = new Set(["dear", "dearie", "sweetheart", "honey", "friend"]);

export const voice = new Hono<{ Bindings: Env }>().post("/order", async (c) => {
  if (!authorized(c.env.ELEVENLABS_TOOL_SECRET, c.req.header("x-voice-secret"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const parsed = OrderBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
  const body = parsed.data;

  if (PLACEHOLDER_NAMES.has(body.customer_name.toLowerCase())) {
    return c.json({ error: "Ask for the customer's real name, then call place_order again." }, 400);
  }

  const db = adminDb(c.env);

  if (body.conversation_id) {
    const { data: existing, error } = await db
      .from("orders")
      .select("order_number, total_cents, notes")
      .eq("voice_call_id", body.conversation_id)
      .neq("status", "cancelled")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (existing) {
      return c.json({
        order_number: existing.order_number,
        total: dollars(existing.total_cents),
        already_placed: true,
      });
    }
  }

  const { data: products, error: menuError } = await db
    .from("products")
    .select("id, name")
    .eq("is_active", true);
  if (menuError) throw menuError;

  const resolved: { product_id: string; quantity: number }[] = [];
  for (const item of body.items) {
    const match = matchProduct(products, item.name);
    if (!match.ok) return c.json({ error: match.error }, 400);
    resolved.push({ product_id: match.product.id, quantity: item.quantity });
  }

  const { lines, subtotal } = await priceItems(db, resolved);
  const pickup = parsePickup(body.pickup_at);
  const notes = [body.notes, pickup ? null : body.pickup_at ? `Pickup: ${body.pickup_at}` : null]
    .filter(Boolean)
    .join("\n");
  const customerId = await upsertCustomer(db, { name: body.customer_name, phone: body.phone });

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      customer_id: customerId,
      source: "voice_agent",
      status: "pending_payment",
      pickup_at: pickup,
      subtotal_cents: subtotal,
      total_cents: subtotal,
      notes: notes || null,
      voice_call_id: body.conversation_id || null,
    })
    .select("id, order_number")
    .single();
  if (orderError) throw orderError;

  const { error: itemsError } = await db.from("order_items").insert(
    lines.map((line) => ({
      order_id: order.id,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_price_cents: line.unit_price_cents,
    })),
  );
  if (itemsError) {
    await db.from("orders").delete().eq("id", order.id);
    throw itemsError;
  }

  const { error: acceptError } = await db.from("orders").update({ status: "new" }).eq("id", order.id);
  if (acceptError) throw acceptError;

  return c.json({
    order_number: order.order_number,
    customer_name: body.customer_name,
    total: dollars(subtotal),
    items: lines.map((line) => ({ name: line.name, quantity: line.quantity })),
    pickup_at: pickup,
  });
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

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function parsePickup(value: string | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

function matchProduct(products: { id: string; name: string }[], spoken: string) {
  const needle = normalize(spoken);
  const exact = products.filter((product) => normalize(product.name) === needle);
  const hits = exact.length ? exact : products.filter((product) => {
    const name = normalize(product.name);
    return name.includes(needle) || needle.includes(name);
  });
  if (hits.length === 1) return { ok: true as const, product: hits[0]! };
  const names = products.map((product) => product.name).join(", ");
  const error = hits.length === 0
    ? `"${spoken}" is not on the menu. Available: ${names}.`
    : `"${spoken}" matches more than one item (${hits.map((product) => product.name).join(", ")}). Ask which one.`;
  return { ok: false as const, error };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
