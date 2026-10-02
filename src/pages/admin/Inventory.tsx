import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { date, dateTime, isoDay, money, shortDate } from "../../lib/format";
import { supabase, type Enums } from "../../lib/supabase";
import Bills from "./inventory/Bills";
import IngredientOrders from "./inventory/IngredientOrders";
import { num, qty, useIngredients, useInvalidateLedger, useSuppliers } from "./inventory/shared";

type TxnType = Enums<"inventory_txn_type">;

const TABS = {
  stock: "Stock",
  orders: "Orders & deliveries",
  bills: "Bills",
  suppliers: "Suppliers",
} as const;
type Tab = keyof typeof TABS;

export default function Inventory() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = (params.get("tab") as Tab) in TABS ? (params.get("tab") as Tab) : "stock";

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Inventory</p>
        <h1 className="text-4xl font-black">Ingredients</h1>
        <p className="mt-1 text-cinnamon">Stock, deliveries, bills and spoilage, all in one place.</p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Inventory sections">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button
            key={t}
            className={`${tab === t ? "chip-active" : "chip"} px-5 py-2.5 text-base`}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setParams(t === "stock" ? {} : { tab: t }, { replace: true })}
          >
            {TABS[t]}
          </button>
        ))}
      </nav>

      {tab === "stock" && (
        <>
          <Alerts />
          <IngredientTable />
          <div className="grid gap-6 lg:grid-cols-2">
            <LogTransactionForm />
            <RecentTransactions />
          </div>
        </>
      )}
      {tab === "orders" && <IngredientOrders />}
      {tab === "bills" && <Bills />}
      {tab === "suppliers" && (
        <>
          <Suppliers />
          <PriceComparison />
        </>
      )}
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
      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">Running low</h2>
          {!!lowStock.data?.length && (
            <Link to="?tab=orders" className="btn-ghost px-4 py-2 text-sm">
              Order more
            </Link>
          )}
        </div>
        {lowStock.data?.length ? (
          <ul className="space-y-2">
            {lowStock.data.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-2xl bg-jam-soft px-4 py-3">
                <span className="font-extrabold text-jam-depth">{i.name} is low</span>
                <span className="text-sm font-bold text-jam-depth">
                  {qty(i.quantity_on_hand)} left, par is {qty(i.reorder_threshold)} {i.unit}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-pistachio-soft px-4 py-3 font-bold text-pistachio-depth">Everything is stocked.</p>
        )}
      </div>
      <div className="card">
        <h2 className="mb-4 text-xl font-extrabold">Use it or lose it</h2>
        {expiring.data?.length ? (
          <ul className="space-y-2">
            {expiring.data.map((l) => (
              <ExpiringLot key={l.id!} lot={l} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-pistachio-soft px-4 py-3 font-bold text-pistachio-depth">Nothing expiring soon.</p>
        )}
      </div>
    </div>
  );
}

type Lot = { id: string | null; ingredient_id: string | null; name: string | null; quantity: number | null; unit: string | null; expires_on: string | null };

/** A delivered lot near its use-by date: close it out as used up, or log what was thrown away. */
function ExpiringLot({ lot }: { lot: Lot }) {
  const invalidate = useInvalidateLedger();
  const [tossing, setTossing] = useState(false);
  const [amount, setAmount] = useState(String(num(lot.quantity)));
  const expired = lot.expires_on != null && lot.expires_on < isoDay();

  const close = useMutation({
    mutationFn: async (spoiled: number) => {
      if (spoiled > 0) {
        const { error } = await supabase.from("inventory_transactions").insert({
          ingredient_id: lot.ingredient_id!,
          type: "spoilage",
          quantity: -spoiled,
          notes: `Spoiled lot, use by ${date(lot.expires_on)}`,
        });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("inventory_transactions")
        .update({ lot_closed_at: new Date().toISOString() })
        .eq("id", lot.id!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <li className={`rounded-2xl px-4 py-3 ${expired ? "bg-jam-soft" : "bg-butter-soft"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-extrabold text-cocoa">
          {lot.name}{" "}
          <span className="font-bold text-cinnamon">
            ({qty(lot.quantity)} {lot.unit})
          </span>
        </span>
        <span className={`text-sm font-extrabold ${expired ? "text-jam-depth" : "text-cocoa"}`}>
          {expired ? "Expired" : "Use by"} {shortDate(lot.expires_on)}
        </span>
      </div>
      {tossing ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            close.mutate(Math.abs(Number(amount)));
          }}
        >
          <div className="min-w-32 flex-1">
            <label className="label" htmlFor={`toss-${lot.id}`}>How much went in the bin ({lot.unit})</label>
            <input
              id={`toss-${lot.id}`}
              className="input bg-white"
              type="number"
              step="any"
              min={0}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={close.isPending}>Log spoilage</button>
          <button type="button" className="btn-ghost" onClick={() => setTossing(false)}>Back</button>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-ghost px-4 py-2 text-sm" disabled={close.isPending} onClick={() => close.mutate(0)}>
            All used up
          </button>
          <button className="btn-ghost px-4 py-2 text-sm text-jam" disabled={close.isPending} onClick={() => setTossing(true)}>
            Threw some out
          </button>
        </div>
      )}
      {close.error && <p className="mt-2 text-sm text-jam">{close.error.message}</p>}
    </li>
  );
}

function IngredientTable() {
  const { data: ingredients, isLoading } = useIngredients();

  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-4 text-xl font-extrabold">On hand</h2>
      {isLoading ? (
        <p className="text-cinnamon">Loading…</p>
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
                <tr key={i.id} className={low ? "bg-jam-soft/60" : undefined}>
                  <td className="font-extrabold">{i.name}</td>
                  <td>
                    {low ? (
                      <span className="tag bg-jam-soft text-jam-depth">
                        {qty(i.quantity_on_hand)} {i.unit}
                      </span>
                    ) : (
                      <span className="font-bold">
                        {qty(i.quantity_on_hand)} {i.unit}
                      </span>
                    )}
                  </td>
                  <td className="text-cinnamon">
                    {qty(i.reorder_threshold)} {i.unit}
                  </td>
                  <td>{money(num(i.cost_per_unit_cents))}</td>
                  <td>{i.suppliers?.name ?? "—"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {i.allergens.map((a) => (
                        <span key={a} className="tag bg-butter-soft text-cocoa">
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
  const invalidate = useInvalidateLedger();
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
      invalidate();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    log.mutate();
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="text-xl font-extrabold">Log a change</h2>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TXN_LABELS) as TxnType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={type === t ? "chip-active" : "chip"}
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

      {log.error && <p className="text-jam">{(log.error as Error).message}</p>}
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
      <h2 className="mb-4 text-xl font-extrabold">Recent changes</h2>
      {isLoading ? (
        <p className="text-cinnamon">Loading…</p>
      ) : (
        <ul className="divide-y-2 divide-dough">
          {data?.map((t) => {
            const q = num(t.quantity);
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <div className="font-extrabold">
                    {t.ingredients?.name}{" "}
                    <span className="text-sm font-bold text-cinnamon">· {TXN_LABELS[t.type]}</span>
                  </div>
                  <div className="text-sm text-cinnamon">
                    {dateTime(t.occurred_at)}
                    {t.suppliers?.name && ` · ${t.suppliers.name}`}
                    {t.unit_cost_cents != null && ` · ${money(num(t.unit_cost_cents))}/${t.ingredients?.unit}`}
                    {!t.paid && " · unpaid"}
                    {t.notes && ` · ${t.notes}`}
                  </div>
                </div>
                <span className={`tag ${q >= 0 ? "bg-pistachio-soft text-pistachio-depth" : "bg-jam-soft text-jam-depth"}`}>
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
        <h2 className="mb-4 text-xl font-extrabold">Suppliers</h2>
        <ul className="divide-y-2 divide-dough">
          {suppliers?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="flex items-center gap-2 font-extrabold">
                  {s.name}
                  {s.is_local && <span className="tag bg-pistachio-soft text-pistachio-depth">Local</span>}
                </div>
                <div className="text-sm text-cinnamon">
                  {[s.contact_name, s.notes].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="text-right text-sm">
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="font-extrabold text-blueberry">
                    {s.phone}
                  </a>
                )}
                <div className="text-cinnamon">
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
        <h2 className="text-xl font-extrabold">Add supplier</h2>
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
                className={`${form.delivery_days.includes(d) ? "chip-active" : "chip"} px-3 capitalize`}
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
        {add.error && <p className="text-jam">{(add.error as Error).message}</p>}
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
          <h2 className="text-xl font-extrabold">Compare supplier prices</h2>
          <p className="text-sm text-cinnamon">Latest quote from each supplier.</p>
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
        <p className="text-cinnamon">No quotes recorded for this ingredient yet.</p>
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
                <tr key={q.id} className={isCheapest ? "bg-pistachio-soft/60" : undefined}>
                  <td className="font-extrabold">
                    {q.suppliers?.name}
                    {q.suppliers?.is_local && <span className="tag ml-2 bg-pistachio-soft text-pistachio-depth">Local</span>}
                    {isCheapest && <span className="tag ml-2 bg-butter text-cocoa">Cheapest</span>}
                  </td>
                  <td>{money(num(q.price_cents))}</td>
                  <td className={diff > 0 ? "text-jam" : diff < 0 ? "text-pistachio-depth" : "text-cinnamon"}>
                    {diff === 0 ? "same" : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
                  </td>
                  <td className="text-cinnamon">{date(q.effective_on)}</td>
                  <td className="text-cinnamon">
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
