import { useQuery } from "@tanstack/react-query";
import { Navigate, NavLink, Outlet } from "react-router";
import { useSession } from "../lib/auth";
import { supabase } from "../lib/supabase";

const NAV = [
  { to: "/admin", label: "Queue", end: true },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/inventory", label: "Inventory" },
  { to: "/admin/menu", label: "Menu & Costs" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/marketing", label: "Marketing" },
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

  if (session === undefined || (session && staff.isPending)) {
    return <div className="p-10 text-muted">Loading…</div>;
  }
  if (!session) return <Navigate to="/admin/login" replace />;
  if (!staff.data) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-2xl">Not on the staff list yet</h1>
        <p className="mt-2 text-muted">
          Signed in as {session.user.email}. Ask the owner to add you to the <code>staff</code> table.
        </p>
        <button className="btn-ghost mt-6" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-crust bg-white md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="p-5">
          <p className="font-display text-2xl font-extrabold text-terracotta">Grandma's</p>
          <p className="text-sm text-muted">Hi, {staff.data.display_name}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-xl px-4 py-3 text-base font-medium ${isActive ? "bg-terracotta text-white" : "hover:bg-crust"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden p-5 md:block">
          <button className="text-sm text-muted underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
