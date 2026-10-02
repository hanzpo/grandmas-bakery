import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { dateTime, timeAgo } from "../../lib/format";
import { supabase, type Enums } from "../../lib/supabase";

type Status = Enums<"order_status">;

const COLUMNS: { status: Status; title: string; next: Status; action: string; accent: string }[] = [
  { status: "new", title: "New", next: "in_progress", action: "Start making", accent: "border-t-terracotta" },
  { status: "in_progress", title: "In progress", next: "ready", action: "Mark ready", accent: "border-t-berry" },
  { status: "ready", title: "Ready for pickup", next: "completed", action: "Picked up", accent: "border-t-sage" },
];

const SOURCE_LABELS: Record<Enums<"order_source">, string> = {
  online: "Online",
  walk_in: "Walk-in",
  phone: "Phone",
  voice_agent: "Voice agent",
  b2b: "B2B",
};

const QUEUE_KEY = ["orders", "queue"];

async function fetchQueue() {
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(name, phone), order_items(id, quantity, notes, products(name))")
    .in("status", COLUMNS.map((c) => c.status))
    .order("pickup_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

type QueueOrder = Awaited<ReturnType<typeof fetchQueue>>[number];

export default function Queue() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, error } = useQuery({ queryKey: QUEUE_KEY, queryFn: fetchQueue });

  // Live updates: any change to orders (new web order, another device advancing a card) refetches.
  useEffect(() => {
    const channel = supabase
      .channel("orders-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  if (isLoading) return <p className="text-muted">Loading orders…</p>;
  if (error) return <p className="text-berry">Couldn't load orders: {error.message}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Order queue</h1>
      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className={`rounded-2xl border-t-8 bg-crust/50 p-4 ${col.accent}`}>
              <h2 className="mb-4 flex items-center justify-between text-xl">
                {col.title}
                <span className="rounded-full bg-white px-3 py-1 text-base font-sans">{colOrders.length}</span>
              </h2>
              <div className="space-y-4">
                {colOrders.length === 0 && <p className="py-8 text-center text-muted">Nothing here</p>}
                {colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    action={col.action}
                    busy={setStatus.isPending && setStatus.variables?.id === order.id}
                    onAdvance={() => setStatus.mutate({ id: order.id, status: col.next })}
                    onCancel={() => {
                      if (confirm(`Cancel order #${order.order_number}?`)) {
                        setStatus.mutate({ id: order.id, status: "cancelled" });
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  action,
  busy,
  onAdvance,
  onCancel,
}: {
  order: QueueOrder;
  action: string;
  busy: boolean;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const isLate = order.pickup_at && new Date(order.pickup_at) < new Date();

  return (
    <article className="card space-y-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl">#{order.order_number}</p>
          <p className="text-lg font-semibold">{order.customers?.name ?? "Walk-in customer"}</p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-terracotta-dark">
          {SOURCE_LABELS[order.source]}
        </span>
      </header>

      <ul className="space-y-1 text-lg">
        {order.order_items.map((item) => (
          <li key={item.id}>
            <span className="font-bold">{item.quantity}×</span> {item.products?.name}
            {item.notes && <span className="block text-sm text-muted">{item.notes}</span>}
          </li>
        ))}
      </ul>

      {order.notes && <p className="rounded-lg bg-cream px-3 py-2 text-sm">📝 {order.notes}</p>}

      <p className={`text-sm ${isLate ? "font-semibold text-berry" : "text-muted"}`}>
        {order.pickup_at ? `Pickup ${dateTime(order.pickup_at)}` : "No pickup time"} · placed {timeAgo(order.created_at)}
      </p>

      <div className="flex gap-2">
        <button className="btn-primary flex-1 py-4 text-lg" disabled={busy} onClick={onAdvance}>
          {action}
        </button>
        <button className="btn-ghost px-3 text-sm text-muted" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </article>
  );
}
