import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { money } from "../../lib/format";
import { supabase } from "../../lib/supabase";

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const LOW_MARGIN_PCT = 60;

function useMenuData() {
  return useQuery({
    queryKey: ["menu-admin"],
    queryFn: async () => {
      const [products, costs, recipes, ingredients, votes] = await Promise.all([
        supabase.from("products").select("*").order("sort_order"),
        supabase.from("product_costs").select("*"),
        supabase.from("recipe_items").select("*"),
        supabase.from("ingredients").select("id, name, unit, cost_per_unit_cents").order("name"),
        // Vote counts for the items in the taste poll (counted in the database, so no row limit).
        supabase.rpc("get_flavor_poll"),
      ]);
      for (const r of [products, costs, recipes, ingredients, votes]) if (r.error) throw r.error;
      const voteCounts = new Map<string, number>();
      for (const v of votes.data!) voteCounts.set(v.id, num(v.votes));
      return {
        products: products.data!,
        costs: new Map(costs.data!.map((c) => [c.product_id!, c])),
        recipes: recipes.data!,
        ingredients: ingredients.data!,
        voteCounts,
      };
    },
  });
}

/** "Fall Parfait!" → "fall-parfait", then "fall-parfait-2", "-3"… if that's taken. */
function uniqueSlug(name: string, taken: Set<string>) {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

const categoryLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

type MenuData = NonNullable<ReturnType<typeof useMenuData>["data"]>;

const marginPct = (priceCents: number, costCents: number) =>
  priceCents > 0 ? Math.round(1000 * (1 - costCents / priceCents)) / 10 : null;

function MarginBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-cinnamon">—</span>;
  return (
    <span
      className={`tag ${pct < LOW_MARGIN_PCT ? "bg-jam-soft text-jam-depth" : "bg-pistachio-soft text-pistachio-depth"}`}
    >
      {pct}%
    </span>
  );
}

