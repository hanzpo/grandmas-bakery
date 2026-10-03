import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";

export const num = (v: number | string | null | undefined) => Number(v ?? 0);
export const qty = (v: number | string | null | undefined) =>
  num(v).toLocaleString("en-US", { maximumFractionDigits: 3 });

/** Dollars typed into an input → integer cents. */
export const toCents = (dollars: string) => Math.round(Number(dollars) * 100);

/** How much to buy to get back to twice the reorder level (at least one reorder level's worth). */
export const restockAmount = (i: { quantity_on_hand: number | string; reorder_threshold: number | string }) =>
  Math.ceil(Math.max(num(i.reorder_threshold) * 2 - num(i.quantity_on_hand), num(i.reorder_threshold)));

export function useIngredients() {
  return useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ingredients").select("*, suppliers(name)").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

// Every query that reads stock, deliveries or bills (including the Overview page and the nav badge).
const LEDGER_KEYS = [
  "ingredients",
  "inventory_transactions",
  "low_stock_ingredients",
  "expiring_lots",
  "supplier_orders",
  "bills_due",
  "expenses",
  "low-stock-count",
  "overview-low-stock",
  "overview-expiring",
  "overview-ledger",
];

/** Refetch everything that depends on the inventory ledger after a write. */
export function useInvalidateLedger() {
  const qc = useQueryClient();
  return () => {
    for (const key of LEDGER_KEYS) qc.invalidateQueries({ queryKey: [key] });
  };
}
