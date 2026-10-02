// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them.
interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  /** Shared with the ElevenLabs place_order webhook. Rejects the call when unset. */
  ELEVENLABS_TOOL_SECRET?: string;
  /** Outbound grocery calls fail closed when this secret is unset. */
  ELEVENLABS_API_KEY?: string;
  /** Grocery agent id. Wrangler var, not a secret. */
  SUPPLY_AGENT_ID?: string;
  /** Bakery caller id for outbound grocery calls. Wrangler var, not a secret. */
  SUPPLY_PHONE_NUMBER_ID?: string;
  /** External UGC video pipeline endpoint. The Marketing page shows "not connected" when unset. */
  UGC_PIPELINE_URL?: string;
  /** Bearer token sent to the pipeline, and the x-ugc-secret it must send back on callbacks. */
  UGC_PIPELINE_SECRET?: string;
}