export default function Menu() {
  const { data, isLoading, error } = useMenuData();
  const [adding, setAdding] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onCreated = (id: string) => {
    setAdding(false);
    setOpenIds((prev) => new Set(prev).add(id));
    // Bring the new item's recipe into view so she can add ingredients right away.
    requestAnimationFrame(() =>
      document.getElementById(`product-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Menu & costs</p>
          <h1 className="text-4xl font-black">Menu & recipes</h1>
          <p className="mt-1 text-cinnamon">
            What each item costs to make, and how much you keep. Margins under {LOW_MARGIN_PCT}% are shown in red.
          </p>
          <p className="mt-1 text-cinnamon">
            Tick "Taste poll" to show an item on the website so customers can vote for it. It doesn't need to be on
            the menu yet.
          </p>
        </div>
        {data && !adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + New item
          </button>
        )}
      </header>
      {isLoading && <p className="text-cinnamon">Loading…</p>}
      {error && <p className="text-jam">{(error as Error).message}</p>}
      {data && (
        <>
          {adding && <NewItemForm data={data} onCancel={() => setAdding(false)} onCreated={onCreated} />}
          <section className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Item</th>
                  <th>Price</th>
                  <th>Ingredient cost</th>
                  <th>Margin</th>
                  <th>On menu</th>
                  <th>Flavor of the month</th>
                  <th>Taste poll</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    data={data}
                    open={openIds.has(p.id)}
                    onToggle={() => toggle(p.id)}
                  />
                ))}
              </tbody>
            </table>
          </section>
          <WhatIfSimulator data={data} />
        </>
      )}
    </div>
  );
}

/** Try out a new item before buying anything: it starts off the menu, then she adds a recipe to see its cost. */
function NewItemForm({
  data,
  onCancel,
  onCreated,
}: {
  data: MenuData;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const categories = [...new Set(data.products.map((p) => p.category))].sort();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories.includes("parfait") ? "parfait" : (categories[0] ?? "parfait"));
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const priceCents = Math.round(Number(price) * 100);
      if (!Number.isFinite(priceCents) || priceCents < 0) throw new Error("Please enter a price, like 8.50");
      const { data: row, error } = await supabase
        .from("products")
        .insert({
          name: name.trim(),
          slug: uniqueSlug(name, new Set(data.products.map((p) => p.slug))),
          category,
          price_cents: priceCents,
          description: description.trim() || null,
          is_active: false,
          sort_order: Math.max(0, ...data.products.map((p) => p.sort_order)) + 1,
        })
        .select("id")
        .single();
      if (error) throw error;
      return row.id;
    },
    onSuccess: async (id) => {
      // Wait for the new row to load before opening its recipe.
      await qc.invalidateQueries({ queryKey: ["menu-admin"] });
      onCreated(id);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <h2 className="text-xl font-extrabold">New item</h2>
        <p className="text-sm text-cinnamon">
          It starts off the menu. Next, add its ingredients to see what it costs to make before you buy anything.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label" htmlFor="new-item-name">
            Name
          </label>
          <input
            id="new-item-name"
            className="input"
            required
            autoFocus
            placeholder="Fall Parfait"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-item-category">
            Kind
          </label>
          <select
            id="new-item-category"
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {(categories.length ? categories : ["parfait"]).map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="new-item-price">
            Price ($)
          </label>
          <input
            id="new-item-price"
            className="input"
            type="number"
            step="0.25"
            min={0}
            required
            placeholder="8.50"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="new-item-description">
            Description
          </label>
          <input
            id="new-item-description"
            className="input"
            placeholder="Pumpkin yogurt, maple granola and cinnamon apples"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      {create.error && <p className="text-jam">{create.error.message}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Create & add recipe"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProductRow({
  product,
  data,
  open,
  onToggle,
}: {
  product: MenuData["products"][number];
  data: MenuData;
  open: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [price, setPrice] = useState((product.price_cents / 100).toFixed(2));
  const cost = data.costs.get(product.id);
  const votes = data.voteCounts.get(product.id) ?? 0;

  // Keep the box in step when the price changes elsewhere (e.g. "Use this price" below).
  useEffect(() => setPrice((product.price_cents / 100).toFixed(2)), [product.price_cents]);

  const update = useMutation({
    mutationFn: async (patch: {
      price_cents?: number;
      is_active?: boolean;
      is_flavor_of_month?: boolean;
      in_taste_poll?: boolean;
    }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-admin"] }),
  });

  const savePrice = () => {
    const cents = Math.round(Number(price) * 100);
    if (Number.isFinite(cents) && cents >= 0 && cents !== product.price_cents) update.mutate({ price_cents: cents });
  };

  return (
    <>
      <tr id={`product-${product.id}`}>
        <td>
          <button className="btn-icon h-9 w-9 text-sm" onClick={onToggle} aria-label="Show recipe">
            {open ? "▾" : "▸"}
          </button>
        </td>
        <td className="font-extrabold">
          {product.name}
          {product.is_flavor_of_month && <span className="tag ml-2 bg-butter text-cocoa">Grandma's pick</span>}
          {!product.is_active && <span className="tag ml-2 bg-dough text-cinnamon">Not on menu</span>}
        </td>
        <td>
          <div className="flex items-center gap-1">
            <span className="text-cinnamon">$</span>
            <input
              className="input w-24 px-3 py-1.5"
              type="number"
              step="0.25"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={savePrice}
              onKeyDown={(e) => e.key === "Enter" && savePrice()}
            />
          </div>
        </td>
        <td>{money(num(cost?.ingredient_cost_cents))}</td>
        <td>
          <MarginBadge pct={cost?.margin_pct != null ? num(cost.margin_pct) : null} />
        </td>
        <td>
          <input
            type="checkbox"
            className="size-5 accent-pistachio"
            checked={product.is_active}
            onChange={(e) => update.mutate({ is_active: e.target.checked })}
          />
        </td>
        <td>
          <input
            type="checkbox"
            className="size-5 accent-butter"
            checked={product.is_flavor_of_month}
            onChange={(e) => update.mutate({ is_flavor_of_month: e.target.checked })}
          />
        </td>
        <td>
          <label className="flex items-center gap-2 whitespace-nowrap">
            <input
              type="checkbox"
              className="size-5 accent-blueberry"
              checked={product.in_taste_poll}
              onChange={(e) => update.mutate({ in_taste_poll: e.target.checked })}
            />
            {(product.in_taste_poll || votes > 0) && (
              <span className="tag bg-blueberry-soft text-blueberry-depth">
                {votes} {votes === 1 ? "vote" : "votes"}
              </span>
            )}
          </label>
        </td>
      </tr>
      {update.error && (
        <tr>
          <td />
          <td colSpan={7} className="text-jam">
            {update.error.message}
          </td>
        </tr>
      )}
      {open && (
        <tr>
          <td />
          <td colSpan={7} className="bg-dough">
            <RecipeEditor productId={product.id} priceCents={product.price_cents} data={data} />
          </td>
        </tr>
      )}
    </>
  );
}

function RecipeEditor({ productId, priceCents, data }: { productId: string; priceCents: number; data: MenuData }) {
  const qc = useQueryClient();
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const items = data.recipes.filter((r) => r.product_id === productId);
  const ingredientById = new Map(data.ingredients.map((i) => [i.id, i]));
  const unused = data.ingredients.filter((i) => !items.some((r) => r.ingredient_id === i.id));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["menu-admin"] });
  const totalCost = items.reduce(
    (sum, r) => sum + num(r.quantity) * num(ingredientById.get(r.ingredient_id)?.cost_per_unit_cents),
    0,
  );

  const upsert = useMutation({
    mutationFn: async (row: { ingredient_id: string; quantity: number }) => {
      const { error } = await supabase.from("recipe_items").upsert({ product_id: productId, ...row });
      if (error) throw error;
    },
    onSuccess: () => {
      setIngredientId("");
      setQuantity("");
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async (ingredient_id: string) => {
      const { error } = await supabase
        .from("recipe_items")
        .delete()
        .eq("product_id", productId)
        .eq("ingredient_id", ingredient_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-3 py-2">
      <h3 className="text-lg font-extrabold">Recipe (per item)</h3>
      {items.length === 0 ? (
        <p className="text-cinnamon">No ingredients yet. Add them below to see what one costs to make.</p>
      ) : (
        <p className="flex flex-wrap items-center gap-2">
          Costs <span className="font-black">{money(totalCost)}</span> to make. At {money(priceCents)} you keep
          <MarginBadge pct={marginPct(priceCents, totalCost)} />
        </p>
      )}
      <ul className="space-y-2">
        {items.map((r) => {
          const ing = ingredientById.get(r.ingredient_id);
          return (
            <li key={r.ingredient_id} className="flex flex-wrap items-center gap-3">
              <span className="w-40 font-extrabold">{ing?.name}</span>
              <input
                className="input w-28 px-2 py-1.5"
                type="number"
                step="any"
                min={0}
                defaultValue={num(r.quantity)}
                onBlur={(e) => {
                  const q = Number(e.target.value);
                  if (q > 0 && q !== num(r.quantity)) upsert.mutate({ ingredient_id: r.ingredient_id, quantity: q });
                }}
              />
              <span className="text-cinnamon">{ing?.unit}</span>
              <span className="text-sm text-cinnamon">
                = {money(num(r.quantity) * num(ing?.cost_per_unit_cents))}
              </span>
              <button className="btn-ghost ml-auto px-3 py-1.5 text-xs text-jam" onClick={() => remove.mutate(r.ingredient_id)}>
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          upsert.mutate({ ingredient_id: ingredientId, quantity: Number(quantity) });
        }}
      >
        <select className="input w-48 py-1.5" required value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
          <option value="">Add ingredient…</option>
          {unused.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>
        <input
          className="input w-28 py-1.5"
          type="number"
          step="any"
          min={0}
          required
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <button className="btn-blue px-4 py-2 text-sm">Add</button>
      </form>
      {(upsert.error || remove.error) && (
        <p className="text-jam">{((upsert.error || remove.error) as Error).message}</p>
      )}
    </div>
  );
}

/** "What if cream goes up?" Recompute every affected product's cost and margin client-side. */
function WhatIfSimulator({ data }: { data: MenuData }) {
  const qc = useQueryClient();
  const [ingredientId, setIngredientId] = useState("");
  const [newCost, setNewCost] = useState("");
  const ingredient = data.ingredients.find((i) => i.id === ingredientId);
  const ingredientById = new Map(data.ingredients.map((i) => [i.id, i]));

  const costOf = (productId: string, override?: { id: string; cost: number }) =>
    data.recipes
      .filter((r) => r.product_id === productId)
      .reduce((sum, r) => {
        const unitCost =
          override && r.ingredient_id === override.id
            ? override.cost
            : num(ingredientById.get(r.ingredient_id)?.cost_per_unit_cents);
        return sum + num(r.quantity) * unitCost;
      }, 0);

  const affected = ingredient
    ? data.products.filter((p) => data.recipes.some((r) => r.product_id === p.id && r.ingredient_id === ingredient.id))
    : [];
  const override = ingredient && newCost !== "" ? { id: ingredient.id, cost: Number(newCost) } : undefined;

  // Prices she has already accepted in this "what if". Once the price changes, "margin now" is figured
  // from the new price, so without this the suggestion would keep creeping up.
  const [applied, setApplied] = useState<Map<string, number>>(new Map());

  const setPrice = useMutation({
    mutationFn: async ({ id, price_cents }: { id: string; price_cents: number }) => {
      const { error } = await supabase.from("products").update({ price_cents }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id, price_cents }) => {
      setApplied((prev) => new Map(prev).set(id, price_cents));
      qc.invalidateQueries({ queryKey: ["menu-admin"] });
    },
  });

  const applyPrice = (p: MenuData["products"][number], cents: number) => {
    if (confirm(`Change the price of ${p.name} from ${money(p.price_cents)} to ${money(cents)}?`)) {
      setPrice.mutate({ id: p.id, price_cents: cents });
    }
  };

  return (
    <section className="card space-y-4">
      <div>
        <p className="eyebrow">Trade war simulator</p>
        <h2 className="text-2xl font-extrabold">What if a price changes?</h2>
        <p className="text-sm text-cinnamon">
          Try a new supplier price and see how it changes each item's cost and margin. Nothing is saved.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Ingredient</label>
          <select
            className="input w-56"
            value={ingredientId}
            onChange={(e) => {
              setIngredientId(e.target.value);
              setNewCost("");
              setApplied(new Map());
            }}
          >
            <option value="">Choose…</option>
            {data.ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        {ingredient && (
          <div>
            <label className="label">
              New cost per {ingredient.unit} in cents (now {num(ingredient.cost_per_unit_cents)}¢)
            </label>
            <input
              className="input w-40"
              type="number"
              step="any"
              min={0}
              value={newCost}
              onChange={(e) => {
                setNewCost(e.target.value);
                setApplied(new Map());
              }}
            />
          </div>
        )}
      </div>

      {ingredient && affected.length === 0 && <p className="text-cinnamon">No menu items use {ingredient.name}.</p>}
      {setPrice.error && <p className="text-jam">{setPrice.error.message}</p>}
      {affected.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Cost now</th>
                <th>Cost then</th>
                <th>Margin now</th>
                <th>Margin then</th>
                <th>Price to keep margin</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {affected.map((p) => {
                const before = costOf(p.id);
                const after = override ? costOf(p.id, override) : before;
                const marginBefore = marginPct(p.price_cents, before);
                // Price that would keep today's margin with the new cost.
                const keepPrice =
                  marginBefore != null && marginBefore < 100 ? after / (1 - marginBefore / 100) : null;
                const priceSet = applied.get(p.id) === p.price_cents;
                const suggested =
                  keepPrice != null && override && !priceSet ? Math.ceil(keepPrice / 25) * 25 : null;
                return (
                  <tr key={p.id}>
                    <td className="font-extrabold">{p.name}</td>
                    <td>{money(p.price_cents)}</td>
                    <td>{money(before)}</td>
                    <td className={after > before ? "text-jam" : after < before ? "text-pistachio-depth" : undefined}>
                      {money(after)}
                    </td>
                    <td>
                      <MarginBadge pct={marginBefore} />
                    </td>
                    <td>
                      <MarginBadge pct={marginPct(p.price_cents, after)} />
                    </td>
                    <td>
                      {suggested != null ? (
                        <span className="tag bg-butter-soft text-cocoa">{money(suggested)}</span>
                      ) : priceSet ? (
                        <span className="tag bg-pistachio-soft text-pistachio-depth">Now {money(p.price_cents)} ✓</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {suggested != null &&
                        (suggested === p.price_cents ? (
                          <span className="tag bg-pistachio-soft text-pistachio-depth">Already this price</span>
                        ) : (
                          <button
                            className="btn-ghost px-3 py-1.5 text-xs whitespace-nowrap"
                            disabled={setPrice.isPending}
                            onClick={() => applyPrice(p, suggested)}
                          >
                            Use this price
                          </button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
