import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { isoDay, money, shortDate } from "../../../lib/format";
import { supabase, type Tables } from "../../../lib/supabase";
import { num, qty, useIngredients, useSuppliers } from "../inventory/shared";

/** Key the Inventory → Orders tab reads to prefill a new ingredient order. */
export const DRAFT_KEY = "draft-supplier-order";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Earliest delivery if ordered today: lead time, then the supplier's next delivery day. */
function deliveryDate(s: Tables<"suppliers">) {
  const d = new Date();
  d.setDate(d.getDate() + (s.lead_time_days ?? 1));
  if (s.delivery_days.length) {
    for (let i = 0; i < 7 && !s.delivery_days.includes(DAYS[d.getDay()]); i++) d.setDate(d.getDate() + 1);
  }
  return isoDay(d);
}

type Option = { supplier: Tables<"suppliers">; deliversOn: string; priceCents: number; inTime: boolean };

export default function Feasibility({
  lines,
  pickupAt,
}: {
  lines: { product_id: string; quantity: number }[];
  pickupAt: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const pickupDay = pickupAt ? pickupAt.slice(0, 10) : isoDay();

  const { data: ingredients } = useIngredients();
  const { data: suppliers } = useSuppliers();

  const recipes = useQuery({
    queryKey: ["recipe_items", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipe_items").select("product_id, ingredient_id, quantity");
      if (error) throw error;
      return data;
    },
  });

  const incoming = useQuery({
    queryKey: ["supplier_orders", "incoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_orders")
        .select("expected_on, supplier_order_items(ingredient_id, quantity)")
        .eq("status", "ordered")
        .not("expected_on", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const prices = useQuery({
    queryKey: ["supplier_prices", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_prices")
        .select("supplier_id, ingredient_id, price_cents, effective_on")
        .order("effective_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Total ingredient needs for the order lines.
  const needs = new Map<string, number>();
  for (const l of lines) {
    if (!l.product_id || !(l.quantity > 0)) continue;
    for (const r of recipes.data ?? []) {
      if (r.product_id === l.product_id) needs.set(r.ingredient_id, (needs.get(r.ingredient_id) ?? 0) + num(r.quantity) * l.quantity);
    }
  }
  const hasLines = lines.some((l) => l.product_id && l.quantity > 0);
  if (!hasLines || (needs.size === 0 && !recipes.isLoading)) return null;

  // Deliveries already ordered that land by pickup day: ingredient → { qty, latest date }.
  const arriving = new Map<string, { qty: number; on: string }>();
  for (const o of incoming.data ?? []) {
    if (!o.expected_on || o.expected_on > pickupDay) continue;
    for (const i of o.supplier_order_items) {
      const prev = arriving.get(i.ingredient_id);
      arriving.set(i.ingredient_id, {
        qty: (prev?.qty ?? 0) + num(i.quantity),
        on: prev && prev.on > o.expected_on ? prev.on : o.expected_on,
      });
    }
  }

  // Latest quote per supplier+ingredient (rows are newest first).
  const quotes = new Map<string, Map<string, number>>();
  for (const p of prices.data ?? []) {
    const bySupplier = quotes.get(p.ingredient_id) ?? new Map<string, number>();
    if (!bySupplier.has(p.supplier_id)) bySupplier.set(p.supplier_id, num(p.price_cents));
    quotes.set(p.ingredient_id, bySupplier);
  }

  const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s]));

  const rows = [...needs.entries()]
    .map(([id, needed]) => {
      const ing = ingredients?.find((i) => i.id === id);
      const onHand = num(ing?.quantity_on_hand);
      const arr = arriving.get(id);
      const short = Math.max(0, needed - onHand - (arr?.qty ?? 0));

      let best: Option | null = null;
      if (short > 0 && ing) {
        const quoted = quotes.get(id);
        const candidates: [string, number][] = quoted?.size
          ? [...quoted.entries()]
          : ing.preferred_supplier_id
            ? [[ing.preferred_supplier_id, num(ing.cost_per_unit_cents)]]
            : [];
        const options = candidates
          .map(([sid, priceCents]) => supplierById.get(sid) && { supplier: supplierById.get(sid)!, priceCents })
          .filter((o): o is { supplier: Tables<"suppliers">; priceCents: number } => !!o)
          .map((o) => {
            const deliversOn = deliveryDate(o.supplier);
            return { ...o, deliversOn, inTime: deliversOn <= pickupDay };
          })
          // Fastest first; on a tie, cheaper, then local.
          .sort(
            (a, b) =>
              a.deliversOn.localeCompare(b.deliversOn) ||
              a.priceCents - b.priceCents ||
              Number(b.supplier.is_local) - Number(a.supplier.is_local),
          );
        best = options[0] ?? null;
      }
      return { id, ing, needed, onHand, arr, short, best, orderQty: Math.ceil(short) };
    })
    .sort((a, b) => Number(b.short > 0) - Number(a.short > 0) || (a.ing?.name ?? "").localeCompare(b.ing?.name ?? ""));

  const shortRows = rows.filter((r) => r.short > 0);
  const loading = recipes.isLoading || incoming.isLoading || prices.isLoading || !ingredients || !suppliers;
  const error = recipes.error || incoming.error || prices.error;

  // Group in-time shortfalls by supplier; the first group becomes the draft order.
  const groups = new Map<string, { option: Option; rows: typeof shortRows }>();
  for (const r of shortRows) {
    if (!r.best?.inTime) continue;
    const g = groups.get(r.best.supplier.id) ?? { option: r.best, rows: [] };
    g.rows.push(r);
    groups.set(r.best.supplier.id, g);
  }
  const [first, ...others] = [...groups.values()];

  const orderMissing = () => {
    if (!first) return;
    const draft = {
      supplier_id: first.option.supplier.id,
      expected_on: first.option.deliversOn,
      lines: first.rows.map((r) => ({ ingredient_id: r.id, quantity: r.orderQty })),
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Private mode: the inventory form just opens empty.
    }
    navigate("/admin/inventory?tab=orders");
  };

  const verdict = loading
    ? null
    : shortRows.length === 0
      ? { text: "Yes, you have everything", tag: "bg-pistachio-soft text-pistachio-depth" }
      : {
          text: `Short on ${shortRows.length} ingredient${shortRows.length > 1 ? "s" : ""}`,
          tag: shortRows.some((r) => !r.best?.inTime) ? "bg-jam-soft text-jam-depth" : "bg-butter-soft text-cocoa",
        };

  return (
    <section className="rounded-2xl bg-dough p-4">
      <button
        type="button"
        className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>
          <span className="eyebrow block">Ready by {shortDate(pickupDay)}?</span>
          <span className="text-xl font-extrabold">Can we make it?</span>
        </span>
        <span className="flex items-center gap-2">
          {loading ? (
            <span className="text-cinnamon">Checking…</span>
          ) : (
            verdict && <span className={`tag ${verdict.tag}`}>{verdict.text}</span>
          )}
          <span className="text-cinnamon" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {error && <p className="text-jam">Couldn't check ingredients: {error.message}</p>}

          {!loading && shortRows.length === 0 && (
            <p className="rounded-2xl bg-pistachio-soft px-4 py-3 font-bold text-pistachio-depth">
              Yes, you have everything for this order by {shortDate(pickupDay)}.
            </p>
          )}

          {!loading && rows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl bg-white">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th className="text-right">Needed</th>
                    <th className="text-right">On hand</th>
                    <th className="text-right">Arriving</th>
                    <th className="text-right">Short by</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-extrabold">{r.ing?.name ?? "Unknown"}</td>
                      <td className="text-right whitespace-nowrap">
                        {qty(r.needed)} {r.ing?.unit}
                      </td>
                      <td className="text-right whitespace-nowrap">{qty(r.onHand)}</td>
                      <td className="text-right whitespace-nowrap">
                        {r.arr ? (
                          <>
                            {qty(r.arr.qty)}
                            <span className="block text-xs text-cinnamon">arriving {shortDate(r.arr.on)}</span>
                          </>
                        ) : (
                          <span className="text-cinnamon">—</span>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {r.short > 0 ? (
                          <span className="tag bg-jam-soft text-jam-depth">
                            {qty(r.short)} {r.ing?.unit}
                          </span>
                        ) : (
                          <span className="tag bg-pistachio-soft text-pistachio-depth">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && shortRows.length > 0 && (
            <ul className="space-y-2">
              {shortRows.map((r) => (
                <li key={r.id} className="rounded-2xl bg-white px-4 py-3">
                  <p className="font-extrabold">
                    {r.ing?.name}: order {qty(r.orderQty)} {r.ing?.unit}
                  </p>
                  {r.best?.inTime ? (
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span>
                        {r.best.supplier.name} can deliver {shortDate(r.best.deliversOn)} · about{" "}
                        {money(r.orderQty * r.best.priceCents)}
                      </span>
                      {r.best.supplier.is_local && <span className="tag bg-pistachio-soft text-pistachio-depth">Local</span>}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-jam">
                      No supplier can deliver by {shortDate(pickupDay)} — consider a different item or a later date
                      {r.best && ` (${r.best.supplier.name} could bring it ${shortDate(r.best.deliversOn)})`}.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {first && (
            <div className="space-y-2">
              <button type="button" className="btn-butter w-full" onClick={orderMissing}>
                Order what's missing
              </button>
              <p className="text-sm text-cinnamon">
                Starts an order from {first.option.supplier.name} for {shortDate(first.option.deliversOn)}
                {others.length > 0 && `. You'll also need to order from ${others.map((g) => g.option.supplier.name).join(", ")}`}.
              </p>
            </div>
          )}

          <p className="text-xs text-cinnamon">On hand already accounts for orders waiting in the queue.</p>
        </div>
      )}
    </section>
  );
}
