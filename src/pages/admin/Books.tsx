import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { csvDollars, downloadCsv } from "../../lib/csv";
import { date, isoDay, money, shortDate } from "../../lib/format";
import { supabase, type Enums, type Tables } from "../../lib/supabase";

type Method = Enums<"payment_method">;
type Closeout = Tables<"daily_closeouts">;

const METHODS: { key: Method; label: string; hint: string }[] = [
  { key: "card_terminal", label: "Card terminal", hint: "Verifone" },
  { key: "cash", label: "Cash", hint: "In the drawer" },
  { key: "stripe", label: "Online", hint: "Paid on the website" },
  { key: "invoice", label: "Invoice", hint: "Billed to a business" },
];
const METHOD_LABEL: Record<Method, string> = {
  card_terminal: "Card terminal",
  cash: "Cash",
  stripe: "Online (Stripe)",
  invoice: "Invoice",
};
const pretty = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// ── Dates ─────────────────────────────────────────────────
/** Local midnight at the start of a YYYY-MM-DD day. */
const startOf = (day: string) => new Date(`${day}T00:00`);
/** Local midnight at the start of the following day (setDate handles daylight saving). */
const nextMidnight = (day: string) => {
  const d = startOf(day);
  d.setDate(d.getDate() + 1);
  return d;
};
const dayRange = (from: string, to: string) => ({ start: startOf(from).toISOString(), end: nextMidnight(to).toISOString() });
const clock = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Dollars typed into an input → integer cents, or null when left blank. */
const toCents = (dollars: string) => {
  if (dollars.trim() === "") return null;
  const n = Number(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const toDollars = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2));

// ── Paging: Supabase returns at most 1000 rows per request ──
const PAGE = 1000;
type PageResult<T> = PromiseLike<{ data: T[] | null; error: Error | null }>;
async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export default function Books() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Money</p>
        <h1 className="text-4xl font-black">Books</h1>
        <p className="mt-1 text-cinnamon">Check the till at closing, and get everything ready for tax time.</p>
      </header>
      <CloseOut />
      <PastCloseouts />
      <TaxTime />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 1. Close out the day
