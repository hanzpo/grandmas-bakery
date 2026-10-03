import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { isoDay, money, shortDate } from "../../../lib/format";
import { supabase, type Tables } from "../../../lib/supabase";
import { num, qty, toCents, useIngredients, useInvalidateLedger, useSuppliers } from "./shared";

async function fetchOrders() {
  const { data, error } = await supabase
    .from("supplier_orders")
    .select("*, suppliers(name, phone), supplier_order_items(*, ingredients(name, unit))")
    .order("ordered_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return data;
}

type SupplierOrder = Awaited<ReturnType<typeof fetchOrders>>[number];

const orderTotal = (o: SupplierOrder) =>
  o.supplier_order_items.reduce(
    (s, i) => s + num(i.quantity_received ?? i.quantity) * num(i.unit_cost_cents),
    0,
  );

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** First of the supplier's delivery days on or after their lead time. */
function nextDelivery(s: Tables<"suppliers"> | undefined) {
  if (!s) return "";
  const d = new Date();
  d.setDate(d.getDate() + (s.lead_time_days ?? 1));
  if (s.delivery_days.length) {
    for (let i = 0; i < 7 && !s.delivery_days.includes(DAYS[d.getDay()]); i++) d.setDate(d.getDate() + 1);
  }
  return isoDay(d);
}

export type OrderDraft = {
  supplier_id: string;
  expected_on?: string;
  lines: { ingredient_id: string; quantity: number; price?: string }[];
};

// Other pages (e.g. the B2B "Can we make it?" check) hand over a draft order this way.
const DRAFT_KEY = "draft-supplier-order";
function readDraft(): OrderDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OrderDraft) : null;
  } catch {
    return null;
  }
}

