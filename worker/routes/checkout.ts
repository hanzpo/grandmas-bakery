import { Hono } from "hono";
import { z } from "zod";
import { adminDb, priceItems, stripe, upsertCustomer } from "../lib";

const CheckoutBody = z.object({
  customer: z.object({
    name: z.string().min(1).max(100),
    email: z.email(),
    phone: z.string().max(30).optional(),
    marketing_opt_in: z.boolean().optional(),
  }),
  items: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(100) })).min(1),
  pickup_at: z.iso.datetime({ offset: true }).optional(),
  notes: z.string().max(500).optional(),
});

export const checkout = new Hono<{ Bindings: Env }>()
  // Create a pending order + Stripe Checkout Session; the webhook moves it into the queue.
  .post("/", async (c) => {
    const parsed = CheckoutBody.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
    const body = parsed.data;
    const db = adminDb(c.env);

    const { lines, subtotal } = await priceItems(db, body.items);
    const customerId = await upsertCustomer(db, body.customer);

    const { data: order, error } = await db
      .from("orders")
      .insert({
        customer_id: customerId,
        source: "online",
        status: "pending_payment",
        pickup_at: body.pickup_at ?? null,
        subtotal_cents: subtotal,
        total_cents: subtotal,
        notes: body.notes ?? null,
      })
      .select("id, order_number")
      .single();
    if (error) throw error;

    const { error: itemsError } = await db.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price_cents: l.unit_price_cents,
      })),
    );
    if (itemsError) throw itemsError;

    // Redirect back to whichever host served the request (localhost, workers.dev, custom domain).
    const site = new URL(c.req.url).origin;
    const session = await stripe(c.env).checkout.sessions.create({
      mode: "payment",
      customer_email: body.customer.email,
      line_items: lines.map((l) => ({
        quantity: l.quantity,
        price_data: { currency: "usd", unit_amount: l.unit_price_cents, product_data: { name: l.name } },
      })),
      metadata: { order_id: order.id },
      success_url: `${site}/order/success?order=${order.order_number}`,
      cancel_url: `${site}/order?cancelled=1`,
    });

    await db.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    return c.json({ url: session.url });
  });
