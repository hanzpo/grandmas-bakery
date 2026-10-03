import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { mockGetPriceCheck, mockStartPriceCheck } from "./priceCheckMock";

/**
 * Online price checks: a browser automation looks up what each store charges for a restock
 * list, so Grandma can order the whole list from the best one. The scraper runs outside the
 * Worker; the Worker only fronts it. This file is the app's whole contract with it.
 *
 *   POST /api/price-checks       `Authorization: Bearer <supabase access token>` (staff only)
 *     { items: [{ ingredient_id, quantity }] }                      → 202 { check: PriceCheck }
 *   GET  /api/price-checks/:id   same auth                          → 200 { check: PriceCheck }
 *
 * The page polls GET every few seconds until `status` is "done" or "failed", so stores and
 * quotes can fill in as the scraper finishes each one. Until the routes exist they 404, and the
 * page says "not connected yet". Each store is a `suppliers` row (the scraper can use
 * `suppliers.website`), so "Order from here" can open a normal supplier order. The Worker should
 * also append what it finds to `supplier_prices`, which feeds Suppliers → Compare prices.
 *
 * Set VITE_PRICE_CHECK_MOCK=1 in .env.local to fake it in the browser against your real suppliers.
 */
export type PriceCheckStatus = "queued" | "running" | "done" | "failed";

export type PriceCheck = {
  id: string;
  status: PriceCheckStatus;
  created_at: string;
  /** Shown to Grandma when status is "failed". */
  error?: string | null;
  items: { ingredient_id: string; quantity: number }[];
  stores: {
    supplier_id: string;
    name: string;
    status: "waiting" | "checking" | "done" | "failed";
    error?: string | null;
  }[];
  quotes: {
    supplier_id: string;
    ingredient_id: string;
    /** Per ingredient unit (ingredients.unit), fractional cents allowed. Null when not found. */
    unit_price_cents: number | null;
    in_stock: boolean;
    /** What the scraper matched, e.g. "Organic Valley Heavy Cream". */
    product_name?: string | null;
    /** e.g. "1 qt · $5.49" */
    pack_label?: string | null;
    url?: string | null;
  }[];
};

const MOCK = import.meta.env.VITE_PRICE_CHECK_MOCK === "1";

export const isRunning = (check: PriceCheck | undefined) =>
  check?.status === "queued" || check?.status === "running";

async function call(path: string, init?: RequestInit): Promise<PriceCheck> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/price-checks${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
  });
  const body = (await res.json().catch(() => ({}))) as { check?: PriceCheck; error?: string };
  if (res.status === 404 && !path) throw new Error("Online price checking isn't connected yet.");
  if (!res.ok || !body.check) throw new Error(body.error || "Couldn't check prices. Try again in a bit.");
  return body.check;
}

export function useStartPriceCheck() {
  return useMutation({
    mutationFn: (items: PriceCheck["items"]) =>
      MOCK ? mockStartPriceCheck(items) : call("", { method: "POST", body: JSON.stringify({ items }) }),
  });
}

export function usePriceCheck(id: string | null) {
  return useQuery({
    queryKey: ["price_check", id],
    enabled: !!id,
    queryFn: () => (MOCK ? mockGetPriceCheck(id!) : call(`/${id}`)),
    refetchInterval: (q) => (isRunning(q.state.data) ? 3000 : false),
  });
}
