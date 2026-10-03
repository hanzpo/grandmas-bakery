import { useState, type ReactNode } from "react";
import { money, shortDate } from "../../../lib/format";
import { isRunning, usePriceCheck, useStartPriceCheck, type PriceCheck } from "./priceCheckApi";
import { num, qty, restockAmount, useIngredients } from "./shared";

/** A supplier order to open pre-filled in the New order form. Prices are line totals in dollars. */
export type OrderDraft = {
  supplierId: string;
  lines: { ingredient_id: string; quantity: string; price: string }[];
  notes: string;
};

type Props = {
  checkId: string | null;
  setCheckId: (id: string | null) => void;
  onOrder: (draft: OrderDraft) => void;
  onClose: () => void;
};

/** Restock list → online price check → order the list from the store that suits. */
export default function PriceCheckPanel({ checkId, setCheckId, onOrder, onClose }: Props) {
  return checkId ? (
    <Results checkId={checkId} setCheckId={setCheckId} onOrder={onOrder} onClose={onClose} />
  ) : (
    <RestockList onStarted={setCheckId} onClose={onClose} />
  );
}

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <p className="eyebrow">Shop around</p>
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children && <p className="mt-1 text-cinnamon">{children}</p>}
    </div>
  );
}

type Row = { ingredient_id: string; quantity: string };

