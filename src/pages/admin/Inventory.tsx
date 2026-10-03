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
          <GroceryCalls />
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

const RUN_LABEL: Record<string, string> = {
  quoting: "Asking for prices",
  ordering: "Placing the order",
  placed: "Order placed",
  failed: "Not placed",
};
const CALL_LABEL: Record<string, string> = {
  pending: "Waiting",
  dialing: "On the phone",
  quoted: "Quoted",
  ordered: "Ordered",
  failed: "Failed",
  skipped: "Skipped",
};

type GroceryCall = {
  id: string;
  supplier_name: string | null;
  purpose: string;
  status: string;
  error: string | null;
};
type GroceryRun = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  calls: GroceryCall[];
};
type ReclaimResponse = {
  started: boolean;
  reason: string | null;
  run: GroceryRun | null;
};

function GroceryCalls() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["supply_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supply_settings").select("polling_enabled").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const latest = useQuery({
    queryKey: ["supply_runs", "latest"],
    queryFn: async () => {
      const { data: run, error } = await supabase
        .from("supply_runs")
        .select("id, status, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!run) return null;
      const { data: calls, error: callError } = await supabase
        .from("supply_calls")
        .select("id, supplier_id, purpose, status, error, suppliers(name)")
        .eq("run_id", run.id)
        .order("created_at");
      if (callError) throw callError;
      return {
        ...run,
        calls: calls.map((call) => ({
          id: call.id,
          purpose: call.purpose,
          status: call.status,
          error: call.error,
          supplier_name: supplierLabel(call.suppliers),
        })),
      };
    },
  });

  const pollingOn = settings.data?.polling_enabled === true;
  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("supply_settings")
        .update({ polling_enabled: !pollingOn, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supply_settings"] }),
  });
  const reclaim = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again to reclaim low stock.");
      const res = await fetch("/api/supply/reclaim", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as Partial<ReclaimResponse> & { error?: string };
      if (!res.ok) throw new Error(body.error || "Reclaim failed.");
      return body as ReclaimResponse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supply_runs"] }),
  });

  return (
    <section className="card space-y-4">
      <div>
        <p className="eyebrow">Grocery calls</p>
        <h2 className="text-xl font-extrabold">Call stores for low stock</h2>
        <p className="mt-1 text-sm text-cinnamon">
          Grandma asks each store for prices, then orders the whole list from the cheapest store that can fill it. Turning
          polling on only saves the switch. Nothing calls stores on a timer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={pollingOn ? "btn-butter" : "btn-ghost"}
          disabled={settings.isLoading || toggle.isPending}
          onClick={() => toggle.mutate()}
        >
          {settings.isLoading ? "Polling…" : pollingOn ? "Polling on" : "Polling off"}
        </button>
        <button type="button" className="btn-primary" disabled={reclaim.isPending} onClick={() => reclaim.mutate()}>
          {reclaim.isPending ? "Starting…" : "Reclaim low stock"}
        </button>
      </div>
      {settings.error && <p className="text-jam">{(settings.error as Error).message}</p>}
      {toggle.error && <p className="text-jam">{(toggle.error as Error).message}</p>}
      {reclaim.error && <p className="text-jam">{(reclaim.error as Error).message}</p>}
      {reclaim.data && <p className="font-bold">{reclaimMessage(reclaim.data)}</p>}
      {latest.isLoading ? (
        <p className="text-cinnamon">Loading the latest grocery run…</p>
      ) : latest.error ? (
        <p className="text-jam">{(latest.error as Error).message}</p>
      ) : latest.data ? (
        <div>
          <p className="font-extrabold">
            Latest run · {RUN_LABEL[latest.data.status] ?? latest.data.status}
            <span className="ml-2 text-sm font-bold text-cinnamon">{dateTime(latest.data.created_at)}</span>
          </p>
          {latest.data.notes && <p className="mt-1 text-sm text-cinnamon">{latest.data.notes}</p>}
          <ul className="mt-2 space-y-1">
            {latest.data.calls.map((call) => (
              <li key={call.id} className="text-sm">
                <span className="font-extrabold">{call.supplier_name ?? "Store"}</span>
                <span className="text-cinnamon">
                  {" "}
                  · {call.purpose === "order" ? "Order call" : "Price call"} · {CALL_LABEL[call.status] ?? call.status}
                </span>
                {call.error && <span className="text-jam"> — {call.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-cinnamon">No grocery runs yet.</p>
      )}
    </section>
  );
}

function supplierLabel(suppliers: { name: string } | { name: string }[] | null) {
  if (!suppliers) return null;
  return Array.isArray(suppliers) ? (suppliers[0]?.name ?? null) : suppliers.name;
}

function reclaimMessage(result: ReclaimResponse) {
  if (!result.started && result.reason === "nothing low") return "Nothing is at or below its reorder point.";
  if (!result.started && result.reason === "already in progress") return "A grocery run is already in progress.";
  if (result.started && result.run?.status === "failed") {
    return result.run.notes || "The run failed before an order was placed.";
  }
  if (result.started) return "Started. Grandma is calling stores that have a dialable number.";
  return result.reason || "Nothing happened.";
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
  const { data: ingredients } = useIngredients();
  const onHand = ingredients?.find((i) => i.id === lot.ingredient_id)?.quantity_on_hand;
  // Some of the lot may already be used, so never suggest throwing out more than is on the shelf.
  const suggested = Math.max(0, Math.min(num(lot.quantity), onHand == null ? num(lot.quantity) : num(onHand)));
  const [amount, setAmount] = useState("");
  const expired = lot.expires_on != null && lot.expires_on < isoDay();

  const close = useMutation({
    // One database call: logs the spoilage and closes the lot together, and is safe to retry.
    mutationFn: async (spoiled: number) => {
      const { error } = await supabase.rpc("close_lot", { p_lot_id: lot.id!, p_spoiled: spoiled });
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
              max={onHand == null ? undefined : num(onHand)}
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
          <button className="btn-ghost px-4 py-2 text-sm text-jam" disabled={close.isPending} onClick={() => {
              setAmount(String(suggested));
              setTossing(true);
            }}>
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

// Per-unit ingredient prices are often fractions of a cent (cream is ~0.9¢/ml), so money() would round them away.
const perUnit = (cents: number) => (cents >= 100 ? money(cents) : `${Number(cents.toFixed(2))}¢`);

function PriceComparison() {
  const qc = useQueryClient();
  const invalidate = useInvalidateLedger();
  const { data: ingredients } = useIngredients();
  const { data: suppliers } = useSuppliers();
  const [ingredientId, setIngredientId] = useState("");
  const selected = ingredients?.find((i) => i.id === ingredientId);
  const [quote, setQuote] = useState({ supplier_id: "", price: "", amount: "", effective_on: isoDay(), notes: "" });

  const { data: prices } = useQuery({
    queryKey: ["supplier_prices", ingredientId],
    enabled: !!ingredientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_prices")
        .select("*, suppliers(name, is_local, lead_time_days)")
        .eq("ingredient_id", ingredientId)
        .order("effective_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addQuote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supplier_prices").insert({
        ingredient_id: ingredientId,
        supplier_id: quote.supplier_id,
        price_cents: (Number(quote.price) * 100) / Number(quote.amount),
        effective_on: quote.effective_on,
        notes: quote.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setQuote({ supplier_id: "", price: "", amount: "", effective_on: isoDay(), notes: "" });
      qc.invalidateQueries({ queryKey: ["supplier_prices"] });
    },
  });

  const makePreferred = useMutation({
    mutationFn: async (supplierId: string) => {
      const { error } = await supabase.from("ingredients").update({ preferred_supplier_id: supplierId }).eq("id", ingredientId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Rows are newest-first, so the first row seen per supplier is its latest quote.
  const latestBySupplier = new Map<string, NonNullable<typeof prices>[number]>();
  for (const p of prices ?? []) if (!latestBySupplier.has(p.supplier_id)) latestBySupplier.set(p.supplier_id, p);
  const quotes = [...latestBySupplier.values()].sort((a, b) => num(a.price_cents) - num(b.price_cents));
  const cheapest = quotes[0]?.price_cents;

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">Compare supplier prices</h2>
          <p className="text-sm text-cinnamon">
            Latest quote from each supplier. To see what a price change does to your menu, try it on Menu & Costs.
          </p>
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
        <p className="text-cinnamon">No quotes recorded for this ingredient yet. Add one below.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Price / {selected?.unit}</th>
                <th>vs. what you pay now</th>
                <th>Quoted</th>
                <th>Lead time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const isCheapest = q.price_cents === cheapest;
                const isPreferred = selected?.preferred_supplier_id === q.supplier_id;
                const diff = num(q.price_cents) - num(selected?.cost_per_unit_cents);
                return (
                  <tr key={q.id} className={isCheapest ? "bg-pistachio-soft/60" : undefined}>
                    <td className="font-extrabold">
                      {q.suppliers?.name}
                      {q.suppliers?.is_local && <span className="tag ml-2 bg-pistachio-soft text-pistachio-depth">Local</span>}
                      {isCheapest && <span className="tag ml-2 bg-butter text-cocoa">Cheapest</span>}
                    </td>
                    <td>{perUnit(num(q.price_cents))}</td>
                    <td className={diff > 0 ? "text-jam" : diff < 0 ? "text-pistachio-depth" : "text-cinnamon"}>
                      {Math.abs(diff) < 0.005 ? "same" : `${diff > 0 ? "+" : "−"}${perUnit(Math.abs(diff))}`}
                    </td>
                    <td className="text-cinnamon">{date(q.effective_on)}</td>
                    <td className="text-cinnamon">
                      {q.suppliers?.lead_time_days != null ? `${q.suppliers.lead_time_days}d` : "—"}
                    </td>
                    <td className="text-right">
                      {isPreferred ? (
                        <span className="tag bg-blueberry-soft text-blueberry-depth">Your usual</span>
                      ) : (
                        <button
                          className="btn-ghost px-3 py-1.5 text-xs"
                          disabled={makePreferred.isPending}
                          onClick={() => makePreferred.mutate(q.supplier_id)}
                        >
                          Make usual
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {ingredientId && (
        <form
          className="space-y-3 rounded-2xl bg-dough p-4"
          onSubmit={(e) => {
            e.preventDefault();
            addQuote.mutate();
          }}
        >
          <h3 className="font-extrabold">Record a new quote for {selected?.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="quote-supplier">Supplier</label>
              <select
                id="quote-supplier"
                className="input bg-white"
                required
                value={quote.supplier_id}
                onChange={(e) => setQuote({ ...quote, supplier_id: e.target.value })}
              >
                <option value="">Choose…</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="quote-price">Price ($)</label>
              <input
                id="quote-price"
                className="input bg-white"
                type="number"
                step="0.01"
                min={0}
                required
                value={quote.price}
                onChange={(e) => setQuote({ ...quote, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="quote-amount">For how much ({selected?.unit})</label>
              <input
                id="quote-amount"
                className="input bg-white"
                type="number"
                step="any"
                min={0}
                required
                placeholder={selected?.unit === "each" ? "e.g. 12" : "e.g. 1000"}
                value={quote.amount}
                onChange={(e) => setQuote({ ...quote, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="quote-date">Quoted on</label>
              <input
                id="quote-date"
                className="input bg-white"
                type="date"
                required
                value={quote.effective_on}
                onChange={(e) => setQuote({ ...quote, effective_on: e.target.value })}
              />
            </div>
          </div>
          {Number(quote.price) > 0 && Number(quote.amount) > 0 && (
            <p className="text-sm font-bold text-cinnamon">
              That's {perUnit((Number(quote.price) * 100) / Number(quote.amount))} per {selected?.unit}
              {selected && ` (you pay ${perUnit(num(selected.cost_per_unit_cents))} now)`}.
            </p>
          )}
          {addQuote.error && <p className="text-jam">{addQuote.error.message}</p>}
          <button className="btn-blue" disabled={addQuote.isPending || !(Number(quote.amount) > 0)}>
            {addQuote.isPending ? "Saving…" : "Save quote"}
          </button>
        </form>
      )}
    </section>
  );
}
