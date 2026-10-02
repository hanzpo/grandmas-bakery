import { useQuery } from "@tanstack/react-query";
import { Navigate, NavLink, Outlet } from "react-router";
import { useSession } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { BunBunLogo } from "./illustrations";

// Stroke icons from the design board (24px grid, rounded joins).
const ICONS: Record<string, string> = {
  overview: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  queue: "M4 6h16 M4 12h16 M4 18h10 M18 16l2 2 3-3",
  orders: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6",
  inventory: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
  menu: "M5 3v8a3 3 0 0 0 6 0V3 M8 3v18 M16 3c-2 2-2 7 0 9v9",
  customers: "M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M2 21a7 7 0 0 1 14 0 M16 3a4 4 0 0 1 0 8 M18 14a6 6 0 0 1 4 7",
  insights: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  marketing: "M3 6h13v12H3z M16 10l5-3v10l-5-3",
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const NAV: { to: string; label: string; icon: keyof typeof ICONS; end?: boolean; badge?: "lowStock" }[] = [
  { to: "/admin", label: "Overview", icon: "overview", end: true },
  { to: "/admin/queue", label: "Queue", icon: "queue" },
  { to: "/admin/orders", label: "Orders", icon: "orders" },
  { to: "/admin/inventory", label: "Inventory", icon: "inventory", badge: "lowStock" },
  { to: "/admin/menu", label: "Menu & Costs", icon: "menu" },
  { to: "/admin/customers", label: "Customers", icon: "customers" },
  { to: "/admin/insights", label: "Insights", icon: "insights" },
  { to: "/admin/marketing", label: "Marketing", icon: "marketing" },
];

export function AdminLayout() {
  const session = useSession();
  const staff = useQuery({
    queryKey: ["staff", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("*").eq("user_id", session!.user.id).maybeSingle();
      return data;
    },
  });
  const lowStock = useQuery({
    queryKey: ["low-stock-count"],
    enabled: !!staff.data,
    queryFn: async () => {
      const { count } = await supabase.from("low_stock_ingredients").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  if (session === undefined || (session && staff.isPending)) {
    return <div className="p-10 text-cinnamon">Loading…</div>;
  }
  if (!session) return <Navigate to="/admin/login" replace />;
  if (!staff.data) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-2xl">Not on the staff list yet</h1>
        <p className="mt-2 text-cinnamon">
          Signed in as {session.user.email}. Ask the owner to add you to the <code>staff</code> table.
        </p>
        <button className="btn-ghost mt-6" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  const name = staff.data.display_name;

  return (
    <div className="min-h-screen bg-flour md:flex">
      <aside className="border-b-2 border-crumb bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r-2 md:border-b-0">
        <div className="flex items-center gap-3 px-6 py-5">
          <BunBunLogo className="h-9 w-11" />
          <p className="text-lg leading-tight font-black">
            Grandma's
            <br />
            <span className="text-jam">Bakery</span>
          </p>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-4 pb-4 md:flex-1 md:flex-col md:gap-2">
          {NAV.map((n) => {
            const badge = n.badge === "lowStock" ? lowStock.data : undefined;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-base font-extrabold whitespace-nowrap transition ${
                    isActive
                      ? "border-jam/40 bg-jam-soft text-jam-depth"
                      : "border-transparent text-cocoa hover:bg-dough"
                  }`
                }
                style={({ isActive }) => (isActive ? { boxShadow: "0 3px 0 rgb(212 51 90 / 0.35)" } : undefined)}
              >
                <Icon name={n.icon} />
                <span className="flex-1">{n.label}</span>
                {!!badge && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-jam px-1.5 text-xs font-black text-white">
                    {badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="hidden p-4 md:block">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-crumb bg-dough p-3" style={{ boxShadow: "0 3px 0 var(--color-crumb)" }}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-butter text-lg font-black text-cocoa" style={{ boxShadow: "0 3px 0 var(--color-butter-depth)" }}>
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{name}</p>
              <p className="text-sm text-cinnamon">Owner</p>
            </div>
            <button
              className="rounded-lg px-2 py-1 text-xs font-extrabold text-cinnamon hover:bg-crumb"
              onClick={() => supabase.auth.signOut()}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
