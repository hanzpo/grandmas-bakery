import { Hono } from "hono";
import { checkout } from "./routes/checkout";
import { newsletter } from "./routes/newsletter";
import { stripeWebhook } from "./routes/stripe-webhook";
import { supply } from "./routes/supply";
import { ugcVideos } from "./routes/ugc-videos";
import { voice } from "./routes/voice";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
app.route("/checkout", checkout);
app.route("/stripe/webhook", stripeWebhook);
app.route("/voice", voice);
app.route("/supply", supply);
app.route("/ugc-videos", ugcVideos);
app.route("/newsletter", newsletter);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

export default app satisfies ExportedHandler<Env>;
