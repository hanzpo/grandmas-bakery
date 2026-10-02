import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { isoDay, money, shortDate } from "../../../lib/format";
import { supabase, type Views } from "../../../lib/supabase";
import { toCents, useInvalidateLedger, useSuppliers } from "./shared";

type Bill = Views<"bills_due">;

const CATEGORIES = ["rent", "utilities", "ingredients", "packaging", "equipment", "insurance", "marketing", "other"];
const REPEATS = { "": "Just once", weekly: "Every week", monthly: "Every month", yearly: "Every year" } as const;

const KIND_LABELS: Record<string, string> = {
  supplier_order: "Ingredient order",
  purchase: "Ingredient purchase",
  expense: "Bill",
};

export default function Bills() {
  const [adding, setAdding] = useState(false);
  const { data: bills = [], isLoading, error } = useQuery({
    queryKey: ["bills_due"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills_due").select("*").order("due_on");
      if (error) throw error;
      return data;
    },
  });

  const today = isoDay();
  const overdue = bills.filter((b) => b.due_on && b.due_on < today);
  const owed = bills.reduce((s, b) => s + (b.amount_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Bills to pay</h2>
          <p className="text-cinnamon">
            {bills.length === 0
              ? "All paid up."
              : `${money(owed)} owed across ${bills.length} bill${bills.length > 1 ? "s" : ""}${overdue.length ? `, ${overdue.length} overdue` : ""}.`}
          </p>
        </div>
        {!adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            Add a bill
          </button>
        )}
      </div>

      {adding && <AddBillForm onDone={() => setAdding(false)} />}

      {isLoading && <p className="text-cinnamon">Loading…</p>}
      {error && <p className="text-jam">Couldn't load bills: {error.message}</p>}

      {bills.length > 0 && (
        <section className="card divide-y-2 divide-dough p-0">
          {bills.map((b) => (
            <BillRow key={`${b.kind}-${b.id}`} bill={b} today={today} />
          ))}
        </section>
      )}

      <RecentlyPaid />
    </div>
  );
}

function BillRow({ bill, today }: { bill: Bill; today: string }) {
  const invalidate = useInvalidateLedger();
  const late = bill.due_on != null && bill.due_on < today;
  const soon = !late && bill.due_on != null && bill.due_on <= isoDay(new Date(Date.now() + 7 * 86_400_000));

  const pay = useMutation({
    mutationFn: async () => {
      const id = bill.id!;
      const { error } =
        bill.kind === "supplier_order"
          ? await supabase.from("supplier_orders").update({ paid_on: isoDay() }).eq("id", id)
          : bill.kind === "purchase"
            ? await supabase.from("inventory_transactions").update({ paid: true }).eq("id", id)
            : await supabase.from("expenses").update({ paid: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-black">
          {bill.payee}
          {bill.is_recurring && <span className="tag ml-2 bg-blueberry-soft text-blueberry-depth">Repeats</span>}
        </p>
        <p className="text-sm text-cinnamon">
          {KIND_LABELS[bill.kind ?? ""]} · {bill.description}
        </p>
      </div>
      <span
        className={`tag ${late ? "bg-jam-soft text-jam-depth" : soon ? "bg-butter-soft text-cocoa" : "bg-dough text-cinnamon"}`}
      >
        {late ? "Overdue · " : "Due "}
        {bill.due_on === today ? "today" : shortDate(bill.due_on)}
      </span>
      <span className="w-24 text-right text-lg font-black">{money(bill.amount_cents)}</span>
      <button className="btn-ghost px-4" disabled={pay.isPending} onClick={() => pay.mutate()}>
        {pay.isPending ? "…" : "Paid"}
      </button>
      {pay.error && <p className="w-full text-jam">{pay.error.message}</p>}
    </div>
  );
}

function AddBillForm({ onDone }: { onDone: () => void }) {
  const invalidate = useInvalidateLedger();
  const { data: suppliers } = useSuppliers();
  const [form, setForm] = useState({
    description: "",
    category: "utilities",
    amount: "",
    due: isoDay(),
    recurrence: "" as keyof typeof REPEATS,
    supplier_id: "",
    paid: false,
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: bill, error } = await supabase
        .from("expenses")
        .insert({
          description: form.description.trim() || null,
          category: form.category,
          amount_cents: toCents(form.amount),
          incurred_on: form.due,
          is_recurring: !!form.recurrence,
          recurrence: form.recurrence || null,
          supplier_id: form.supplier_id || null,
          paid: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Paying goes through the update trigger so a repeating bill schedules its next one.
      if (form.paid) {
        const { error: payError } = await supabase.from("expenses").update({ paid: true }).eq("id", bill.id);
        if (payError) throw payError;
      }
    },
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h3 className="text-xl font-extrabold">Add a bill</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="bill-desc">What for</label>
          <input
            id="bill-desc"
            className="input"
            required
            placeholder="Electric, shop rent, cups…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="bill-category">Kind</label>
          <select
            id="bill-category"
            className="input capitalize"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bill-amount">Amount ($)</label>
          <input
            id="bill-amount"
            className="input"
            type="number"
            step="0.01"
            min={0}
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="bill-due">Due</label>
          <input
            id="bill-due"
            className="input"
            type="date"
            required
            value={form.due}
            onChange={(e) => setForm({ ...form, due: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="bill-supplier">Paid to (optional)</label>
          <select
            id="bill-supplier"
            className="input"
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
          >
            <option value="">—</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="label">Repeats</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REPEATS) as (keyof typeof REPEATS)[]).map((r) => (
            <button
              key={r}
              type="button"
              className={form.recurrence === r ? "chip-active" : "chip"}
              onClick={() => setForm({ ...form, recurrence: r })}
            >
              {REPEATS[r]}
            </button>
          ))}
        </div>
        {form.recurrence && (
          <p className="mt-2 text-sm text-cinnamon">When you mark it paid, the next one is added automatically.</p>
        )}
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" className="size-5" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} />
        Already paid
      </label>

      {add.error && <p className="text-jam">{add.error.message}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={add.isPending}>
          {add.isPending ? "Saving…" : "Save bill"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RecentlyPaid() {
  const since = isoDay(new Date(Date.now() - 45 * 86_400_000));
  const { data } = useQuery({
    queryKey: ["expenses", "paid", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, suppliers(name)")
        .eq("paid", true)
        .gte("paid_on", since)
        .order("paid_on", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  if (!data?.length) return null;
  return (
    <section className="card overflow-x-auto">
      <h3 className="mb-3 text-xl font-extrabold">Paid recently</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Bill</th>
            <th>Paid on</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.map((e) => (
            <tr key={e.id}>
              <td>
                <span className="font-extrabold">{e.description ?? e.category}</span>
                {e.suppliers?.name && <span className="text-cinnamon"> · {e.suppliers.name}</span>}
                {e.is_recurring && <span className="tag ml-2 bg-blueberry-soft text-blueberry-depth">{e.recurrence}</span>}
              </td>
              <td className="text-cinnamon">{shortDate(e.paid_on)}</td>
              <td className="text-right font-bold">{money(e.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
