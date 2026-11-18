import { describe, expect, it } from "vitest";
import { CheckoutBody } from "./checkout";

const item = { product_id: "00000000-0000-0000-0000-00000000c002", quantity: 1 };
const body = (over: Record<string, unknown> = {}, customer: Record<string, unknown> = {}) => ({
  customer: { name: "Ann", email: "ann@example.com", ...customer },
  items: [item],
  ...over,
});

describe("CheckoutBody", () => {
  it("accepts a normal order", () => {
    expect(CheckoutBody.safeParse(body()).success).toBe(true);
  });

  it("rejects a blank (whitespace-only) name and trims names and phones", () => {
    expect(CheckoutBody.safeParse(body({}, { name: "   " })).success).toBe(false);
    const parsed = CheckoutBody.parse(body({}, { name: "  Ann  ", phone: " 555-0100 " }));
    expect(parsed.customer).toMatchObject({ name: "Ann", phone: "555-0100" });
  });

  it("rejects a pickup time in the past and accepts one in the future", () => {
    const past = CheckoutBody.safeParse(body({ pickup_at: "2020-01-01T10:00:00.000Z" }));
    expect(past.success).toBe(false);
    expect(past.error?.issues[0]?.message).toBe("Pickup time must be in the future");
    const soon = new Date(Date.now() + 60 * 60_000).toISOString();
    expect(CheckoutBody.safeParse(body({ pickup_at: soon })).success).toBe(true);
  });

  it("caps quantities at 100 and needs at least one item", () => {
    expect(CheckoutBody.safeParse(body({ items: [{ ...item, quantity: 100 }] })).success).toBe(true);
    expect(CheckoutBody.safeParse(body({ items: [{ ...item, quantity: 101 }] })).success).toBe(false);
    expect(CheckoutBody.safeParse(body({ items: [] })).success).toBe(false);
  });
});
