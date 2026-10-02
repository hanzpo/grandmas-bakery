import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { date, money, timeAgo } from "../../lib/format";
import { supabase, type Tables, type Views } from "../../lib/supabase";

type CustomerStat = Views<"customer_stats">;
type Filter = "all" | "b2b" | "regulars" | "lapsed";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const isRegular = (c: CustomerStat) => (c.order_count ?? 0) >= 3;
const isLapsed = (c: CustomerStat) =>
  !c.last_order_at || Date.now() - new Date(c.last_order_at).getTime() > THIRTY_DAYS_MS;

const FILTERS: { key: Filter; label: string; test: (c: CustomerStat) => boolean }[] = [
  { key: "all", label: "Everyone", test: () => true },
  { key: "regulars", label: "Regulars (3+ orders)", test: isRegular },
  { key: "lapsed", label: "Haven't been in (30d)", test: isLapsed },
  { key: "b2b", label: "Businesses", test: (c) => !!c.is_b2b },
];

export default function Customers() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customer_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_stats")
        .select("*")
        .order("lifetime_cents", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const test = FILTERS.find((f) => f.key === filter)!.test;
    return customers.filter(
      (c) =>
        test(c) &&
        (!q ||
          [c.name, c.email, c.phone, c.organization].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [customers, search, filter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Customer relationships</p>
          <h1 className="text-4xl font-black">Customers</h1>
          <p className="mt-1 text-cinnamon">{customers.length} people who love your parfaits</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + Add customer
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={filter === f.key ? "chip-active" : "chip"}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th className="text-right">Orders</th>
              <th className="text-right">Lifetime</th>
              <th className="text-right">Points</th>
              <th>Last order</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-cinnamon">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="text-cinnamon">
                  No customers match.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="cursor-pointer hover:bg-dough/70"
              >
                <td className="font-extrabold">
                  {c.name}
                  {c.is_b2b && (
                    <span className="tag ml-2 bg-blueberry-soft text-blueberry-depth">{c.organization || "B2B"}</span>
                  )}
                  {isRegular(c) && !c.is_b2b && <span className="tag ml-2 bg-butter text-cocoa">Regular</span>}
                </td>
                <td className="text-cinnamon">
                  <div>{c.email}</div>
                  <div>{c.phone}</div>
                </td>
                <td className="text-right">{c.order_count ?? 0}</td>
                <td className="text-right font-extrabold">{money(c.lifetime_cents)}</td>
                <td className="text-right">
                  <span className="tag bg-butter-soft text-cocoa">★ {c.loyalty_points ?? 0}</span>
                </td>
                <td className="text-cinnamon">{c.last_order_at ? timeAgo(c.last_order_at) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && <CustomerPanel id={selectedId} onClose={() => setSelectedId(null)} />}
      {adding && <AddCustomer onClose={() => setAdding(false)} onCreated={setSelectedId} />}
    </div>
  );
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-cocoa/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto border-l-2 border-crumb bg-flour p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-black">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

type CustomerForm = Pick<
  Tables<"customers">,
  "name" | "email" | "phone" | "organization" | "is_b2b" | "marketing_opt_in" | "notes"
>;

const emptyForm: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  organization: "",
  is_b2b: false,
  marketing_opt_in: false,
  notes: "",
};

/** Turn blank strings into nulls so unique email/phone constraints don't collide on "". */
const clean = (f: CustomerForm): CustomerForm => ({
  ...f,
  email: f.email?.trim() || null,
  phone: f.phone?.trim() || null,
  organization: f.organization?.trim() || null,
  notes: f.notes?.trim() || null,
});

function CustomerFields({ form, setForm }: { form: CustomerForm; setForm: (f: CustomerForm) => void }) {
  const set = <K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) => setForm({ ...form, [key]: value });
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Name</label>
        <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="size-5" checked={form.is_b2b} onChange={(e) => set("is_b2b", e.target.checked)} />
        Business customer (e.g. the University)
      </label>
      {form.is_b2b && (
        <div>
          <label className="label">Organization</label>
          <input className="input" value={form.organization ?? ""} onChange={(e) => set("organization", e.target.value)} />
        </div>
      )}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-5"
          checked={form.marketing_opt_in}
          onChange={(e) => set("marketing_opt_in", e.target.checked)}
        />
        Happy to get news & specials
      </label>
      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-24"
          placeholder="Favorite flavor, allergies, birthday…"
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
    </div>
  );
}

function AddCustomer({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("customers").insert(clean(form)).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["customer_stats"] });
      onClose();
      onCreated(id);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Drawer title="New customer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-6">
        <CustomerFields form={form} setForm={setForm} />
        {create.error && <p className="text-jam">{create.error.message}</p>}
        <button className="btn-primary w-full" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Add customer"}
        </button>
      </form>
    </Drawer>
  );
}

function CustomerPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: customer } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["customer_orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, source, total_cents, created_at, order_items(quantity, products(name))")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<CustomerForm>(emptyForm);
  useEffect(() => {
    if (customer) setForm(customer);
  }, [customer]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["customer", id] });
    qc.invalidateQueries({ queryKey: ["customer_stats"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").update(clean(form)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const adjustPoints = useMutation({
    mutationFn: async (delta: number) => {
      const next = Math.max(0, (customer?.loyalty_points ?? 0) + delta);
      const { error } = await supabase.from("customers").update({ loyalty_points: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  if (!customer) {
    return (
      <Drawer title="Loading…" onClose={onClose}>
        <p className="text-cinnamon">Loading…</p>
      </Drawer>
    );
  }

  return (
    <Drawer title={customer.name} onClose={onClose}>
      <div className="space-y-6">
        <section className="flex items-center justify-between rounded-3xl border-2 border-butter-depth bg-butter-soft p-5 shadow-[0_4px_0_var(--color-butter-depth)]">
          <div>
            <p className="eyebrow">Loyalty points</p>
            <p className="text-4xl font-black text-cocoa">★ {customer.loyalty_points}</p>
          </div>
          <div className="flex gap-2">
            {[-10, -1, 1, 10].map((d) => (
              <button
                key={d}
                className="btn-icon w-auto px-3 text-sm"
                disabled={adjustPoints.isPending}
                onClick={() => adjustPoints.mutate(d)}
              >
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <CustomerFields form={form} setForm={setForm} />
          {save.error && <p className="text-jam">{save.error.message}</p>}
          <button className="btn-primary w-full" disabled={save.isPending}>
            {save.isPending ? "Saving…" : save.isSuccess ? "Saved ✓" : "Save changes"}
          </button>
        </form>

        <section>
          <h3 className="mb-3 text-xl font-extrabold">Order history</h3>
          {orders.length === 0 && <p className="text-cinnamon">No orders yet.</p>}
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-black">#{o.order_number}</span>
                  <span className="font-black">{money(o.total_cents)}</span>
                </div>
                <div className="text-sm text-cinnamon">
                  {date(o.created_at)} · {o.source.replace("_", " ")} · {o.status.replace("_", " ")}
                </div>
                <div className="mt-1 text-sm">
                  {o.order_items.map((i) => `${i.quantity}× ${i.products?.name ?? "Item"}`).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Drawer>
  );
}
