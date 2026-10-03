import { supabase } from "../../../lib/supabase";
import type { PriceCheck } from "./priceCheckApi";

// Fake price checks for building the UI before the scraper exists (VITE_PRICE_CHECK_MOCK=1).
// Uses your real suppliers and last-paid costs, finishes one store every few seconds,
// and misses the odd item. Safe to delete once the real pipeline is hooked up.

const checks = new Map<string, { check: PriceCheck; cost: Map<string, number> }>();

/** Stable 0..1 from a string, so the same store/ingredient always gets the same price. */
function rand(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

export async function mockStartPriceCheck(items: PriceCheck["items"]): Promise<PriceCheck> {
  const [suppliers, ingredients] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("ingredients").select("id, cost_per_unit_cents"),
  ]);
  if (suppliers.error) throw suppliers.error;
  if (ingredients.error) throw ingredients.error;
  const check: PriceCheck = {
    id: crypto.randomUUID(),
    status: "queued",
    created_at: new Date().toISOString(),
    items,
    stores: suppliers.data.map((s) => ({ supplier_id: s.id, name: s.name, status: "waiting" })),
    quotes: [],
  };
  checks.set(check.id, { check, cost: new Map(ingredients.data.map((i) => [i.id, Number(i.cost_per_unit_cents) || 1])) });
  return check;
}

export async function mockGetPriceCheck(id: string): Promise<PriceCheck> {
  const entry = checks.get(id);
  if (!entry) throw new Error("That price check is gone. Start a new one.");
  const { check, cost } = entry;
  const elapsed = (Date.now() - new Date(check.created_at).getTime()) / 1000;
  const stores = check.stores.map((s, i) => {
    const finishAt = 4 + i * 3;
    if (elapsed < 1.5) return s;
    if (elapsed < finishAt) return { ...s, status: "checking" as const };
    if (rand(`fail${s.supplier_id}`) < 0.1) return { ...s, status: "failed" as const, error: "The website wouldn't load." };
    return { ...s, status: "done" as const };
  });
  const quotes = stores
    .filter((s) => s.status === "done")
    .flatMap((s) =>
      check.items.map((item) => {
        const r = rand(s.supplier_id + item.ingredient_id);
        const found = r > 0.08;
        return {
          supplier_id: s.supplier_id,
          ingredient_id: item.ingredient_id,
          unit_price_cents: found ? (cost.get(item.ingredient_id) ?? 1) * (0.75 + r * 0.55) : null,
          in_stock: found && r > 0.15,
          product_name: found ? `${s.name} house brand` : null,
          pack_label: null,
          url: null,
        };
      }),
    );
  const finished = stores.every((s) => s.status === "done" || s.status === "failed");
  return { ...check, status: finished ? "done" : elapsed < 1.5 ? "queued" : "running", stores, quotes };
}
