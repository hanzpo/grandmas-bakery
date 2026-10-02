// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them.
interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}
