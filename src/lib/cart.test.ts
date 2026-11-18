import { describe, expect, it } from "vitest";
import { MAX_ITEM_QUANTITY } from "../../shared/order";
import { cartLines, clampQuantity, localDateTimeInput, setQuantity } from "./cart";

const menu = [
  { id: "a", price_cents: 850 },
  { id: "b", price_cents: 425 },
];

describe("setQuantity", () => {
  it("adds, changes and removes an item", () => {
    let cart = setQuantity({}, "a", 1);
    expect(cart).toEqual({ a: 1 });
    cart = setQuantity(cart, "a", 3);
    expect(cart).toEqual({ a: 3 });
    expect(setQuantity(cart, "a", 0)).toEqual({});
  });

  it("caps an item at the per-item max", () => {
    expect(setQuantity({ a: MAX_ITEM_QUANTITY }, "a", MAX_ITEM_QUANTITY + 1)).toEqual({ a: MAX_ITEM_QUANTITY });
  });

  it("never stores a negative or fractional quantity", () => {
    expect(setQuantity({ a: 1 }, "a", -1)).toEqual({});
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(Number.NaN)).toBe(0);
  });
});

describe("cartLines", () => {
  it("totals the items on the menu", () => {
    const { lines, count, total } = cartLines(menu, { a: 2, b: 1 });
    expect(lines.map((l) => [l.product.id, l.quantity])).toEqual([["a", 2], ["b", 1]]);
    expect(count).toBe(3);
    expect(total).toBe(2125);
  });

  it("skips items no longer on the menu and caps oversized saved quantities", () => {
    const { lines, count, total } = cartLines(menu, { gone: 4, a: 500 });
    expect(lines).toHaveLength(1);
    expect(count).toBe(MAX_ITEM_QUANTITY);
    expect(total).toBe(850 * MAX_ITEM_QUANTITY);
  });

  it("is empty for an empty cart", () => {
    expect(cartLines(menu, {})).toEqual({ lines: [], count: 0, total: 0 });
  });
});

describe("localDateTimeInput", () => {
  it("formats a local time for a datetime-local input", () => {
    expect(localDateTimeInput(new Date(2026, 0, 5, 7, 3))).toBe("2026-01-05T07:03");
  });
});
