import { Hono } from "hono";

/**
 * Phone ordering voice agent — placeholder.
 *
 * Plan: a phone number (Twilio / Telnyx / Cloudflare Realtime) streams call audio to
 * a Durable Object running the agent (Cloudflare Agents SDK). The agent reads the
 * live menu, confirms items + pickup time with the caller, then calls the
 * `create_order` tool which inserts an order with source = 'voice_agent' and
 * status = 'new' (pay at pickup) or texts the caller a Stripe payment link.
 *
 * Reuse `priceItems` + `upsertCustomer` from ../lib for the insert.
 */
export const voice = new Hono<{ Bindings: Env }>().post("/incoming", (c) =>
  c.text(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thanks for calling Grandma's Bakery! Phone ordering is coming soon.</Say></Response>`,
    200,
    { "Content-Type": "text/xml" },
  ),
);
