import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { isoDay, money, shortDate } from "../../lib/format";
import { supabase } from "../../lib/supabase";

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d: Date) => startOfDay(d).toDateString();
const counts = (status: string) => !["pending_payment", "cancelled"].includes(status);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Overview() {
  const today = startOfDay(new Date());
  const since = new Date(today.getTime() - 7 * DAY_MS);

  // Orders from the last 8 days, bucketed by local day (drives KPIs and the 7-day chart).
  const orders = useQuery({
    queryKey: ["overview-orders", since.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, source, total_cents, created_at, pickup_at, customers(name)")
        .gte("created_at", since.toISOString())
        .order("created_at");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const queue = useQuery({
    queryKey: ["overview-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, source, pickup_at, customers(name)")
        .in("status", ["new", "in_progress", "ready"])
        .order("pickup_at", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const lowStock = useQuery({
    queryKey: ["overview-low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("low_stock_ingredients")
        .select("id, name, quantity_on_hand, reorder_threshold, unit")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const expiring = useQuery({
    queryKey: ["overview-expiring"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expiring_lots").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Deliveries due today or late, and bills overdue or due in the next 3 days.
  const ledger = useQuery({
    queryKey: ["overview-ledger"],
    queryFn: async () => {
      const soon = isoDay(new Date(Date.now() + 3 * DAY_MS));
      const [deliveries, bills] = await Promise.all([
        supabase
          .from("supplier_orders")
          .select("id, expected_on, suppliers(name)")
          .eq("status", "ordered")
          .lte("expected_on", isoDay())
          .order("expected_on"),
        supabase.from("bills_due").select("*").lte("due_on", soon).order("due_on"),
      ]);
      if (deliveries.error) throw deliveries.error;
      if (bills.error) throw bills.error;
      return { deliveries: deliveries.data, bills: bills.data };
    },
  });
  const deliveries = ledger.data?.deliveries ?? [];
  const bills = ledger.data?.bills ?? [];

  const valid = (orders.data ?? []).filter((o) => counts(o.status));
  const todays = valid.filter((o) => dayKey(new Date(o.created_at)) === today.toDateString());
  const lastWeek = valid.filter((o) => dayKey(new Date(o.created_at)) === since.toDateString());
  const salesToday = todays.reduce((s, o) => s + o.total_cents, 0);
  const salesLastWeek = lastWeek.reduce((s, o) => s + o.total_cents, 0);
  const pct = salesLastWeek > 0 ? Math.round(((salesToday - salesLastWeek) / salesLastWeek) * 100) : null;
  const remote = todays.filter((o) => ["phone", "voice_agent", "online"].includes(o.source)).length;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * DAY_MS);
    const total = valid.filter((o) => dayKey(new Date(o.created_at)) === d.toDateString()).reduce((s, o) => s + o.total_cents, 0);
    return { label: i === 6 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }), total, isToday: i === 6 };
  });
  const weekTotal = days.reduce((s, d) => s + d.total, 0);
  const max = Math.max(...days.map((d) => d.total), 1);

  const q = queue.data ?? [];
  const byStatus = (s: string) => q.filter((o) => o.status === s);
  const low = lowStock.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      <h1 className="mt-1 text-4xl">{greeting()}, Grandma!</h1>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Sales today" value={money(salesToday)}>
          {pct === null ? "First sales of the week" : `${pct >= 0 ? "+" : ""}${pct}% vs. last ${today.toLocaleDateString("en-US", { weekday: "long" })}`}
        </Kpi>
        <Kpi label="Orders today" value={todays.length.toString()}>
          {remote} by phone or online
        </Kpi>
        <Kpi label="Open in queue" value={q.length.toString()}>
          {byStatus("new").length} new · {byStatus("in_progress").length} baking · {byStatus("ready").length} ready
        </Kpi>
        <Kpi label="Low-stock items" value={low.length.toString()} valueClass={low.length ? "text-jam" : ""}>
          {low.length ? low.map((i) => i.name).join(", ") : "Everything's stocked"}
        </Kpi>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="card">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-black">Sales, last 7 days</h2>
            <span className="text-sm font-extrabold text-cinnamon">Total {money(weekTotal)}</span>
          </div>
          <div className="mt-6 flex h-64 items-end gap-3 sm:gap-5">
            {days.map((d) => (
              <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className={`text-xs font-extrabold sm:text-sm ${d.isToday ? "text-jam-depth" : "text-cinnamon"}`}>
                  {money(d.total).replace(/\.00$/, "")}
                </span>
                <div
                  className={`w-full rounded-t-2xl rounded-b-md ${d.isToday ? "bg-jam" : "bg-[#f4b8c6]"}`}
                  style={{
                    height: `${Math.max((d.total / max) * 100, 3)}%`,
                    boxShadow: `inset 0 -4px 0 ${d.isToday ? "var(--color-jam-depth)" : "#e48da3"}`,
                  }}
                />
                <span className={`text-sm font-extrabold ${d.isToday ? "text-cocoa" : "text-cinnamon"}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-black">Needs attention</h2>
          <div className="mt-4 space-y-3">
            {low.map((i) => (
              <Attention key={i.id} tone="jam" title={`${i.name} is low`} action={<Link to="/admin/inventory" className="btn-ghost px-3 py-1.5 text-sm text-jam">Compare</Link>}>
                {Number(i.quantity_on_hand)} {i.unit} left, reorder at {Number(i.reorder_threshold)} {i.unit}
              </Attention>
            ))}
            {(expiring.data ?? []).map((l) => (
              <Attention key={l.id} tone="butter" title={`${l.name} expires soon`}>
                {Number(l.quantity)} {l.unit} lot · use by {l.expires_on && new Date(l.expires_on + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </Attention>
            ))}
            {deliveries.map((d) => (
              <Attention
                key={d.id}
                tone="blueberry"
                title={`Delivery from ${d.suppliers?.name}`}
                action={<Link to="/admin/inventory?tab=orders" className="btn-ghost px-3 py-1.5 text-sm">Check in</Link>}
              >
                {d.expected_on === isoDay() ? "Expected today" : `Was due ${shortDate(d.expected_on)}`}
              </Attention>
            ))}
            {bills.map((b) => (
              <Attention
                key={`${b.kind}-${b.id}`}
                tone={b.due_on && b.due_on < isoDay() ? "jam" : "butter"}
                title={`Pay ${b.payee} ${money(b.amount_cents)}`}
                action={<Link to="/admin/inventory?tab=bills" className="btn-ghost px-3 py-1.5 text-sm">Bills</Link>}
              >
                {b.description} · {b.due_on && b.due_on < isoDay() ? "overdue since" : "due"} {shortDate(b.due_on)}
              </Attention>
            ))}
            {byStatus("ready").map((o) => (
              <Attention key={o.id} tone="pistachio" title="Ready for pickup">
                #{o.order_number} for {o.customers?.name ?? "walk-in"}
                {o.pickup_at && ` at ${new Date(o.pickup_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
              </Attention>
            ))}
            {byStatus("new").length > 0 && (
              <Attention
                tone="blueberry"
                title={`${byStatus("new").length} new order${byStatus("new").length > 1 ? "s" : ""} waiting`}
                action={<Link to="/admin/queue" className="btn-ghost px-3 py-1.5 text-sm">Open</Link>}
              >
                {byStatus("new").slice(0, 3).map((o) => `#${o.order_number}`).join(", ")} in the queue
              </Attention>
            )}
            {!low.length && !expiring.data?.length && !q.length && !deliveries.length && !bills.length && (
              <p className="text-cinnamon">All quiet. Time for a cup of tea.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, valueClass = "", children }: { label: string; value: string; valueClass?: string; children: ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-extrabold">{label}</p>
      <p className={`mt-1 text-4xl font-black tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-2 text-sm font-bold text-cinnamon">{children}</p>
    </div>
  );
}

const TONES = {
  jam: "bg-jam-soft text-jam-depth",
  butter: "bg-butter-soft text-[#6b4a00]",
  pistachio: "bg-pistachio-soft text-[#235c28]",
  blueberry: "bg-blueberry-soft text-blueberry-depth",
};

function Attention({ tone, title, action, children }: { tone: keyof typeof TONES; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${TONES[tone]}`}>
      <div className="min-w-0 flex-1">
        <p className="font-black">{title}</p>
        <p className="text-sm font-bold opacity-90">{children}</p>
      </div>
      {action}
    </div>
  );
}
