import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { money } from "../../lib/format";
import { supabase } from "../../lib/supabase";

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const LOW_MARGIN_PCT = 60;

function useMenuData() {
  return useQuery({
    queryKey: ["menu-admin"],
    queryFn: async () => {
      const [products, costs, recipes, ingredients] = await Promise.all([
        supabase.from("products").select("*").order("sort_order"),
        supabase.from("product_costs").select("*"),
        supabase.from("recipe_items").select("*"),
        supabase.from("ingredients").select("id, name, unit, cost_per_unit_cents").order("name"),
      ]);
      for (const r of [products, costs, recipes, ingredients]) if (r.error) throw r.error;
      return {
        products: products.data!,
        costs: new Map(costs.data!.map((c) => [c.product_id!, c])),
        recipes: recipes.data!,
        ingredients: ingredients.data!,
      };
    },
  });
}

type MenuData = NonNullable<ReturnType<typeof useMenuData>["data"]>;

const marginPct = (priceCents: number, costCents: number) =>
  priceCents > 0 ? Math.round(1000 * (1 - costCents / priceCents)) / 10 : null;

function MarginBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted">—</span>;
  return <span className={`font-semibold ${pct < LOW_MARGIN_PCT ? "text-berry" : "text-sage"}`}>{pct}%</span>;
}

export default function Menu() {
  const { data, isLoading, error } = useMenuData();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold">Menu & recipes</h1>
        <p className="text-muted">
          What each item costs to make, and how much you keep. Margins under {LOW_MARGIN_PCT}% are shown in red.
        </p>
      </header>
      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-berry">{(error as Error).message}</p>}
      {data && (
        <>
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
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <ProductRow key={p.id} product={p} data={data} />
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

function ProductRow({ product, data }: { product: MenuData["products"][number]; data: MenuData }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState((product.price_cents / 100).toFixed(2));
  const cost = data.costs.get(product.id);

  const update = useMutation({
    mutationFn: async (patch: { price_cents?: number; is_active?: boolean; is_flavor_of_month?: boolean }) => {
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
      <tr>
        <td>
          <button className="text-lg text-muted" onClick={() => setOpen(!open)} aria-label="Show recipe">
            {open ? "▾" : "▸"}
          </button>
        </td>
        <td className="font-medium">{product.name}</td>
        <td>
          <div className="flex items-center gap-1">
            <span className="text-muted">$</span>
            <input
              className="input w-24 px-2 py-1.5"
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
            className="size-5"
            checked={product.is_active}
            onChange={(e) => update.mutate({ is_active: e.target.checked })}
          />
        </td>
        <td>
          <input
            type="checkbox"
            className="size-5"
            checked={product.is_flavor_of_month}
            onChange={(e) => update.mutate({ is_flavor_of_month: e.target.checked })}
          />
        </td>
      </tr>
      {open && (
        <tr>
          <td />
          <td colSpan={6} className="bg-cream">
            <RecipeEditor productId={product.id} data={data} />
          </td>
        </tr>
      )}
    </>
  );
}

function RecipeEditor({ productId, data }: { productId: string; data: MenuData }) {
  const qc = useQueryClient();
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const items = data.recipes.filter((r) => r.product_id === productId);
  const ingredientById = new Map(data.ingredients.map((i) => [i.id, i]));
  const unused = data.ingredients.filter((i) => !items.some((r) => r.ingredient_id === i.id));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["menu-admin"] });

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
      <h3 className="text-lg font-semibold">Recipe (per item)</h3>
      {items.length === 0 && <p className="text-muted">No ingredients yet.</p>}
      <ul className="space-y-2">
        {items.map((r) => {
          const ing = ingredientById.get(r.ingredient_id);
          return (
            <li key={r.ingredient_id} className="flex flex-wrap items-center gap-3">
              <span className="w-40 font-medium">{ing?.name}</span>
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
              <span className="text-muted">{ing?.unit}</span>
              <span className="text-sm text-muted">
                = {money(num(r.quantity) * num(ing?.cost_per_unit_cents))}
              </span>
              <button className="ml-auto text-sm text-berry" onClick={() => remove.mutate(r.ingredient_id)}>
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
        <button className="btn-ghost py-1.5">Add</button>
      </form>
      {(upsert.error || remove.error) && (
        <p className="text-berry">{((upsert.error || remove.error) as Error).message}</p>
      )}
    </div>
  );
}

/** "What if cream goes up?" Recompute every affected product's cost and margin client-side. */
function WhatIfSimulator({ data }: { data: MenuData }) {
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

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-xl font-semibold">What if a price changes?</h2>
        <p className="text-sm text-muted">
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
              onChange={(e) => setNewCost(e.target.value)}
            />
          </div>
        )}
      </div>

      {ingredient && affected.length === 0 && <p className="text-muted">No menu items use {ingredient.name}.</p>}
      {affected.length > 0 && (
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
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td>{money(p.price_cents)}</td>
                  <td>{money(before)}</td>
                  <td className={after > before ? "text-berry" : after < before ? "text-sage" : undefined}>
                    {money(after)}
                  </td>
                  <td>
                    <MarginBadge pct={marginBefore} />
                  </td>
                  <td>
                    <MarginBadge pct={marginPct(p.price_cents, after)} />
                  </td>
                  <td>{keepPrice != null && override ? money(Math.ceil(keepPrice / 25) * 25) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
