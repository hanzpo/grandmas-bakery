import { createClient } from "@supabase/supabase-js";
import type { MiddlewareHandler } from "hono";
import Stripe from "stripe";
import type { Database } from "../shared/database.types";

/** Service-role client: bypasses RLS. Only use for trusted server-side writes. */
export function adminDb(env: Env) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function stripe(env: Env) {
  return new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
}

/**
 * Find a customer by email (or by phone when there's no email, e.g. voice orders), or create
 * one. Checkout is unauthenticated, so a phone already on file never links an emailed order to
 * that record (or rewrites it): the order gets its own customer, without the phone (it's unique).
 */
export async function upsertCustomer(
  db: ReturnType<typeof adminDb>,
  c: { name: string; email?: string | null; phone?: string | null; marketing_opt_in?: boolean },
) {
  const email = c.email?.trim().toLowerCase() || null;
  let phone = c.phone?.trim() || null;
  const find = async (column: "email" | "phone", value: string) => {
    const { data, error } = await db.from("customers").select("id").eq(column, value).maybeSingle();
    if (error) throw error;
    return data;
  };

  const existing = email ? await find("email", email) : phone ? await find("phone", phone) : null;
  if (existing) {
    // A returning customer ticking "send me specials" subscribes them (never unsubscribes).
    if (c.marketing_opt_in) {
      const { error } = await db.from("customers").update({ marketing_opt_in: true }).eq("id", existing.id);
      if (error) throw error;
    }
    return existing.id;
  }
  if (email && phone && (await find("phone", phone))) phone = null;
  const { data, error } = await db
    .from("customers")
    .insert({ name: c.name, email, phone, marketing_opt_in: c.marketing_opt_in ?? false })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Price an order from the DB (never trust client prices). */
export async function priceItems(
  db: ReturnType<typeof adminDb>,
  items: { product_id: string; quantity: number }[],
) {
  const ids = [...new Set(items.map((i) => i.product_id))];
  const { data: products, error } = await db
    .from("products")
    .select("id, name, price_cents, is_active")
    .in("id", ids);
  if (error) throw error;
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = items.map((i) => {
    const p = byId.get(i.product_id);
    if (!p || !p.is_active) throw new Error(`Product ${i.product_id} is not available`);
    return { ...i, name: p.name, unit_price_cents: p.price_cents };
  });
  const subtotal = lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);
  return { lines, subtotal };
}

/** Constant-time compare for shared-secret webhook headers. False when either side is missing. */
export function authorized(expected: string | undefined, got: string | undefined) {
  if (!expected || !got) return false;
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(got);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Supabase errors are plain objects, not `Error`s; Hono's onError only handles `Error`s. */
export function toError(e: unknown) {
  if (e instanceof Error) return e;
  const message = typeof e === "object" && e && "message" in e ? String(e.message) : String(e);
  return new Error(message);
}

/** Rethrow anything that isn't an Error (e.g. a Supabase error) as one, so onError answers JSON. */
export const normalizeErrors: MiddlewareHandler = async (_c, next) => {
  try {
    await next();
  } catch (e) {
    throw toError(e);
  }
};
