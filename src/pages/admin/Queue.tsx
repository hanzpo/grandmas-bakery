import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  ready: "Ready",
  completed: "Picked up",
  cancelled: "Cancelled",
};

/** A short two-note chime for new orders (no audio files needed). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {}
}

/** Re-render every 30s so "due in" / "late" badges stay current. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

type Drag = { id: string; from: Status; x: number; y: number; offsetX: number; offsetY: number; width: number; over: Status | "completed" | null };

export default function Queue() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, error } = useQuery({ queryKey: QUEUE_KEY, queryFn: fetchQueue });
  const now = useNow();

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

  // New-order alert: chime + highlight cards that weren't here on the last fetch.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (isLoading) return;
    const ids = new Set(orders.map((o) => o.id));
    if (seen.current) {
      const added = orders.filter((o) => !seen.current!.has(o.id) && o.status === "new").map((o) => o.id);
      if (added.length) {
        chime();
        setFresh((prev) => new Set([...prev, ...added]));
        setTimeout(() => setFresh((prev) => new Set([...prev].filter((id) => !added.includes(id)))), 8000);
      }
    }
    seen.current = ids;
  }, [orders, isLoading]);

  // Tab title shows how many orders are waiting, so it's visible from another tab.
  const waiting = orders.filter((o) => o.status === "new").length;
  useEffect(() => {
    const prev = document.title;
    document.title = waiting ? `(${waiting}) New orders · Grandma's Bakery` : "Queue · Grandma's Bakery";
    return () => {
      document.title = prev;
    };
  }, [waiting]);

  const [toast, setToast] = useState<{ id: string; number: number; from: Status; to: Status } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status; silent?: boolean }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    // Move the card instantly; the refetch reconciles.
    onMutate: async ({ id, status, silent }) => {
      await queryClient.cancelQueries({ queryKey: QUEUE_KEY });
      const previous = queryClient.getQueryData<QueueOrder[]>(QUEUE_KEY);
      const order = previous?.find((o) => o.id === id);
      queryClient.setQueryData<QueueOrder[]>(QUEUE_KEY, (list = []) =>
        COLUMNS.some((c) => c.status === status)
          ? list.map((o) => (o.id === id ? { ...o, status } : o))
          : list.filter((o) => o.id !== id),
      );
      if (order && !silent) setToast({ id, number: order.order_number, from: order.status, to: status });
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(QUEUE_KEY, ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  // Pointer-based drag and drop: works with mouse, touch and pen (tablets included).
  const [drag, setDrag] = useState<Drag | null>(null);
  const pending = useRef<{ id: string; from: Status; startX: number; startY: number; el: HTMLElement } | null>(null);

  useEffect(() => {
    const targetAt = (x: number, y: number) =>
      (document.elementFromPoint(x, y)?.closest("[data-drop]") as HTMLElement | null)?.dataset.drop as Drag["over"] | undefined;

    const onMove = (e: PointerEvent) => {
      const p = pending.current;
      if (p && !drag) {
        if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < 8) return;
        const rect = p.el.getBoundingClientRect();
        setDrag({
          id: p.id,
          from: p.from,
          x: e.clientX,
          y: e.clientY,
          offsetX: p.startX - rect.left,
          offsetY: p.startY - rect.top,
          width: rect.width,
          over: p.from,
        });
        return;
      }
      if (drag) {
        e.preventDefault();
        setDrag({ ...drag, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) ?? null });
      }
    };
    const onUp = () => {
      if (drag && drag.over && drag.over !== drag.from) setStatus.mutate({ id: drag.id, status: drag.over });
      pending.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, setStatus]);

  if (isLoading) return <p className="text-cinnamon">Loading orders…</p>;
  if (error) return <p className="text-jam">Couldn't load orders: {error.message}</p>;

  const dragged = drag ? orders.find((o) => o.id === drag.id) : null;

  return (
    <div className={`space-y-8 ${drag ? "cursor-grabbing select-none" : ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Today</p>
          <h1 className="text-4xl font-black">Order queue</h1>
        </div>
        <p className="text-sm font-bold text-cinnamon">Drag a card to move it, or tap its big button.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          const isTarget = drag && drag.over === col.status && drag.from !== col.status;
          return (
            <section
              key={col.status}
              data-drop={col.status}
              className={`rounded-3xl p-3 transition-colors ${isTarget ? "bg-blueberry-soft ring-4 ring-blueberry/40" : "bg-dough"}`}
            >
              <h2 className={`mb-4 flex items-center justify-between rounded-2xl px-4 py-3 text-xl font-black ${col.header}`}>
                {col.title}
                <span className={`min-w-9 rounded-full px-3 py-0.5 text-center text-base font-black ${col.count}`}>
                  {colOrders.length}
                </span>
              </h2>
              <div className="min-h-24 space-y-4">
                {colOrders.length === 0 && (
                  <p className="rounded-2xl border-2 border-dashed border-crumb py-10 text-center font-bold text-cinnamon">
                    {drag ? "Drop here" : "Nothing here"}
                  </p>
                )}
                {colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    now={now}
                    fresh={fresh.has(order.id)}
                    dragging={drag?.id === order.id}
                    action={col.action}
                    button={col.button}
                    onGrab={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      pending.current = { id: order.id, from: order.status, startX: e.clientX, startY: e.clientY, el: e.currentTarget };
                    }}
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

      {/* Drop here to hand the order over. */}
      {drag && (
        <div
          data-drop="completed"
          className={`fixed inset-x-4 bottom-4 z-40 flex h-20 items-center justify-center rounded-3xl border-4 border-dashed text-xl font-black transition-colors lg:left-[17rem] ${
            drag.over === "completed" ? "border-pistachio-depth bg-pistachio text-white" : "border-pistachio bg-pistachio-soft text-pistachio-depth"
          }`}
        >
          ✓ Picked up
        </div>
      )}

      {/* Card following the pointer. */}
      {drag && dragged && (
        <div
          className="pointer-events-none fixed z-50 rotate-2 opacity-95 shadow-2xl"
          style={{ left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, width: drag.width }}
        >
          <OrderCard order={dragged} now={now} fresh={false} dragging={false} ghost action="" button="" onGrab={() => {}} onAdvance={() => {}} onCancel={() => {}} />
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-cocoa px-5 py-3 text-white shadow-xl">
          <span className="font-extrabold">
            #{toast.number} moved to {STATUS_LABEL[toast.to]}
          </span>
          <button
            className="rounded-xl bg-white/15 px-3 py-1.5 text-sm font-black tracking-wide uppercase hover:bg-white/25"
            onClick={() => {
              setStatus.mutate({ id: toast.id, status: toast.from, silent: true });
              setToast(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function pickupBadge(pickupAt: string | null, now: number) {
  if (!pickupAt) return null;
  const mins = Math.round((new Date(pickupAt).getTime() - now) / 60000);
  const fmt = (m: number) => (m >= 90 ? `${Math.round(m / 60)}h` : `${m}m`);
  if (mins < 0) return { text: `Late ${fmt(-mins)}`, cls: "bg-jam text-white" };
  if (mins <= 15) return { text: `Due in ${fmt(mins)}`, cls: "bg-butter text-cocoa" };
  return { text: `Due in ${fmt(mins)}`, cls: "bg-dough text-cinnamon" };
}

function OrderCard({
  order,
  now,
  fresh,
  dragging,
  ghost,
  action,
  button,
  onGrab,
  onAdvance,
  onCancel,
}: {
  order: QueueOrder;
  now: number;
  fresh: boolean;
  dragging: boolean;
  ghost?: boolean;
  action: string;
  button: string;
  onGrab: (e: React.PointerEvent<HTMLElement>) => void;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const badge = pickupBadge(order.pickup_at, now);

  return (
    <article
      onPointerDown={onGrab}
      className={`card relative cursor-grab touch-none space-y-3 p-5 transition-opacity ${dragging ? "opacity-30" : ""} ${
        fresh ? "animate-pulse ring-4 ring-jam/50" : ""
      }`}
    >
      {fresh && <span className="tag absolute -top-3 right-4 bg-jam text-white">New!</span>}
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-black">#{order.order_number}</p>
          <p className="text-lg font-extrabold">{order.customers?.name ?? "Walk-in customer"}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`tag ${SOURCE_TAGS[order.source]}`}>{SOURCE_LABELS[order.source]}</span>
          {badge && <span className={`tag ${badge.cls}`}>{badge.text}</span>}
        </div>
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

      <p className="text-sm font-bold text-cinnamon">
        {order.pickup_at ? `Pickup ${dateTime(order.pickup_at)}` : "No pickup time"} · placed {timeAgo(order.created_at)}
      </p>

      {!ghost && (
        <div className="flex gap-2">
          <button className={`${button} flex-1 py-4 text-base`} onClick={onAdvance}>
            {action}
          </button>
          <button className="btn-ghost px-4 text-xs text-cinnamon" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}
