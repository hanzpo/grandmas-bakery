import { MAX_ITEM_QUANTITY } from "../../shared/order";
import { isoDay } from "./format";

export type Cart = Record<string, number>;

export const clampQuantity = (q: number) => Math.max(0, Math.min(MAX_ITEM_QUANTITY, Math.floor(q) || 0));

/** Set one item's quantity (capped at the per-item max); zero removes it. */
export function setQuantity(cart: Cart, id: string, q: number): Cart {
  const { [id]: _, ...rest } = cart;
  const n = clampQuantity(q);
  return n > 0 ? { ...rest, [id]: n } : rest;
}

/** Cart lines for the items still on the menu, with item count and subtotal. */
export function cartLines<P extends { id: string; price_cents: number }>(items: P[], cart: Cart) {
  const lines = items
    .map((product) => ({ product, quantity: clampQuantity(cart[product.id] ?? 0) }))
    .filter((l) => l.quantity > 0);
  return {
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    total: lines.reduce((s, l) => s + l.product.price_cents * l.quantity, 0),
  };
}

/** A local time as a `datetime-local` input value, e.g. "2026-11-18T17:05". */
export const localDateTimeInput = (d = new Date()) =>
  `${isoDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