// ─────────────────────────────────────────────────────────
function CloseOut() {
  const today = isoDay();
  const [day, setDay] = useState(today);
  const { start, end } = dayRange(day, day);

  const payments = useQuery({
    queryKey: ["payments", "day", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("method, amount_cents")
        .gte("received_at", start)
        .lt("received_at", end);
      if (error) throw error;
      return data;
    },
  });

  const unpaid = useQuery({
    queryKey: ["orders", "no-payment", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, source, total_cents, created_at, customers(name), payments(id)")
        .not("status", "in", "(cancelled,pending_payment)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at");
      if (error) throw error;
      return data.filter((o) => o.payments.length === 0);
    },
  });

  const closeout = useQuery({
    queryKey: ["daily_closeouts", "day", day],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_closeouts").select("*").eq("day", day).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const recorded = useMemo(() => {
    const totals: Record<Method, { cents: number; count: number }> = {
      card_terminal: { cents: 0, count: 0 },
      cash: { cents: 0, count: 0 },
      stripe: { cents: 0, count: 0 },
      invoice: { cents: 0, count: 0 },
    };
    for (const p of payments.data ?? []) {
      totals[p.method].cents += Number(p.amount_cents);
      totals[p.method].count += 1;
    }
    return totals;
  }, [payments.data]);

  return (
    <section className="card space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">Close out the day</h2>
          <p className="text-cinnamon">Compare what the app recorded with the Verifone report and the cash drawer.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="closeout-day">Day</label>
            <input
              id="closeout-day"
              className="input"
              type="date"
              max={today}
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          </div>
          {day !== today && (
            <button type="button" className="btn-ghost" onClick={() => setDay(today)}>
              Today
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3">Recorded in the app · {day === today ? "today" : shortDate(day)}</p>
        {payments.error ? (
          <p className="text-jam">Couldn't load payments: {payments.error.message}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {METHODS.map((m) => (
              <div key={m.key} className="rounded-2xl border-2 border-crumb bg-dough p-4">
                <p className="text-sm font-extrabold">{m.label}</p>
                <p className="mt-1 text-3xl font-black tracking-tight">
                  {payments.isLoading ? "…" : money(recorded[m.key].cents)}
                </p>
                <p className="mt-1 text-sm font-bold text-cinnamon">
                  {recorded[m.key].count} payment{recorded[m.key].count === 1 ? "" : "s"} · {m.hint}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {closeout.isLoading || payments.isLoading ? (
        <p className="text-cinnamon">Loading…</p>
      ) : closeout.error ? (
        <p className="text-jam">Couldn't load the close-out: {closeout.error.message}</p>
      ) : (
        <CloseOutForm
          key={`${day}-${closeout.data?.closed_at ?? "new"}`}
          day={day}
          existing={closeout.data ?? null}
          cardExpected={recorded.card_terminal.cents}
          cashExpected={recorded.cash.cents}
          onlineCents={recorded.stripe.cents}
        />
      )}

      <div>
        <h3 className="text-lg font-extrabold">Orders with no payment recorded</h3>
        <p className="mb-3 text-sm text-cinnamon">If one of these was paid, that money is in the drawer or on the terminal but not in the app.</p>
        {unpaid.isLoading ? (
          <p className="text-cinnamon">Loading…</p>
        ) : unpaid.error ? (
          <p className="text-jam">Couldn't load orders: {unpaid.error.message}</p>
        ) : unpaid.data?.length ? (
          <div className="divide-y-2 divide-dough rounded-2xl border-2 border-crumb">
            {unpaid.data.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-black">#{o.order_number}</span>
                <span className="min-w-0 flex-1 font-bold">{o.customers?.name ?? "No name"}</span>
                <span className="tag bg-blueberry-soft text-blueberry-depth">{pretty(o.source)}</span>
                <span className="w-24 text-right text-lg font-black">{money(o.total_cents)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-pistachio-soft px-4 py-3 font-bold text-pistachio-depth">
            Every order on this day has a payment recorded.
          </p>
        )}
      </div>
    </section>
  );
}

function CloseOutForm({
  day,
  existing,
  cardExpected,
  cashExpected,
  onlineCents,
}: {
  day: string;
  existing: Closeout | null;
  cardExpected: number;
  cashExpected: number;
  onlineCents: number;
}) {
  const queryClient = useQueryClient();
  const [card, setCard] = useState(toDollars(existing?.card_counted_cents));
  const [cash, setCash] = useState(toDollars(existing?.cash_counted_cents));
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("daily_closeouts").upsert(
        {
          day,
          card_expected_cents: cardExpected,
          card_counted_cents: toCents(card),
          cash_expected_cents: cashExpected,
          cash_counted_cents: toCents(cash),
          online_cents: onlineCents,
          notes: notes.trim() || null,
          closed_at: new Date().toISOString(),
        },
        { onConflict: "day" },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily_closeouts"] }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <CountPanel
          id="closeout-card"
          label="Card total on the Verifone batch report ($)"
          expected={cardExpected}
          value={card}
          onChange={setCard}
        />
        <CountPanel
          id="closeout-cash"
          label="Cash counted in the drawer, minus the starting float ($)"
          expected={cashExpected}
          value={cash}
          onChange={setCash}
        />
      </div>
      <div>
        <label className="label" htmlFor="closeout-notes">Notes (optional)</label>
        <textarea
          id="closeout-notes"
          className="input"
          rows={2}
          placeholder="Gave Mrs. Lee $2 change too much, voided a card sale…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {save.error && <p className="text-jam">{save.error.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : existing ? "Update close-out" : "Close out the day"}
        </button>
        {existing && <span className="tag bg-pistachio-soft text-pistachio-depth">Closed at {clock(existing.closed_at)}</span>}
        {existing && <span className="text-sm text-cinnamon">Saving again updates it.</span>}
      </div>
    </form>
  );
}

function CountPanel({
  id,
  label,
  expected,
  value,
  onChange,
}: {
  id: string;
  label: string;
  expected: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const counted = toCents(value);
  return (
    <div className="space-y-3 rounded-2xl bg-dough p-4">
      <div>
        <label className="label" htmlFor={id}>{label}</label>
        <input
          id={id}
          className="input bg-white text-xl"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <p className="text-sm font-bold text-cinnamon">The app recorded {money(expected)}</p>
      <Difference expected={expected} counted={counted} />
    </div>
  );
}

const TONES = {
  pistachio: "bg-pistachio-soft text-pistachio-depth",
  jam: "bg-jam-soft text-jam-depth",
  butter: "bg-butter-soft text-cocoa",
};

function diffTone(expected: number, counted: number) {
  const diff = counted - expected;
  if (diff === 0) return { tone: TONES.pistachio, text: "Matches" };
  if (diff < 0) return { tone: TONES.jam, text: `Short ${money(-diff)}` };
  return { tone: TONES.butter, text: `Over ${money(diff)}` };
}

function Difference({ expected, counted }: { expected: number; counted: number | null }) {
  if (counted == null) return <p className="rounded-2xl bg-white px-4 py-3 font-bold text-cinnamon">Type the amount to check it.</p>;
  const { tone, text } = diffTone(expected, counted);
  return <p className={`rounded-2xl px-4 py-3 text-lg font-black ${tone}`}>{text}</p>;
}

function DiffTag({ expected, counted }: { expected: number; counted: number | null }) {
  if (counted == null) return <span className="text-cinnamon">—</span>;
  const { tone, text } = diffTone(expected, counted);
  return <span className={`tag ${tone}`}>{text}</span>;
}

// ─────────────────────────────────────────────────────────
// 2. Past close-outs
// ─────────────────────────────────────────────────────────
function PastCloseouts() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["daily_closeouts", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_closeouts").select("*").order("day", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-3 text-xl font-extrabold">Past close-outs</h2>
      {isLoading ? (
        <p className="text-cinnamon">Loading…</p>
      ) : error ? (
        <p className="text-jam">Couldn't load close-outs: {error.message}</p>
      ) : data.length === 0 ? (
        <p className="text-cinnamon">No close-outs yet. Close out today above when the shop shuts.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Day</th>
              <th className="text-right">Card: app</th>
              <th className="text-right">Card: Verifone</th>
              <th>Card</th>
              <th className="text-right">Cash: app</th>
              <th className="text-right">Cash: counted</th>
              <th>Cash</th>
              <th className="text-right">Online</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.day}>
                <td className="font-extrabold whitespace-nowrap">{shortDate(c.day)}</td>
                <td className="text-right">{money(c.card_expected_cents)}</td>
                <td className="text-right">{c.card_counted_cents == null ? "—" : money(c.card_counted_cents)}</td>
                <td><DiffTag expected={c.card_expected_cents} counted={c.card_counted_cents} /></td>
                <td className="text-right">{money(c.cash_expected_cents)}</td>
                <td className="text-right">{c.cash_counted_cents == null ? "—" : money(c.cash_counted_cents)}</td>
                <td><DiffTag expected={c.cash_expected_cents} counted={c.cash_counted_cents} /></td>
                <td className="text-right">{money(c.online_cents)}</td>
                <td className="text-cinnamon">{c.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────
// 3. Tax time
// ─────────────────────────────────────────────────────────
type Preset = "this_year" | "last_year" | "this_quarter" | "custom";
const PRESETS: Record<Preset, string> = {
  this_year: "This year",
  last_year: "Last year",
  this_quarter: "This quarter",
  custom: "Pick dates",
};

function presetRange(preset: Exclude<Preset, "custom">) {
  const now = new Date();
  const y = now.getFullYear();
  if (preset === "this_year") return { from: `${y}-01-01`, to: `${y}-12-31`, name: String(y) };
  if (preset === "last_year") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, name: String(y - 1) };
  const q = Math.floor(now.getMonth() / 3);
  return { from: isoDay(new Date(y, q * 3, 1)), to: isoDay(new Date(y, q * 3 + 3, 0)), name: `${y}-Q${q + 1}` };
}

async function fetchTaxData(from: string, to: string) {
  const { start, end } = dayRange(from, to);
  const [orders, payments, expenses, supplierOrders, purchases] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("orders")
        .select("id, order_number, created_at, source, subtotal_cents, tax_cents, total_cents, customers(name), payments(method)")
        .not("status", "in", "(cancelled,pending_payment)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("payments")
        .select("id, method, amount_cents, received_at, external_ref, orders(order_number)")
        .gte("received_at", start)
        .lt("received_at", end)
        .order("received_at")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("expenses")
        .select("id, category, description, amount_cents, paid_on, is_recurring, recurrence, suppliers(name)")
        .eq("paid", true)
        .gte("paid_on", from)
        .lte("paid_on", to)
        .order("paid_on")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("supplier_orders")
        .select("id, ordered_on, paid_on, suppliers(name), supplier_order_items(quantity, quantity_received, unit_cost_cents)")
        .neq("status", "cancelled")
        .gte("paid_on", from)
        .lte("paid_on", to)
        .order("paid_on")
        .order("id")
        .range(a, b),
    ),
    // Ad-hoc purchases only: deliveries from ingredient orders are counted through supplier_orders above.
    fetchAll((a, b) =>
      supabase
        .from("inventory_transactions")
        .select("id, quantity, unit_cost_cents, occurred_at, ingredients(name), suppliers(name)")
        .eq("type", "purchase")
        .eq("paid", true)
        .is("supplier_order_id", null)
        .gte("occurred_at", start)
        .lt("occurred_at", end)
        .order("occurred_at")
        .order("id")
        .range(a, b),
    ),
  ]);

  type Spend = { date: string; category: string; description: string; payee: string; cents: number; recurring: string };
  const spending: Spend[] = [
    ...expenses.map((e) => ({
      date: e.paid_on ?? "",
      category: e.category,
      description: e.description ?? pretty(e.category),
      payee: e.suppliers?.name ?? "",
      cents: Number(e.amount_cents),
      recurring: e.is_recurring ? (e.recurrence ?? "yes") : "",
    })),
    ...supplierOrders.map((o) => ({
      date: o.paid_on ?? "",
      category: "ingredients",
      description: `Ingredient order (${shortDate(o.ordered_on)})`,
      payee: o.suppliers?.name ?? "",
      cents: Math.round(
        o.supplier_order_items.reduce(
          (s, i) => s + Number(i.quantity_received ?? i.quantity) * Number(i.unit_cost_cents),
          0,
        ),
      ),
      recurring: "",
    })),
    ...purchases.map((t) => ({
      date: isoDay(new Date(t.occurred_at)),
      category: "ingredients",
      description: `Bought ${t.ingredients?.name ?? "ingredients"}`,
      payee: t.suppliers?.name ?? "",
      cents: Math.round(Number(t.quantity) * Number(t.unit_cost_cents ?? 0)),
      recurring: "",
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return { orders, payments, spending };
}

function TaxTime() {
  const [preset, setPreset] = useState<Preset>("this_year");
  const [custom, setCustom] = useState(() => ({ from: `${new Date().getFullYear()}-01-01`, to: isoDay() }));

  const range =
    preset === "custom"
      ? { ...custom, name: `${custom.from}-to-${custom.to}` }
      : presetRange(preset);
  const valid = !!range.from && !!range.to && range.from <= range.to;

  const { data, isLoading, error } = useQuery({
    queryKey: ["books", "tax", range.from, range.to],
    enabled: valid,
    queryFn: () => fetchTaxData(range.from, range.to),
  });

  const summary = useMemo(() => {
    if (!data) return null;
    const byMethod = new Map<Method, number>();
    for (const p of data.payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount_cents));
    const byCategory = new Map<string, number>();
    for (const s of data.spending) byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + s.cents);
    const sales = data.orders.reduce((s, o) => s + Number(o.total_cents), 0);
    const tax = data.orders.reduce((s, o) => s + Number(o.tax_cents), 0);
    const out = data.spending.reduce((s, x) => s + x.cents, 0);
    return {
      sales,
      tax,
      out,
      left: sales - out,
      orderCount: data.orders.length,
      paymentsTotal: data.payments.reduce((s, p) => s + Number(p.amount_cents), 0),
      byMethod: METHODS.map((m) => ({ ...m, cents: byMethod.get(m.key) ?? 0 })),
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [data]);

  const file = (kind: string) => `grandmas-bakery-${kind}-${range.name}.csv`;

  const downloadSales = () =>
    data &&
    downloadCsv(file("sales"), [
      ["Date", "Order #", "Source", "Customer", "Subtotal", "Tax", "Total", "Payment methods"],
      ...data.orders.map((o) => [
        isoDay(new Date(o.created_at)),
        o.order_number,
        pretty(o.source),
        o.customers?.name ?? "",
        csvDollars(o.subtotal_cents),
        csvDollars(o.tax_cents),
        csvDollars(o.total_cents),
        [...new Set(o.payments.map((p) => METHOD_LABEL[p.method]))].join("; ") || "None recorded",
      ]),
    ]);

  const downloadPayments = () =>
    data &&
    downloadCsv(file("payments"), [
      ["Date", "Method", "Amount", "Order #", "Reference"],
      ...data.payments.map((p) => [
        isoDay(new Date(p.received_at)),
        METHOD_LABEL[p.method],
        csvDollars(p.amount_cents),
        p.orders?.order_number ?? "",
        p.external_ref ?? "",
      ]),
    ]);

  const downloadExpenses = () =>
    data &&
    downloadCsv(file("expenses"), [
      ["Date paid", "Category", "Description", "Payee", "Amount", "Recurring"],
      ...data.spending.map((s) => [s.date, s.category, s.description, s.payee, csvDollars(s.cents), s.recurring]),
    ]);

  const downloadSummary = () =>
    summary &&
    downloadCsv(file("summary"), [
      ["Grandma's Bakery", `${range.from} to ${range.to}`],
      [],
      ["Item", "Amount"],
      ["Sales (orders)", csvDollars(summary.sales)],
      ["Number of orders", summary.orderCount],
      ["Sales tax collected", csvDollars(summary.tax)],
      [],
      ["Payments received", ""],
      ...summary.byMethod.map((m) => [METHOD_LABEL[m.key], csvDollars(m.cents)]),
      ["All payments", csvDollars(summary.paymentsTotal)],
      [],
      ["Spending by category", ""],
      ...summary.byCategory.map(([c, cents]) => [pretty(c), csvDollars(cents)]),
      [],
      ["Money in", csvDollars(summary.sales)],
      ["Money out", csvDollars(summary.out)],
      ["What's left", csvDollars(summary.left)],
    ]);

  return (
    <section className="card space-y-6">
      <div>
        <h2 className="text-xl font-extrabold">Tax time</h2>
        <p className="text-cinnamon">Everything that came in and went out, ready to hand to the accountant.</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as Preset[]).map((p) => (
            <button key={p} type="button" className={preset === p ? "chip-active" : "chip"} onClick={() => setPreset(p)}>
              {PRESETS[p]}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="grid gap-3 sm:grid-cols-2 md:max-w-xl">
            <div>
              <label className="label" htmlFor="tax-from">From</label>
              <input
                id="tax-from"
                className="input"
                type="date"
                value={custom.from}
                onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="tax-to">To</label>
              <input
                id="tax-to"
                className="input"
                type="date"
                value={custom.to}
                onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <p className="font-bold text-cinnamon">
            {date(range.from)} to {date(range.to)}
          </p>
        )}
        {!valid && <p className="text-jam">Pick a start date that comes before the end date.</p>}
      </div>

      {isLoading && valid ? (
        <p className="text-cinnamon">Adding it all up…</p>
      ) : error ? (
        <p className="text-jam">Couldn't load the books: {error.message}</p>
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Total label="Money in" value={money(summary.sales)}>
              Sales from {summary.orderCount} order{summary.orderCount === 1 ? "" : "s"}
            </Total>
            <Total label="Money out" value={money(summary.out)}>
              Paid bills and ingredients
            </Total>
            <Total label="What's left" value={money(summary.left)} valueClass={summary.left < 0 ? "text-jam" : "text-pistachio-depth"}>
              Money in minus money out
            </Total>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Breakdown title="Sales">
              <Row label="Sales" cents={summary.sales} />
              <Row label="Sales tax collected" cents={summary.tax} />
              <p className="pt-2 text-sm text-cinnamon">
                Sales tax isn't worked out on orders yet, so this stays at $0 unless it was set on an order. Check with
                the accountant about what's owed.
              </p>
            </Breakdown>
            <Breakdown title="Payments by method">
              {summary.byMethod.map((m) => (
                <Row key={m.key} label={METHOD_LABEL[m.key]} cents={m.cents} />
              ))}
              <Row label="All payments" cents={summary.paymentsTotal} strong />
            </Breakdown>
            <Breakdown title="Spending by kind">
              {summary.byCategory.length === 0 ? (
                <p className="text-cinnamon">Nothing paid in these dates.</p>
              ) : (
                summary.byCategory.map(([c, cents]) => <Row key={c} label={pretty(c)} cents={cents} />)
              )}
              <Row label="All spending" cents={summary.out} strong />
            </Breakdown>
          </div>

          <div>
            <p className="eyebrow mb-3">Download for the accountant</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-blue" onClick={downloadSummary}>Summary</button>
              <button type="button" className="btn-ghost" onClick={downloadSales}>Sales</button>
              <button type="button" className="btn-ghost" onClick={downloadPayments}>Payments</button>
              <button type="button" className="btn-ghost" onClick={downloadExpenses}>Expenses</button>
            </div>
            <p className="mt-2 text-sm text-cinnamon">Spreadsheet files (.csv) that open in Excel, Numbers or Google Sheets.</p>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Total({ label, value, valueClass = "", children }: { label: string; value: string; valueClass?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-crumb bg-dough p-5">
      <p className="text-sm font-extrabold">{label}</p>
      <p className={`mt-1 text-4xl font-black tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-2 text-sm font-bold text-cinnamon">{children}</p>
    </div>
  );
}

function Breakdown({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-crumb p-5">
      <h3 className="mb-2 text-lg font-extrabold">{title}</h3>
      <div className="divide-y-2 divide-dough">{children}</div>
    </div>
  );
}

function Row({ label, cents, strong = false }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-2 ${strong ? "font-black" : ""}`}>
      <span>{label}</span>
      <span className={strong ? "text-lg" : "font-extrabold"}>{money(cents)}</span>
    </div>
  );
}
