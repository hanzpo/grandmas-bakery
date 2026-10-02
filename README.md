# Grandma's Bakery

CRM for a one-woman parfait shop: online ordering (Stripe), a live order queue, order and
ingredient ledgers, recipe costing, customers/loyalty and a marketing dashboard.

**Stack:** React 19 + Vite + Tailwind v4 (SPA) · Hono API on a Cloudflare Worker (same deploy) · Supabase (Postgres, auth, realtime)

## Getting started

```sh
pnpm install
cp .env.example .env.local        # browser config (already points at the shared Supabase project)
cp .dev.vars.example .dev.vars    # worker secrets: ask the team for the service role / Stripe test keys
pnpm dev                          # http://localhost:5173
```

The public site works with no secrets. `/api/checkout` needs `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY`.

### Admin access

`/admin` is protected by one shared password (ask the team). It signs in as a single
staff account, `admin@grandmas-bakery.app`, so database permissions still apply.

## Layout

```
src/                 React app
  pages/             public: Home (menu), Order, OrderSuccess
  pages/admin/       Queue, Orders, Inventory, Menu (recipe costing), Customers, Marketing
  i18n/              en/es/zh strings (multilingual menu)
worker/              Cloudflare Worker (Hono), served at /api/*
  routes/checkout.ts        creates a pending order + Stripe Checkout Session
  routes/stripe-webhook.ts  marks orders paid and moves them into the queue
  routes/voice.ts           placeholder for the phone-ordering voice agent
shared/database.types.ts    generated Supabase types (`pnpm db:types`)
supabase/migrations/        schema: the source of truth
supabase/seed.sql           demo data
```

## Data model highlights

- **Inventory is a ledger.** Insert rows into `inventory_transactions` (purchase / usage / spoilage / adjustment).
  A trigger keeps `ingredients.quantity_on_hand` and the current cost up to date.
- **Orders deduct ingredients automatically.** When an order is accepted (inserted as anything but
  `pending_payment`, or paid via Stripe), its recipe ingredients are deducted and loyalty points are awarded.
- **RLS:** staff (rows in `staff`) can do everything. The public can only call `get_menu()`.
  Online orders are written by the Worker with the service role.
- Reporting views: `product_costs`, `customer_stats`, `daily_sales`, `product_sales`, `low_stock_ingredients`, `expiring_lots`.

## Database changes

```sh
supabase migration new my_change   # write SQL in supabase/migrations/
pnpm db:types                      # regenerate shared/database.types.ts
```

Merging to `main` runs CI: typecheck/build → validate migrations on a throwaway Postgres →
`supabase db push` to production → `wrangler deploy`.

## CI secrets (GitHub → Settings → Secrets and variables → Actions)

| Name | Kind | Status |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | secret | set |
| `SUPABASE_PUBLISHABLE_KEY` | variable | set |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | secret | **needed**; migrations are skipped until set |

Worker runtime secrets (set once): `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (and `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
Point a Stripe webhook at `https://<worker-url>/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.expired`.
