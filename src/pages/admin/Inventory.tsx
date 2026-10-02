import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { date, dateTime, money } from "../../lib/format";
import { supabase, type Enums } from "../../lib/supabase";

type TxnType = Enums<"inventory_txn_type">;

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const qty = (v: number | string | null | undefined) =>
  num(v).toLocaleString("en-US", { maximumFractionDigits: 3 });

function useIngredients() {
  return useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("*, suppliers(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export default function Inventory() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold">Ingredients</h1>
        <p className="text-muted">What's on the shelf, what's running low, and what's about to spoil.</p>
      </header>
      <Alerts />
      <IngredientTable />
      <div className="grid gap-6 lg:grid-cols-2">
        <LogTransactionForm />
        <RecentTransactions />
      </div>
      <Suppliers />
      <PriceComparison />
    </div>
  );
}

function Alerts() {
  const lowStock = useQuery({
    queryKey: ["low_stock_ingredients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("low_stock_ingredients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const expiring = useQuery({
    queryKey: ["expiring_lots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expiring_lots").select("*");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card border-berry/30">
        <h2 className="mb-3 text-xl font-semibold text-berry">Running low</h2>
        {lowStock.data?.length ? (
          <ul className="space-y-1">
            {lowStock.data.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>{i.name}</span>
                <span className="text-muted">
                  {qty(i.quantity_on_hand)} / {qty(i.reorder_threshold)} {i.unit}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Everything is stocked.</p>
        )}
      </div>
      <div className="card border-terracotta/30">
        <h2 className="mb-3 text-xl font-semibold text-terracotta">Expiring in 3 days</h2>
        {expiring.data?.length ? (
          <ul className="space-y-1">
            {expiring.data.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span>
                  {l.name} <span className="text-muted">({qty(l.quantity)} {l.unit})</span>
                </span>
                <span className="font-medium">{date(l.expires_on)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nothing expiring soon.</p>
        )}
      </div>
    </div>
  );
}

function IngredientTable() {
  const { data: ingredients, isLoading } = useIngredients();

  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-3 text-xl font-semibold">On hand</h2>
      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>On hand</th>
              <th>Reorder at</th>
              <th>Cost / unit</th>
              <th>Supplier</th>
              <th>Allergens</th>
            </tr>
          </thead>
          <tbody>
            {ingredients?.map((i) => {
              const low = num(i.quantity_on_hand) <= num(i.reorder_threshold);
              return (
                <tr key={i.id} className={low ? "bg-berry/5" : undefined}>
                  <td className="font-medium">{i.name}</td>
                  <td className={low ? "font-semibold text-berry" : undefined}>
                    {qty(i.quantity_on_hand)} {i.unit}
                  </td>
                  <td className="text-muted">
                    {qty(i.reorder_threshold)} {i.unit}
                  </td>
                  <td>{money(num(i.cost_per_unit_cents))}</td>
                  <td>{i.suppliers?.name ?? "—"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {i.allergens.map((a) => (
                        <span key={a} className="rounded-full bg-crust px-2 py-0.5 text-xs">
                          {a}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

const TXN_LABELS: Record<TxnType, string> = {
  purchase: "Bought / delivered",
  usage: "Used",
  spoilage: "Spoiled / thrown out",
  adjustment: "Correction (+/−)",
};

function LogTransactionForm() {
  const qc = useQueryClient();
  const { data: ingredients } = useIngredients();
  const { data: suppliers } = useSuppliers();

  const [type, setType] = useState<TxnType>("purchase");
  const [ingredientId, setIngredientId] = useState("");
  const [amount, setAmount] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [paid, setPaid] = useState(true);
  const [notes, setNotes] = useState("");

  const unit = ingredients?.find((i) => i.id === ingredientId)?.unit;

  const log = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      // Usage and spoilage are entered as positive numbers but stored as negative movements.
      const quantity = type === "usage" || type === "spoilage" ? -Math.abs(value) : value;
      const isPurchase = type === "purchase";
      const { error } = await supabase.from("inventory_transactions").insert({
        ingredient_id: ingredientId,
        type,
        quantity,
        unit_cost_cents: isPurchase && unitCost ? Number(unitCost) : null,
        supplier_id: isPurchase && supplierId ? supplierId : null,
        expires_on: isPurchase && expiresOn ? expiresOn : null,
        paid: isPurchase ? paid : true,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAmount("");
      setUnitCost("");
      setExpiresOn("");
      setNotes("");
      for (const key of ["ingredients", "inventory_transactions", "low_stock_ingredients", "expiring_lots"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    log.mutate();
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="text-xl font-semibold">Log a change</h2>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(TXN_LABELS) as TxnType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={type === t ? "btn-primary" : "btn-ghost"}
          >
            {TXN_LABELS[t]}
          </button>
        ))}
      </div>

      <div>
        <label className="label">Ingredient</label>
        <select className="input" required value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
          <option value="">Choose…</option>
          {ingredients?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">
          Amount{unit ? ` (${unit})` : ""}
          {type === "adjustment" && " — use a minus sign to remove"}
        </label>
        <input
          className="input"
          type="number"
          step="any"
          required
          min={type === "adjustment" ? undefined : 0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      {type === "purchase" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cost per {unit ?? "unit"} (cents)</label>
              <input
                className="input"
                type="number"
                step="any"
                min={0}
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Use by</label>
              <input className="input" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">—</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-5" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Already paid
          </label>
        </>
      )}

      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {log.error && <p className="text-berry">{(log.error as Error).message}</p>}
      <button className="btn-primary w-full" disabled={log.isPending}>
        {log.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function RecentTransactions() {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("*, ingredients(name, unit), suppliers(name)")
        .order("occurred_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="card">
      <h2 className="mb-3 text-xl font-semibold">Recent changes</h2>
      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <ul className="divide-y divide-crust">
          {data?.map((t) => {
            const q = num(t.quantity);
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <div className="font-medium">
                    {t.ingredients?.name}{" "}
                    <span className="text-sm font-normal text-muted">· {TXN_LABELS[t.type]}</span>
                  </div>
                  <div className="text-sm text-muted">
                    {dateTime(t.occurred_at)}
                    {t.suppliers?.name && ` · ${t.suppliers.name}`}
                    {t.unit_cost_cents != null && ` · ${money(num(t.unit_cost_cents))}/${t.ingredients?.unit}`}
                    {!t.paid && " · unpaid"}
                    {t.notes && ` · ${t.notes}`}
                  </div>
                </div>
                <span className={`font-semibold ${q >= 0 ? "text-sage" : "text-berry"}`}>
                  {q >= 0 ? "+" : ""}
                  {qty(q)} {t.ingredients?.unit}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function Suppliers() {
  const qc = useQueryClient();
  const { data: suppliers } = useSuppliers();
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", is_local: false, delivery_days: [] as string[] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("suppliers").insert({
        name: form.name,
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        is_local: form.is_local,
        delivery_days: form.delivery_days,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ name: "", contact_name: "", phone: "", is_local: false, delivery_days: [] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  const toggleDay = (d: string) =>
    setForm((f) => ({
      ...f,
      delivery_days: f.delivery_days.includes(d) ? f.delivery_days.filter((x) => x !== d) : [...f.delivery_days, d],
    }));

  return (
    <section className="grid gap-6 lg:grid-cols-3">
      <div className="card lg:col-span-2">
        <h2 className="mb-3 text-xl font-semibold">Suppliers</h2>
        <ul className="divide-y divide-crust">
          {suppliers?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {s.name}
                  {s.is_local && (
                    <span className="rounded-full bg-sage/15 px-2 py-0.5 text-xs font-semibold text-sage">Local</span>
                  )}
                </div>
                <div className="text-sm text-muted">
                  {[s.contact_name, s.notes].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="text-right text-sm">
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="font-medium text-terracotta">
                    {s.phone}
                  </a>
                )}
                <div className="text-muted">
                  {s.delivery_days.length ? `Delivers ${s.delivery_days.join(", ")}` : "No set delivery days"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <h2 className="text-xl font-semibold">Add supplier</h2>
        <div>
          <label className="label">Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Contact</label>
          <input
            className="input"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Delivery days</label>
          <div className="flex flex-wrap gap-1">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  form.delivery_days.includes(d) ? "bg-terracotta text-white" : "bg-crust"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-5"
            checked={form.is_local}
            onChange={(e) => setForm({ ...form, is_local: e.target.checked })}
          />
          Local grower
        </label>
        {add.error && <p className="text-berry">{(add.error as Error).message}</p>}
        <button className="btn-primary w-full" disabled={add.isPending}>
          Add
        </button>
      </form>
    </section>
  );
}

function PriceComparison() {
  const { data: ingredients } = useIngredients();
  const [ingredientId, setIngredientId] = useState("");
  const selected = ingredients?.find((i) => i.id === ingredientId);

  const { data: prices } = useQuery({
    queryKey: ["supplier_prices", ingredientId],
    enabled: !!ingredientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_prices")
        .select("*, suppliers(name, is_local, lead_time_days)")
        .eq("ingredient_id", ingredientId)
        .order("effective_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Rows are newest-first, so the first row seen per supplier is its latest quote.
  const latestBySupplier = new Map<string, NonNullable<typeof prices>[number]>();
  for (const p of prices ?? []) if (!latestBySupplier.has(p.supplier_id)) latestBySupplier.set(p.supplier_id, p);
  const quotes = [...latestBySupplier.values()].sort((a, b) => num(a.price_cents) - num(b.price_cents));
  const cheapest = quotes[0]?.price_cents;

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Compare supplier prices</h2>
          <p className="text-sm text-muted">Latest quote from each supplier.</p>
        </div>
        <select className="input max-w-xs" value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
          <option value="">Pick an ingredient…</option>
          {ingredients?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      {!ingredientId ? null : quotes.length === 0 ? (
        <p className="text-muted">No quotes recorded for this ingredient yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Price / {selected?.unit}</th>
              <th>vs. what you pay now</th>
              <th>Quoted</th>
              <th>Lead time</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => {
              const isCheapest = q.price_cents === cheapest;
              const diff = num(q.price_cents) - num(selected?.cost_per_unit_cents);
              return (
                <tr key={q.id} className={isCheapest ? "bg-sage/10" : undefined}>
                  <td className="font-medium">
                    {q.suppliers?.name}
                    {q.suppliers?.is_local && <span className="ml-2 text-xs font-semibold text-sage">Local</span>}
                    {isCheapest && <span className="ml-2 text-xs font-semibold text-sage">Cheapest</span>}
                  </td>
                  <td>{money(num(q.price_cents))}</td>
                  <td className={diff > 0 ? "text-berry" : diff < 0 ? "text-sage" : "text-muted"}>
                    {diff === 0 ? "same" : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
                  </td>
                  <td className="text-muted">{date(q.effective_on)}</td>
                  <td className="text-muted">
                    {q.suppliers?.lead_time_days != null ? `${q.suppliers.lead_time_days}d` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
