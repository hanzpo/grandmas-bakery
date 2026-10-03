import { createClient } from "@supabase/supabase-js";
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

/** Find a customer by email/phone, or create one. */
export async function upsertCustomer(
  db: ReturnType<typeof adminDb>,
  c: { name: string; email?: string | null; phone?: string | null; marketing_opt_in?: boolean },
) {
  const email = c.email?.trim().toLowerCase() || null;
  const phone = c.phone?.trim() || null;
  if (email || phone) {
    const filter = [email && `email.eq.${email}`, phone && `phone.eq.${phone}`].filter(Boolean).join(",");
    const { data: existing } = await db.from("customers").select("id").or(filter).limit(1).maybeSingle();
    if (existing) {
      // A returning customer ticking "send me specials" subscribes them (never unsubscribes).
      if (c.marketing_opt_in) await db.from("customers").update({ marketing_opt_in: true }).eq("id", existing.id);
      return existing.id;
    }
  }
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
