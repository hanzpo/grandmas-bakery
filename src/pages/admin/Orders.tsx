import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { dateTime, money } from "../../lib/format";
import { supabase, type Enums } from "../../lib/supabase";

type Status = Enums<"order_status">;
type Source = Enums<"order_source">;
type PaymentMethod = Enums<"payment_method">;

const STATUSES: Status[] = ["pending_payment", "new", "in_progress", "ready", "completed", "cancelled"];
const SOURCES: Source[] = ["online", "walk_in", "phone", "voice_agent", "b2b"];
const pretty = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

async function fetchOrders(filters: { status: string; source: string; from: string; to: string }) {
  let q = supabase
    .from("orders")
    .select("*, customers(name, phone, organization), order_items(quantity, unit_price_cents, products(name))")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.status) q = q.eq("status", filters.status as Status);
  if (filters.source) q = q.eq("source", filters.source as Source);
  if (filters.from) q = q.gte("created_at", new Date(filters.from).toISOString());
  if (filters.to) q = q.lt("created_at", new Date(new Date(filters.to).getTime() + 86_400_000).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export default function Orders() {
  const [filters, setFilters] = useState({ status: "", source: "", from: "", to: "" });
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["orders", "ledger", filters],
    queryFn: () => fetchOrders(filters),
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((o) =>
      [o.customers?.name, o.customers?.phone, o.customers?.organization, String(o.order_number)]
        .some((v) => v?.toLowerCase().includes(term)),
    );
  }, [orders, search]);

  const countable = visible.filter((o) => o.status !== "cancelled" && o.status !== "pending_payment");
  const totalCents = countable.reduce((sum, o) => sum + o.total_cents, 0);

  const setFilter = (key: keyof typeof filters) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Orders ledger</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ New order"}
        </button>
      </div>

      {showForm && <NewOrderForm onDone={() => setShowForm(false)} />}

      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label">Search</label>
          <input className="input" placeholder="Name, phone, #" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={filters.status} onChange={setFilter("status")}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Source</label>
          <select className="input" value={filters.source} onChange={setFilter("source")}>
            <option value="">All</option>
            {SOURCES.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input className="input" type="date" value={filters.from} onChange={setFilter("from")} />
        </div>
        <div>
          <label className="label">To</label>
          <input className="input" type="date" value={filters.to} onChange={setFilter("to")} />
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        {isLoading ? (
          <p className="p-5 text-muted">Loading…</p>
        ) : error ? (
          <p className="p-5 text-berry">Couldn't load orders: {error.message}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Placed</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Source</th>
                <th>Status</th>
                <th>Pickup</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className={o.status === "cancelled" ? "text-muted line-through" : ""}>
                  <td className="font-semibold">{o.order_number}</td>
                  <td>{dateTime(o.created_at)}</td>
                  <td>
                    {o.customers?.name ?? "—"}
                    {o.customers?.organization && <span className="block text-xs text-muted">{o.customers.organization}</span>}
                  </td>
                  <td>{o.order_items.map((i) => `${i.quantity}× ${i.products?.name}`).join(", ")}</td>
                  <td>{pretty(o.source)}</td>
                  <td>{pretty(o.status)}</td>
                  <td>{dateTime(o.pickup_at)}</td>
                  <td className="text-right">{money(o.total_cents)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">No orders match.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={7} className="px-3 py-3">
                  {countable.length} orders (excluding cancelled & unpaid)
                </td>
                <td className="px-3 py-3 text-right">{money(totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

type Line = { product_id: string; quantity: number };

function NewOrderForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [source, setSource] = useState<Source>("walk_in");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: 1 }]);
  const [pickupAt, setPickupAt] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | "">("cash");

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id, name, price_cents").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, organization").order("name");
      if (error) throw error;
      return data;
    },
  });

  const priceOf = (id: string) => products.find((p) => p.id === id)?.price_cents ?? 0;
  const validLines = lines.filter((l) => l.product_id && l.quantity > 0);
  const total = validLines.reduce((sum, l) => sum + priceOf(l.product_id) * l.quantity, 0);

  const create = useMutation({
    mutationFn: async () => {
      let custId: string | null = customerId || null;
      if (!custId && newCustomer.name.trim()) {
        const { data, error } = await supabase
          .from("customers")
          .insert({ name: newCustomer.name.trim(), phone: newCustomer.phone.trim() || null, is_b2b: source === "b2b" })
          .select("id")
          .single();
        if (error) throw error;
        custId = data.id;
      }

      // Insert as pending_payment first, then flip to 'new' once items exist, so the DB
      // trigger that deducts recipe ingredients and awards loyalty points sees the items.
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: custId,
          source,
          status: "pending_payment",
          pickup_at: pickupAt ? new Date(pickupAt).toISOString() : null,
          subtotal_cents: total,
          total_cents: total,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("order_items").insert(
        validLines.map((l) => ({
          order_id: order.id,
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price_cents: priceOf(l.product_id),
        })),
      );
      if (itemsError) throw itemsError;

      const { error: statusError } = await supabase.from("orders").update({ status: "new" }).eq("id", order.id);
      if (statusError) throw statusError;

      if (payment) {
        const { error: payError } = await supabase
          .from("payments")
          .insert({ order_id: order.id, method: payment, amount_cents: total });
        if (payError) throw payError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onDone();
    },
  });

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (validLines.length > 0) create.mutate();
  };

  return (
    <form onSubmit={submit} className="card space-y-5">
      <h2 className="text-xl">New order</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Order type</label>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value as Source)}>
            <option value="walk_in">Walk-in</option>
            <option value="phone">Phone</option>
            <option value="b2b">B2B / catering</option>
          </select>
        </div>
        <div>
          <label className="label">Existing customer</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— New / anonymous —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.organization ? ` (${c.organization})` : ""}{c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
        </div>
        {!customerId && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Name</label>
              <input className="input" value={newCustomer.name} onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={newCustomer.phone} onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="label">Items</label>
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            <select className="input flex-1" value={line.product_id} onChange={(e) => updateLine(i, { product_id: e.target.value })}>
              <option value="">Choose a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {money(p.price_cents)}</option>
              ))}
            </select>
            <input
              className="input w-24"
              type="number"
              min={1}
              value={line.quantity}
              onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
            />
            <button
              type="button"
              className="btn-ghost px-3"
              disabled={lines.length === 1}
              onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              aria-label="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost text-sm" onClick={() => setLines((ls) => [...ls, { product_id: "", quantity: 1 }])}>
          + Add item
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Pickup time</label>
          <input className="input" type="datetime-local" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment</label>
          <select className="input" value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod | "")}>
            <option value="cash">Cash (paid)</option>
            <option value="card_terminal">Card terminal (paid)</option>
            <option value="invoice">Invoice</option>
            <option value="">Not paid yet</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {create.error && <p className="text-berry">Couldn't save: {create.error.message}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xl font-semibold">Total {money(total)}</p>
        <button className="btn-primary" disabled={create.isPending || validLines.length === 0}>
          {create.isPending ? "Saving…" : "Add to queue"}
        </button>
      </div>
    </form>
  );
}