function RestockList({ onStarted, onClose }: { onStarted: (id: string) => void; onClose: () => void }) {
  const { data: ingredients, isLoading } = useIngredients();
  const start = useStartPriceCheck();
  const [rows, setRows] = useState<Row[] | null>(null);

  // Until Grandma edits it, the list is everything that's running low.
  const list =
    rows ??
    (ingredients ?? [])
      .filter((i) => num(i.quantity_on_hand) <= num(i.reorder_threshold))
      .map((i) => ({ ingredient_id: i.id, quantity: String(restockAmount(i)) }));
  const ingredient = (id: string) => ingredients?.find((i) => i.id === id);
  const valid = list.filter((r) => num(r.quantity) > 0);

  const setRow = (idx: number, patch: Partial<Row>) => setRows(list.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const add = (id: string) => {
    const ing = ingredient(id);
    if (ing) setRows([...list, { ingredient_id: id, quantity: String(restockAmount(ing) || 1) }]);
  };

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start.mutate(
          valid.map((r) => ({ ingredient_id: r.ingredient_id, quantity: num(r.quantity) })),
          { onSuccess: (check) => onStarted(check.id) },
        );
      }}
    >
      <Heading title="Check prices online">
        We'll look up each store's website and show you who has the whole list for the least. It takes a minute or two.
      </Heading>

      {isLoading && <p className="text-cinnamon">Loading…</p>}
      {!isLoading && list.length === 0 && (
        <p className="rounded-2xl bg-pistachio-soft px-4 py-3 font-extrabold text-pistachio-depth">
          Nothing is running low. Add anything you'd like priced below.
        </p>
      )}

      <div className="space-y-3">
        {list.map((r, idx) => {
          const ing = ingredient(r.ingredient_id);
          return (
            <div key={r.ingredient_id} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2 rounded-2xl bg-dough p-3">
              <div>
                <p className="font-extrabold">{ing?.name}</p>
                <p className="text-sm text-cinnamon">
                  Have {qty(ing?.quantity_on_hand)} {ing?.unit} · reorder at {qty(ing?.reorder_threshold)}
                </p>
              </div>
              <input
                aria-label={`How much ${ing?.name} (${ing?.unit})`}
                className="input bg-white"
                type="number"
                step="any"
                min={0}
                placeholder={ing?.unit}
                value={r.quantity}
                onChange={(e) => setRow(idx, { quantity: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Take ${ing?.name} off the list`}
                className="btn-icon"
                onClick={() => setRows(list.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          );
        })}
        <select
          aria-label="Add an ingredient"
          className="input"
          value=""
          onChange={(e) => add(e.target.value)}
        >
          <option value="">Add an ingredient…</option>
          {ingredients
            ?.filter((i) => !list.some((r) => r.ingredient_id === i.id))
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </select>
      </div>

      {start.error && <p className="text-jam">{start.error.message}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={valid.length === 0 || start.isPending}>
          {start.isPending ? "Starting…" : `Check prices for ${valid.length} item${valid.length === 1 ? "" : "s"}`}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const STORE_STATUS: Record<PriceCheck["stores"][number]["status"], { label: string; tone: string }> = {
  waiting: { label: "Waiting", tone: "bg-crumb text-cocoa" },
  checking: { label: "Looking…", tone: "bg-blueberry-soft text-blueberry-depth" },
  done: { label: "Done", tone: "bg-pistachio-soft text-pistachio-depth" },
  failed: { label: "Couldn't check", tone: "bg-jam-soft text-jam-depth" },
};

function Results({ checkId, setCheckId, onOrder, onClose }: Props & { checkId: string }) {
  const { data: check, error, isLoading } = usePriceCheck(checkId);
  const { data: ingredients } = useIngredients();
  const restart = useStartPriceCheck();

  if (isLoading) return <p className="card text-cinnamon">Loading the price check…</p>;
  if (error || !check) {
    return (
      <section className="card space-y-3">
        <Heading title="Couldn't load the price check" />
        <p className="text-jam">{error?.message}</p>
        <button className="btn-ghost" onClick={() => setCheckId(null)}>
          Start over
        </button>
      </section>
    );
  }

  const ingredient = (id: string) => ingredients?.find((i) => i.id === id);
  const running = isRunning(check);
  const finishedStores = check.stores.filter((s) => s.status === "done" || s.status === "failed").length;

  // Lowest in-stock price per ingredient, across stores.
  const lowest = new Map<string, number>();
  for (const q of check.quotes) {
    if (q.unit_price_cents == null || !q.in_stock) continue;
    lowest.set(q.ingredient_id, Math.min(lowest.get(q.ingredient_id) ?? Infinity, q.unit_price_cents));
  }

  const stores = check.stores.map((store) => {
    const lines = check.items.map((item) => {
      const quote = check.quotes.find((q) => q.supplier_id === store.supplier_id && q.ingredient_id === item.ingredient_id);
      const unit = quote?.in_stock ? quote.unit_price_cents : null;
      return { item, quote, unit, total: unit != null ? item.quantity * unit : null };
    });
    const found = lines.filter((l) => l.total != null);
    return {
      store,
      lines,
      found: found.length,
      total: found.reduce((s, l) => s + l.total!, 0),
      usual: found.reduce((s, l) => s + l.item.quantity * num(ingredient(l.item.ingredient_id)?.cost_per_unit_cents), 0),
    };
  });
  // Stores with the most of the list first, then the cheapest.
  const priced = stores
    .filter((s) => s.store.status === "done" && s.found > 0)
    .sort((a, b) => b.found - a.found || a.total - b.total);
  const others = stores.filter((s) => !priced.includes(s));

  const order = (s: (typeof stores)[number]) =>
    onOrder({
      supplierId: s.store.supplier_id,
      lines: s.lines
        .filter((l) => l.total != null)
        .map((l) => ({
          ingredient_id: l.item.ingredient_id,
          quantity: String(l.item.quantity),
          price: (l.total! / 100).toFixed(2),
        })),
      notes: `Prices checked online ${shortDate(check.created_at)}`,
    });

  return (
    <section className="card space-y-4">
      {check.status === "failed" ? (
        <Heading title="Couldn't check prices" />
      ) : running ? (
        <Heading title="Checking prices…">
          {finishedStores} of {check.stores.length} stores checked. This can take a minute or two.
        </Heading>
      ) : (
        <Heading title="Here's what stores charge">
          Checked {check.stores.length} store{check.stores.length === 1 ? "" : "s"} for {check.items.length} item
          {check.items.length === 1 ? "" : "s"}. Tap a price to see it on their website.
        </Heading>
      )}
      {check.status === "failed" && <p className="text-jam">{check.error || "Something went wrong looking up prices."}</p>}

      {priced.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {priced.map((s, rank) => {
            const best = rank === 0;
            const missing = check.items.length - s.found;
            const diff = s.total - s.usual;
            return (
              <article key={s.store.supplier_id} className={`space-y-3 rounded-3xl border-2 p-4 ${best ? "border-pistachio bg-pistachio-soft/40" : "border-crumb"}`}>
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-lg font-black">{s.store.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {best && (
                      <span className="tag bg-pistachio-soft text-pistachio-depth">{running ? "Best so far" : "Best deal"}</span>
                    )}
                    {missing > 0 ? (
                      <span className="tag bg-butter-soft text-cocoa">Has {s.found} of {check.items.length}</span>
                    ) : (
                      <span className="tag bg-blueberry-soft text-blueberry-depth">Has everything</span>
                    )}
                  </div>
                </header>

                <ul className="space-y-2">
                  {s.lines.map(({ item, quote, unit, total }) => {
                    const ing = ingredient(item.ingredient_id);
                    return (
                      <li key={item.ingredient_id} className="flex justify-between gap-3">
                        <span>
                          <span className="font-extrabold">
                            {qty(item.quantity)} {ing?.unit}
                          </span>{" "}
                          {ing?.name}
                          {unit != null && unit === lowest.get(item.ingredient_id) && (
                            <span className="tag ml-2 bg-butter text-cocoa">Lowest</span>
                          )}
                          {(quote?.product_name || quote?.pack_label) && (
                            <span className="block text-sm text-cinnamon">
                              {[quote.product_name, quote.pack_label].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                        {total == null ? (
                          <span className="shrink-0 text-jam">
                            {quote?.unit_price_cents != null && !quote.in_stock ? "Sold out" : "Not found"}
                          </span>
                        ) : quote?.url ? (
                          <a href={quote.url} target="_blank" rel="noreferrer" className="shrink-0 font-extrabold text-blueberry">
                            {money(total)}
                          </a>
                        ) : (
                          <span className="shrink-0">{money(total)}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t-2 border-crumb pt-2">
                  <div className="flex justify-between text-lg font-black">
                    <span>Total{missing > 0 ? ` for ${s.found} items` : ""}</span>
                    <span>{money(s.total)}</span>
                  </div>
                  {s.usual > 0 && Math.abs(diff) >= 1 && (
                    <p className={`text-sm ${diff < 0 ? "text-pistachio-depth" : "text-jam"}`}>
                      {money(Math.abs(diff))} {diff < 0 ? "less" : "more"} than you paid last time
                    </p>
                  )}
                </div>
                <button className={`${best ? "btn-primary" : "btn-ghost"} w-full`} onClick={() => order(s)}>
                  Order from {s.store.name}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <ul className="space-y-2">
          {others.map(({ store }) => {
            const status = STORE_STATUS[store.status];
            return (
              <li key={store.supplier_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-dough px-4 py-3">
                <span className="font-extrabold">{store.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {store.status === "done" ? (
                    <span className="tag bg-crumb text-cocoa">Had none of it</span>
                  ) : (
                    <span className={`tag ${status.tone}`}>{status.label}</span>
                  )}
                  {store.error && <span className="text-sm text-jam">{store.error}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!running && check.stores.length === 0 && (
        <p className="text-cinnamon">There were no stores to check. Add one on the Suppliers tab.</p>
      )}

      {restart.error && <p className="text-jam">{restart.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        {!running && (
          <button
            className="btn-blue"
            disabled={restart.isPending}
            onClick={() => restart.mutate(check.items, { onSuccess: (c) => setCheckId(c.id) })}
          >
            {restart.isPending ? "Starting…" : "Check again"}
          </button>
        )}
        <button className="btn-ghost" onClick={() => setCheckId(null)}>
          Change the list
        </button>
        <button className="btn-ghost text-cinnamon" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
