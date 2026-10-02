import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { dateTime, timeAgo } from "../../lib/format";
import { supabase, type Enums } from "../../lib/supabase";

type Status = Enums<"order_status">;

const COLUMNS: {
  status: Status;
  title: string;
  next: Status;
  action: string;
  header: string;
  count: string;
  button: string;
}[] = [
  {
    status: "new",
    title: "New",
    next: "in_progress",
    action: "Start making",
    header: "bg-blueberry-soft text-blueberry-depth",
    count: "bg-blueberry text-white",
    button: "btn-blue",
  },
  {
    status: "in_progress",
    title: "In progress",
    next: "ready",
    action: "Mark ready",
    header: "bg-butter-soft text-cocoa",
    count: "bg-butter text-cocoa",
    button: "btn-butter",
  },
  {
    status: "ready",
    title: "Ready for pickup",
    next: "completed",
    action: "Picked up",
    header: "bg-pistachio-soft text-pistachio-depth",
    count: "bg-pistachio text-white",
    button: "btn-primary",
  },
];

const SOURCE_TAGS: Record<Enums<"order_source">, string> = {
  online: "bg-blueberry-soft text-blueberry-depth",
  walk_in: "bg-dough text-cinnamon",
  phone: "bg-butter-soft text-cocoa",
  voice_agent: "bg-jam-soft text-jam-depth",
  b2b: "bg-pistachio-soft text-pistachio-depth",
};

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

  if (isLoading) return <p className="text-cinnamon">Loading orders…</p>;
  if (error) return <p className="text-jam">Couldn't load orders: {error.message}</p>;

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Today</p>
        <h1 className="text-4xl font-black">Order queue</h1>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className="rounded-3xl bg-dough p-3">
              <h2 className={`mb-4 flex items-center justify-between rounded-2xl px-4 py-3 text-xl font-black ${col.header}`}>
                {col.title}
                <span className={`min-w-9 rounded-full px-3 py-0.5 text-center text-base font-black ${col.count}`}>
                  {colOrders.length}
                </span>
              </h2>
              <div className="space-y-4">
                {colOrders.length === 0 && (
                  <p className="rounded-2xl border-2 border-dashed border-crumb py-10 text-center font-bold text-cinnamon">
                    Nothing here
                  </p>
                )}
                {colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    action={col.action}
                    button={col.button}
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
  button,
  busy,
  onAdvance,
  onCancel,
}: {
  order: QueueOrder;
  action: string;
  button: string;
  busy: boolean;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const isLate = order.pickup_at && new Date(order.pickup_at) < new Date();

  return (
    <article className="card space-y-3 p-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-black">#{order.order_number}</p>
          <p className="text-lg font-extrabold">{order.customers?.name ?? "Walk-in customer"}</p>
        </div>
        <span className={`tag ${SOURCE_TAGS[order.source]}`}>{SOURCE_LABELS[order.source]}</span>
      </header>

      <ul className="space-y-1 text-lg">
        {order.order_items.map((item) => (
          <li key={item.id}>
            <span className="font-black text-jam">{item.quantity}×</span>{" "}
            <span className="font-bold">{item.products?.name}</span>
            {item.notes && <span className="block text-sm text-cinnamon">{item.notes}</span>}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="rounded-2xl bg-butter-soft px-4 py-2 text-sm font-bold text-cocoa">📝 {order.notes}</p>
      )}

      <p className={`text-sm font-bold ${isLate ? "text-jam" : "text-cinnamon"}`}>
        {order.pickup_at ? `Pickup ${dateTime(order.pickup_at)}` : "No pickup time"} · placed {timeAgo(order.created_at)}
      </p>

      <div className="flex gap-2">
        <button className={`${button} flex-1 py-4 text-base`} disabled={busy} onClick={onAdvance}>
          {action}
        </button>
        <button className="btn-ghost px-4 text-xs text-cinnamon" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </article>
  );
}
