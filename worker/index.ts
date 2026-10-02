import { Hono } from "hono";
import { checkout } from "./routes/checkout";
import { stripeWebhook } from "./routes/stripe-webhook";
import { voice } from "./routes/voice";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
app.route("/checkout", checkout);
app.route("/stripe/webhook", stripeWebhook);
app.route("/voice", voice);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

export default app satisfies ExportedHandler<Env>;
