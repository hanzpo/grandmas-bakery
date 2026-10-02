import { Hono } from "hono";
import Stripe from "stripe";
import { adminDb, stripe } from "../lib";

export const stripeWebhook = new Hono<{ Bindings: Env }>().post("/", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) return c.text("Missing signature", 400);

  let event: Stripe.Event;
  try {
    event = await stripe(c.env).webhooks.constructEventAsync(
      await c.req.text(),
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    return c.text(`Invalid signature: ${(err as Error).message}`, 400);
  }

  const db = adminDb(c.env);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (!orderId || session.payment_status !== "paid") return c.json({ received: true });

    // Only transition from pending_payment so webhook retries are idempotent.
    // The DB trigger then deducts inventory and awards loyalty points.
    const { data: order } = await db
      .from("orders")
      .update({ status: "new" })
      .eq("id", orderId)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();

    if (order) {
      await db.from("payments").upsert(
        {
          order_id: orderId,
          method: "stripe",
          amount_cents: session.amount_total ?? 0,
          external_ref: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
        },
        { onConflict: "external_ref" },
      );
    }
  }

  if (event.type === "checkout.session.expired") {
    const orderId = event.data.object.metadata?.order_id;
    if (orderId) {
      await db.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending_payment");
    }
  }

  return c.json({ received: true });
});
