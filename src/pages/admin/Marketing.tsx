import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money, timeAgo } from "../../lib/format";
import { supabase, type Enums } from "../../lib/supabase";

const COLORS = {
  jam: "#D4335A",
  blueberry: "#2672C9",
  butter: "#FFC93C",
  pistachio: "#58B85F",
  cinnamon: "#8A6A58",
  crumb: "#E8DDCC",
};

const SOURCE_COLORS: Record<Enums<"order_source">, string> = {
  walk_in: COLORS.jam,
  online: COLORS.blueberry,
  phone: COLORS.butter,
  voice_agent: COLORS.pistachio,
  b2b: COLORS.cinnamon,
};

const AXIS = { stroke: COLORS.cinnamon, fontSize: 12, fontWeight: 700 };

const SOURCE_LABELS: Record<Enums<"order_source">, string> = {
  walk_in: "Walk-in",
  online: "Online",
  phone: "Phone",
  voice_agent: "Voice agent",
  b2b: "Business",
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const dollars = (cents: number) => Math.round(cents) / 100;

export default function Marketing() {
  const since = useMemo(() => new Date(Date.now() - THIRTY_DAYS_MS).toISOString().slice(0, 10), []);

  const { data: sales = [] } = useQuery({
    queryKey: ["daily_sales", since],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_sales").select("*").gte("day", since).order("day");
      if (error) throw error;
      return data;
    },
  });

  const { data: productSales = [] } = useQuery({
    queryKey: ["product_sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_sales").select("*").order("revenue_cents", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customer_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_stats").select("*").order("lifetime_cents", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: flavor } = useQuery({
    queryKey: ["flavor_of_month"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price_cents")
        .eq("is_flavor_of_month", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── KPIs ──
  const revenue30 = sales.reduce((s, r) => s + (r.revenue_cents ?? 0), 0);
  const orders30 = sales.reduce((s, r) => s + (r.orders ?? 0), 0);
  const avgOrder = orders30 ? revenue30 / orders30 : 0;
  const buyers = customers.filter((c) => (c.order_count ?? 0) > 0);
  const repeatRate = buyers.length ? buyers.filter((c) => (c.order_count ?? 0) > 1).length / buyers.length : 0;

  // ── Revenue by day, one series per order source ──
  const sources = useMemo(
    () => [...new Set(sales.map((r) => r.source).filter((s): s is Enums<"order_source"> => !!s))],
    [sales],
  );
  const revenueByDay = useMemo(() => {
    const byDay = new Map<string, Record<string, number | string>>();
    for (const r of sales) {
      if (!r.day || !r.source) continue;
      const row = byDay.get(r.day) ?? { day: r.day };
      row[r.source] = dollars(r.revenue_cents ?? 0);
      byDay.set(r.day, row);
    }
    return [...byDay.values()];
  }, [sales]);

  const topProducts = productSales.slice(0, 8).map((p) => ({
    name: p.name ?? "—",
    revenue: dollars(p.revenue_cents ?? 0),
    units: p.units ?? 0,
  }));

  // ── Flavor of the month vs the rest ──
  const totalUnits = productSales.reduce((s, p) => s + (p.units ?? 0), 0);
  const flavorSales = productSales.find((p) => p.product_id === flavor?.id);
  const flavorRank = flavorSales ? productSales.findIndex((p) => p.product_id === flavor?.id) + 1 : null;

  const topCustomers = customers.slice(0, 10);
  const lapsedRegulars = customers.filter(
    (c) =>
      (c.order_count ?? 0) >= 3 &&
      (!c.last_order_at || Date.now() - new Date(c.last_order_at).getTime() > THIRTY_DAYS_MS),
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Last 30 days</p>
        <h1 className="text-4xl font-black">Marketing</h1>
        <p className="mt-1 text-cinnamon">How the bakery is doing, and who to bring back.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Revenue (30d)" value={money(revenue30)} accent />
        <Kpi label="Orders (30d)" value={orders30.toLocaleString()} />
        <Kpi label="Avg order" value={money(avgOrder)} />
        <Kpi label="Repeat customers" value={`${Math.round(repeatRate * 100)}%`} hint={`${buyers.length} buyers`} />
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-extrabold">Revenue by day</h2>
        {revenueByDay.length === 0 ? (
          <Empty>No sales in the last 30 days yet.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueByDay}>
              <CartesianGrid vertical={false} stroke={COLORS.crumb} />
              <XAxis
                dataKey="day"
                tickFormatter={(d: string) => new Date(`${d}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                tick={AXIS}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tickFormatter={(v: number) => `$${v}`} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => `$${Number(v).toFixed(2)}`}
                contentStyle={{ borderRadius: 16, border: `2px solid ${COLORS.crumb}`, fontWeight: 700 }}
              />
              <Legend wrapperStyle={{ fontWeight: 800 }} />
              {sources.map((s) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={SOURCE_LABELS[s]}
                  stackId="revenue"
                  stroke={SOURCE_COLORS[s]}
                  strokeWidth={3}
                  fill={SOURCE_COLORS[s]}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-4 text-xl font-extrabold">Top products</h2>
          {topProducts.length === 0 ? (
            <Empty>No product sales yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke={COLORS.crumb} horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => `$${v}`} tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#F6EFE4" }}
                  formatter={(v, name) => (name === "revenue" ? `$${Number(v).toFixed(2)}` : v)}
                  contentStyle={{ borderRadius: 16, border: `2px solid ${COLORS.crumb}`, fontWeight: 700 }}
                />
                <Bar dataKey="revenue" fill={COLORS.jam} radius={[0, 12, 12, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-3xl border-2 border-butter-depth bg-butter-soft p-6 shadow-[0_4px_0_var(--color-butter-depth)]">
          <span className="tag bg-butter text-cocoa">🍂 Flavor of the month</span>
          {flavor ? (
            <>
              <h2 className="mt-3 text-2xl font-black">{flavor.name}</h2>
              <p className="mb-4 text-sm text-cinnamon">{flavor.description}</p>
              <dl className="grid grid-cols-2 gap-3">
                <Stat label="Units sold" value={(flavorSales?.units ?? 0).toLocaleString()} />
                <Stat label="Revenue" value={money(flavorSales?.revenue_cents)} />
                <Stat
                  label="Share of units"
                  value={totalUnits ? `${Math.round(((flavorSales?.units ?? 0) / totalUnits) * 100)}%` : "—"}
                />
                <Stat label="Rank" value={flavorRank ? `#${flavorRank} of ${productSales.length}` : "—"} />
              </dl>
            </>
          ) : (
            <Empty>No flavor of the month set. Mark one on the Menu page.</Empty>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card">
          <h2 className="mb-4 text-xl font-extrabold">Best customers</h2>
          <ol className="space-y-2">
            {topCustomers.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-dough px-3 py-2">
                <span className="font-bold">
                  <span
                    className={`mr-2 inline-flex size-7 items-center justify-center rounded-full text-sm font-black ${
                      i === 0 ? "bg-butter text-cocoa" : "bg-white text-cinnamon"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {c.name}
                  {c.is_b2b && (
                    <span className="tag ml-2 bg-blueberry-soft text-blueberry-depth">{c.organization || "B2B"}</span>
                  )}
                </span>
                <span className="font-black">{money(c.lifetime_cents)}</span>
              </li>
            ))}
          </ol>
          {topCustomers.length === 0 && <Empty>No customers yet.</Empty>}
        </section>

        <section className="card">
          <h2 className="mb-1 text-xl font-extrabold">Regulars to win back</h2>
          <p className="mb-4 text-sm text-cinnamon">3+ orders, but nothing in 30 days</p>
          <ul className="space-y-3">
            {lapsedRegulars.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-jam-soft px-3 py-2">
                <div>
                  <div className="font-extrabold text-jam-depth">{c.name}</div>
                  <div className="text-xs text-cinnamon">
                    Last order {c.last_order_at ? timeAgo(c.last_order_at) : "never"} · {c.order_count} orders
                  </div>
                </div>
                {c.email && (
                  <a
                    className="btn-ghost bg-white px-3 py-2 text-xs text-jam"
                    href={`mailto:${c.email}?subject=${encodeURIComponent("We miss you at Grandma's Bakery!")}&body=${encodeURIComponent(
                      `Hi ${c.name},\n\nIt's been a while! Come by this week and your next parfait is on us.\n\n— Grandma`,
                    )}`}
                  >
                    ✉️ Email
                  </a>
                )}
              </li>
            ))}
          </ul>
          {lapsedRegulars.length === 0 && <Empty>Everyone's been in recently 🎉</Empty>}
        </section>

        <section className="card">
          <h2 className="mb-1 text-xl font-extrabold">Reviews</h2>
          <p className="mb-4 text-sm text-cinnamon">Google Maps & Yelp</p>
          <div className="rounded-2xl border-2 border-dashed border-crumb bg-dough p-5 text-center">
            <p className="text-3xl">⭐️</p>
            <p className="mt-2 font-extrabold">Connect Google Business Profile</p>
            <p className="text-sm text-cinnamon">Coming soon: see new reviews and reply right from here.</p>
            <button className="btn-blue mt-4" disabled>
              Connect
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-extrabold text-cocoa">{label}</p>
      <p className={`mt-1 text-3xl font-black ${accent ? "text-jam" : "text-cocoa"}`}>{value}</p>
      {hint && <p className="mt-1 text-sm font-bold text-cinnamon">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-extrabold text-cinnamon">{label}</dt>
      <dd className="text-xl font-black">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-cinnamon">{children}</p>;
}