export default function IngredientOrders() {
  const { data: orders = [], isLoading, error } = useQuery({ queryKey: ["supplier_orders"], queryFn: fetchOrders });
  const [draft, setDraft] = useState<OrderDraft | null>(readDraft);
  const [creating, setCreating] = useState(!!draft);
  // Use a handed-over draft once (cleared after mount, so StrictMode's double render still sees it).
  useEffect(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, []);
  const startDraft = (d: OrderDraft) => {
    setDraft(d);
    setCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const open = orders
    .filter((o) => o.status === "ordered")
    .sort((a, b) => (a.expected_on ?? "9999").localeCompare(b.expected_on ?? "9999"));
  const done = orders.filter((o) => o.status !== "ordered").slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Ingredient orders</h2>
          <p className="text-cinnamon">What you've ordered from suppliers, and what's arrived.</p>
        </div>
        {!creating && (
          <button className="btn-primary" onClick={() => startDraft({ supplier_id: "", lines: [] })}>
            New order
          </button>
        )}
      </div>

      {creating && (
        <NewOrderForm
          key={JSON.stringify(draft)}
          draft={draft}
          onDone={() => {
            setCreating(false);
            setDraft(null);
          }}
        />
      )}

      {isLoading && <p className="text-cinnamon">Loading…</p>}
      {error && <p className="text-jam">Couldn't load orders: {error.message}</p>}

      <section>
        <h3 className="eyebrow mb-3">On the way</h3>
        {open.length === 0 ? (
          <p className="card text-cinnamon">Nothing on order right now.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {open.map((o) => (
              <OrderCard key={o.id} order={o} onReorder={startDraft} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h3 className="eyebrow mb-3">Delivered & past orders</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {done.map((o) => (
              <OrderCard key={o.id} order={o} onReorder={startDraft} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OrderCard({ order, onReorder }: { order: SupplierOrder; onReorder: (d: OrderDraft) => void }) {
  const invalidate = useInvalidateLedger();
  const [receiving, setReceiving] = useState(false);
  const today = isoDay();
  const late = order.status === "ordered" && order.expected_on != null && order.expected_on < today;
  const total = orderTotal(order);

  const update = useMutation({
    mutationFn: async (patch: { paid_on?: string | null; status?: "cancelled" }) => {
      const { error } = await supabase.from("supplier_orders").update(patch).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <article className={`card space-y-3 ${order.status === "cancelled" ? "opacity-60" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-black">{order.suppliers?.name}</p>
          <p className="text-sm text-cinnamon">
            Ordered {shortDate(order.ordered_on)}
            {order.suppliers?.phone && (
              <>
                {" · "}
                <a href={`tel:${order.suppliers.phone}`} className="font-extrabold text-blueberry">
                  {order.suppliers.phone}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {order.status === "ordered" &&
            (late ? (
              <span className="tag bg-jam-soft text-jam-depth">Late · was due {shortDate(order.expected_on)}</span>
            ) : (
              <span className="tag bg-blueberry-soft text-blueberry-depth">
                {order.expected_on ? `Arrives ${order.expected_on === today ? "today" : shortDate(order.expected_on)}` : "No date"}
              </span>
            ))}
          {order.status === "arrived" && (
            <span className="tag bg-pistachio-soft text-pistachio-depth">Arrived {shortDate(order.arrived_on)}</span>
          )}
          {order.status === "cancelled" && <span className="tag bg-crumb text-cocoa">Cancelled</span>}
          {order.status !== "cancelled" &&
            (order.paid_on ? (
              <span className="tag bg-pistachio-soft text-pistachio-depth">Paid</span>
            ) : (
              <span className="tag bg-butter-soft text-cocoa">Owe {money(total)}</span>
            ))}
        </div>
      </header>

      {receiving ? (
        <ReceiveForm order={order} onDone={() => setReceiving(false)} />
      ) : (
        <>
          <ul className="space-y-1">
            {order.supplier_order_items.map((i) => {
              const short = i.quantity_received != null && num(i.quantity_received) < num(i.quantity);
              return (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    <span className="font-extrabold">
                      {qty(i.quantity_received ?? i.quantity)} {i.ingredients?.unit}
                    </span>{" "}
                    {i.ingredients?.name}
                    {short && <span className="text-sm text-jam"> (ordered {qty(i.quantity)})</span>}
                  </span>
                  <span className="text-cinnamon">
                    {money(num(i.quantity_received ?? i.quantity) * num(i.unit_cost_cents))}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between border-t-2 border-crumb pt-2 font-black">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
          {order.notes && <p className="rounded-2xl bg-dough px-3 py-2 text-sm">{order.notes}</p>}

          <div className="flex flex-wrap gap-2">
            {order.status === "ordered" && (
              <button className="btn-primary flex-1" onClick={() => setReceiving(true)}>
                It arrived
              </button>
            )}
            {order.status !== "cancelled" && !order.paid_on && (
              <button
                className="btn-ghost flex-1"
                disabled={update.isPending}
                onClick={() => update.mutate({ paid_on: isoDay() })}
              >
                Mark paid
              </button>
            )}
            {order.status !== "ordered" && (
              <button
                className="btn-ghost flex-1"
                onClick={() =>
                  onReorder({
                    supplier_id: order.supplier_id,
                    lines: order.supplier_order_items.map((i) => ({
                      ingredient_id: i.ingredient_id,
                      quantity: num(i.quantity),
                      price: ((num(i.quantity) * num(i.unit_cost_cents)) / 100).toFixed(2),
                    })),
                  })
                }
              >
                Order again
              </button>
            )}
            {order.status === "ordered" && (
              <button
                className="btn-ghost px-4 text-sm text-cinnamon"
                disabled={update.isPending}
                onClick={() => {
                  if (confirm(`Cancel the order from ${order.suppliers?.name}?`)) update.mutate({ status: "cancelled" });
                }}
              >
                Cancel
              </button>
            )}
          </div>
          {update.error && <p className="text-jam">{update.error.message}</p>}
        </>
      )}
    </article>
  );
}

/** Check off a delivery: what actually came, and when each item must be used by. */
function ReceiveForm({ order, onDone }: { order: SupplierOrder; onDone: () => void }) {
  const invalidate = useInvalidateLedger();
  const [lines, setLines] = useState(
    order.supplier_order_items.map((i) => ({ item_id: i.id, quantity: String(num(i.quantity)), expires_on: "" })),
  );
  const set = (idx: number, patch: Partial<(typeof lines)[number]>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const receive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("receive_supplier_order", {
        p_order_id: order.id,
        p_lines: lines.map((l) => ({ item_id: l.item_id, quantity: Number(l.quantity) || 0, expires_on: l.expires_on || null })),
        p_today: isoDay(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    receive.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-cinnamon">Change an amount if the delivery was short. Add a use-by date for anything that spoils.</p>
      {order.supplier_order_items.map((item, idx) => (
        <div key={item.id} className="rounded-2xl bg-dough p-3">
          <p className="mb-2 font-extrabold">{item.ingredients?.name}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor={`recv-${item.id}`}>Got ({item.ingredients?.unit})</label>
              <input
                id={`recv-${item.id}`}
                className="input bg-white"
                type="number"
                step="any"
                min={0}
                required
                value={lines[idx].quantity}
                onChange={(e) => set(idx, { quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor={`exp-${item.id}`}>Use by</label>
              <input
                id={`exp-${item.id}`}
                className="input bg-white"
                type="date"
                value={lines[idx].expires_on}
                onChange={(e) => set(idx, { expires_on: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
      {receive.error && <p className="text-jam">{receive.error.message}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={receive.isPending}>
          {receive.isPending ? "Saving…" : "Add to stock"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Back
        </button>
      </div>
    </form>
  );
}

type Line = { ingredient_id: string; quantity: string; price: string };
const emptyLine = (): Line => ({ ingredient_id: "", quantity: "", price: "" });

function NewOrderForm({ draft, onDone }: { draft: OrderDraft | null; onDone: () => void }) {
  const invalidate = useInvalidateLedger();
  const { data: suppliers } = useSuppliers();
  const { data: ingredients } = useIngredients();

  const [supplierId, setSupplierId] = useState(draft?.supplier_id ?? "");
  const [expectedOn, setExpectedOn] = useState(draft?.expected_on ?? "");
  const [lines, setLines] = useState<Line[]>(
    draft?.lines.length
      ? draft.lines.map((l) => ({ ingredient_id: l.ingredient_id, quantity: String(l.quantity), price: l.price ?? "" }))
      : [emptyLine()],
  );
  // A draft without a date (e.g. "Order again") gets the supplier's next delivery day once suppliers load.
  const [dateFilled, setDateFilled] = useState(!!draft?.expected_on || !draft?.supplier_id);
  if (!dateFilled && suppliers) {
    setDateFilled(true);
    setExpectedOn(nextDelivery(suppliers.find((s) => s.id === draft?.supplier_id)));
  }
  const [paid, setPaid] = useState(false);
  const [notes, setNotes] = useState("");

  const ingredient = (id: string) => ingredients?.find((i) => i.id === id);
  // A blank price falls back to the last price paid.
  const estimate = (l: Line) => num(l.quantity) * num(ingredient(l.ingredient_id)?.cost_per_unit_cents);
  const lineCents = (l: Line) => (l.price ? toCents(l.price) : Math.round(estimate(l)));
  const valid = lines.filter((l) => l.ingredient_id && num(l.quantity) > 0);
  const total = valid.reduce((s, l) => s + lineCents(l), 0);

  const setLine = (idx: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const pickSupplier = (id: string) => {
    setSupplierId(id);
    setExpectedOn(nextDelivery(suppliers?.find((s) => s.id === id)));
  };

  // Pre-fill everything this supplier usually brings that's running low: enough to get back to twice the reorder level.
  const lowFromSupplier = (ingredients ?? []).filter(
    (i) => i.preferred_supplier_id === supplierId && num(i.quantity_on_hand) <= num(i.reorder_threshold),
  );
  const addLowStock = () =>
    setLines([
      ...lines.filter((l) => l.ingredient_id),
      ...lowFromSupplier
        .filter((i) => !lines.some((l) => l.ingredient_id === i.id))
        .map((i) => ({
          ingredient_id: i.id,
          quantity: String(Math.ceil(Math.max(num(i.reorder_threshold) * 2 - num(i.quantity_on_hand), num(i.reorder_threshold)))),
          price: "",
        })),
    ]);

  const create = useMutation({
    mutationFn: async () => {
      // One call so an order is never saved without its lines.
      const { error } = await supabase.rpc("create_supplier_order", {
        p_supplier_id: supplierId,
        p_lines: valid.map((l) => ({
          ingredient_id: l.ingredient_id,
          quantity: num(l.quantity),
          unit_cost_cents: lineCents(l) / num(l.quantity),
        })),
        p_expected_on: expectedOn || undefined,
        p_paid_on: paid ? isoDay() : undefined,
        p_notes: notes.trim() || undefined,
        p_today: isoDay(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h3 className="text-xl font-extrabold">New ingredient order</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="order-supplier">Supplier</label>
          <select id="order-supplier" className="input" required value={supplierId} onChange={(e) => pickSupplier(e.target.value)}>
            <option value="">Choose…</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="order-expected">Expected delivery</label>
          <input id="order-expected" className="input" type="date" value={expectedOn} onChange={(e) => setExpectedOn(e.target.value)} />
        </div>
      </div>

      {lowFromSupplier.length > 0 && (
        <button type="button" className="btn-butter w-full" onClick={addLowStock}>
          Add {lowFromSupplier.length} low item{lowFromSupplier.length > 1 ? "s" : ""} from this supplier
        </button>
      )}

      <div className="space-y-3">
        {lines.map((l, idx) => {
          const ing = ingredient(l.ingredient_id);
          return (
            <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-dough p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <select
                aria-label="Ingredient"
                className="input col-span-2 bg-white sm:col-span-1"
                value={l.ingredient_id}
                onChange={(e) => setLine(idx, { ingredient_id: e.target.value })}
              >
                <option value="">Ingredient…</option>
                {ingredients?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Amount"
                className="input bg-white"
                type="number"
                step="any"
                min={0}
                placeholder={ing ? `Amount (${ing.unit})` : "Amount"}
                value={l.quantity}
                onChange={(e) => setLine(idx, { quantity: e.target.value })}
              />
              <input
                aria-label="Price in dollars"
                className="input bg-white"
                type="number"
                step="0.01"
                min={0}
                placeholder={estimate(l) ? `$ ${(estimate(l) / 100).toFixed(2)}` : "Price $"}
                value={l.price}
                onChange={(e) => setLine(idx, { price: e.target.value })}
              />
              <button
                type="button"
                aria-label="Remove line"
                className="btn-icon"
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          );
        })}
        <button type="button" className="btn-ghost w-full" onClick={() => setLines([...lines, emptyLine()])}>
          Add another ingredient
        </button>
        <p className="text-sm text-cinnamon">Leave the price blank to use what you paid last time.</p>
      </div>

      <div>
        <label className="label" htmlFor="order-notes">Notes</label>
        <input id="order-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="size-5" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
        Already paid
      </label>

      <div className="flex justify-between border-t-2 border-crumb pt-3 text-lg font-black">
        <span>Total</span>
        <span>{money(total)}</span>
      </div>
      {create.error && <p className="text-jam">{create.error.message}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!supplierId || valid.length === 0 || create.isPending}>
          {create.isPending ? "Saving…" : "Save order"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
