-- Grandma's Bakery: core schema
-- Covers: menu + recipes (costing), suppliers + price history, inventory ledger,
-- customers (loyalty), orders + queue, payments (reconciliation), expenses.

create extension if not exists citext;

-- ─────────────────────────────────────────────────────────────
-- Staff / auth
-- ─────────────────────────────────────────────────────────────
-- Anyone in this table can use the admin app. Add grandma after she signs in once:
--   insert into staff (user_id, display_name) select id, 'Grandma' from auth.users where email = '...';
create table staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'owner' check (role in ('owner', 'helper')),
  created_at timestamptz not null default now()
);

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────
-- Suppliers & ingredients
-- ─────────────────────────────────────────────────────────────
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email citext,
  website text,
  is_local boolean not null default false,
  delivery_days text[] not null default '{}', -- e.g. {mon,wed,fri}
  lead_time_days int,
  notes text,
  created_at timestamptz not null default now()
);

create type ingredient_unit as enum ('g', 'kg', 'ml', 'l', 'each', 'dozen', 'lb', 'oz');

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit ingredient_unit not null,
  -- Maintained by trigger from inventory_transactions; do not write directly.
  quantity_on_hand numeric(12, 3) not null default 0,
  reorder_threshold numeric(12, 3) not null default 0,
  -- Current cost per unit, used for recipe costing. Updated when a purchase is logged.
  cost_per_unit_cents numeric(12, 4) not null default 0,
  preferred_supplier_id uuid references suppliers (id) on delete set null,
  allergens text[] not null default '{}', -- e.g. {dairy,gluten,nuts,egg,soy}
  created_at timestamptz not null default now()
);

-- Quotes / price history per supplier, for "trade war" comparisons.
create table supplier_prices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  price_cents numeric(12, 4) not null, -- per ingredient unit
  effective_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index on supplier_prices (ingredient_id, effective_on desc);

-- ─────────────────────────────────────────────────────────────
-- Inventory ledger (append-only movements)
-- ─────────────────────────────────────────────────────────────
create type inventory_txn_type as enum ('purchase', 'usage', 'spoilage', 'adjustment');

create table inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  type inventory_txn_type not null,
  -- Signed: positive adds stock, negative removes. Purchases > 0; usage/spoilage < 0.
  quantity numeric(12, 3) not null,
  unit_cost_cents numeric(12, 4),
  supplier_id uuid references suppliers (id) on delete set null,
  expires_on date,          -- spoilage tracking for purchased lots
  paid boolean not null default true,
  order_id uuid,            -- set when usage was caused by an order (FK added below)
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  check (
    (type = 'purchase' and quantity > 0)
    or (type in ('usage', 'spoilage') and quantity < 0)
    or type = 'adjustment'
  )
);
create index on inventory_transactions (ingredient_id, occurred_at desc);
create index on inventory_transactions (expires_on) where expires_on is not null;

create or replace function apply_inventory_transaction() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update ingredients
       set quantity_on_hand = quantity_on_hand + new.quantity,
           cost_per_unit_cents = case
             when new.type = 'purchase' and new.unit_cost_cents is not null then new.unit_cost_cents
             else cost_per_unit_cents end
     where id = new.ingredient_id;
  elsif tg_op = 'DELETE' then
    update ingredients set quantity_on_hand = quantity_on_hand - old.quantity
     where id = old.ingredient_id;
  end if;
  return null;
end $$;

create trigger inventory_transactions_apply
after insert or delete on inventory_transactions
for each row execute function apply_inventory_transaction();

-- ─────────────────────────────────────────────────────────────
-- Menu & recipes
-- ─────────────────────────────────────────────────────────────
create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text not null default 'parfait',
  price_cents int not null check (price_cents >= 0),
  image_url text,
  is_active boolean not null default true,
  is_flavor_of_month boolean not null default false,
  -- Optional per-language overrides: {"es": {"name": "...", "description": "..."}, "zh": {...}}
  translations jsonb not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table recipe_items (
  product_id uuid not null references products (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0), -- in the ingredient's unit, per 1 product
  primary key (product_id, ingredient_id)
);

-- ─────────────────────────────────────────────────────────────
-- Customers
-- ─────────────────────────────────────────────────────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext unique,
  phone text unique,
  organization text,                      -- set for B2B (e.g. the University)
  is_b2b boolean not null default false,
  loyalty_points int not null default 0,
  marketing_opt_in boolean not null default false,
  preferred_language text not null default 'en',
  notes text,                             -- "likes extra strawberries", allergies, etc.
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Orders & queue
-- ─────────────────────────────────────────────────────────────
create type order_source as enum ('online', 'walk_in', 'phone', 'voice_agent', 'b2b');
create type order_status as enum (
  'pending_payment', -- online checkout started, not yet paid
  'new',             -- in grandma's queue
  'in_progress',     -- being made
  'ready',           -- ready for pickup
  'completed',       -- handed over
  'cancelled'
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique, -- short, human-friendly (#1042)
  customer_id uuid references customers (id) on delete set null,
  source order_source not null,
  status order_status not null default 'new',
  pickup_at timestamptz,
  subtotal_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  notes text,
  stripe_checkout_session_id text unique,
  voice_call_id text,                    -- for orders taken by the future voice agent
  queue_rank double precision,           -- manual drag ordering in the queue (lower = sooner)
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on orders (status, pickup_at);
create index on orders (customer_id);

alter table inventory_transactions
  add constraint inventory_transactions_order_id_fkey
  foreign key (order_id) references orders (id) on delete set null;

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,         -- snapshot at time of order
  notes text
);
create index on order_items (order_id);

create or replace function touch_order_status() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;

create trigger orders_touch_status before update on orders
for each row execute function touch_order_status();

-- When an order is accepted (inserted as non-pending, or paid online), deduct recipe ingredients
-- and award loyalty points (1 point per dollar).
create or replace function on_order_accepted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status not in ('pending_payment', 'cancelled')
     and (tg_op = 'INSERT' or old.status = 'pending_payment') then
    insert into inventory_transactions (ingredient_id, type, quantity, order_id, notes, created_by)
    select ri.ingredient_id, 'usage', -sum(ri.quantity * oi.quantity), new.id,
           'Auto: order #' || new.order_number, null
      from order_items oi
      join recipe_items ri on ri.product_id = oi.product_id
     where oi.order_id = new.id
     group by ri.ingredient_id;

    if new.customer_id is not null then
      update customers set loyalty_points = loyalty_points + (new.total_cents / 100)
       where id = new.customer_id;
    end if;
  end if;
  return null;
end $$;

-- Deferred so order_items inserted in the same transaction are visible.
create constraint trigger orders_accepted
after insert or update of status on orders
deferrable initially deferred
for each row execute function on_order_accepted();

-- ─────────────────────────────────────────────────────────────
-- Payments (reconcile Stripe + Verifone terminal + cash)
-- ─────────────────────────────────────────────────────────────
create type payment_method as enum ('stripe', 'card_terminal', 'cash', 'invoice');

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id) on delete set null,
  method payment_method not null,
  amount_cents int not null,
  external_ref text unique,              -- Stripe payment_intent id, terminal receipt #, etc.
  received_at timestamptz not null default now(),
  notes text
);
create index on payments (received_at);

-- Recurring bills & other spending (rent, utilities, packaging...).
create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,                -- ingredients, rent, utilities, packaging, marketing...
  description text,
  amount_cents int not null,
  supplier_id uuid references suppliers (id) on delete set null,
  incurred_on date not null default current_date,
  is_recurring boolean not null default false,
  recurrence text check (recurrence in ('weekly', 'monthly', 'yearly')),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Reporting views (security_invoker so RLS applies)
-- ─────────────────────────────────────────────────────────────
create view product_costs with (security_invoker = true) as
select p.id as product_id, p.name, p.price_cents,
       coalesce(sum(ri.quantity * i.cost_per_unit_cents), 0)::numeric(12, 2) as ingredient_cost_cents,
       case when p.price_cents > 0
            then round(100 * (1 - coalesce(sum(ri.quantity * i.cost_per_unit_cents), 0) / p.price_cents), 1)
       end as margin_pct
  from products p
  left join recipe_items ri on ri.product_id = p.id
  left join ingredients i on i.id = ri.ingredient_id
 group by p.id;

create view low_stock_ingredients with (security_invoker = true) as
select * from ingredients where quantity_on_hand <= reorder_threshold;

create view expiring_lots with (security_invoker = true) as
select t.id, t.ingredient_id, i.name, t.quantity, i.unit, t.expires_on
  from inventory_transactions t join ingredients i on i.id = t.ingredient_id
 where t.type = 'purchase' and t.expires_on is not null
   and t.expires_on <= current_date + 3
 order by t.expires_on;

create view customer_stats with (security_invoker = true) as
select c.id, c.name, c.email, c.phone, c.organization, c.is_b2b, c.loyalty_points,
       count(o.id) filter (where o.status not in ('pending_payment', 'cancelled')) as order_count,
       coalesce(sum(o.total_cents) filter (where o.status not in ('pending_payment', 'cancelled')), 0) as lifetime_cents,
       max(o.created_at) as last_order_at
  from customers c left join orders o on o.customer_id = c.id
 group by c.id;

create view daily_sales with (security_invoker = true) as
select date_trunc('day', o.created_at)::date as day, o.source,
       count(*) as orders, sum(o.total_cents) as revenue_cents
  from orders o
 where o.status not in ('pending_payment', 'cancelled')
 group by 1, 2;

create view product_sales with (security_invoker = true) as
select p.id as product_id, p.name,
       sum(oi.quantity) as units, sum(oi.quantity * oi.unit_price_cents) as revenue_cents
  from order_items oi
  join orders o on o.id = oi.order_id and o.status not in ('pending_payment', 'cancelled')
  join products p on p.id = oi.product_id
 group by p.id;

-- ─────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────
-- Staff can do everything. The public can only read the active menu.
-- Online orders are written by the Cloudflare Worker using the service role key.
do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'suppliers', 'ingredients', 'supplier_prices', 'inventory_transactions',
    'products', 'recipe_items', 'customers', 'orders', 'order_items', 'payments', 'expenses'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "staff full access" on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

create policy "public can read active menu" on products
  for select to anon, authenticated using (is_active);

-- Public menu with allergens rolled up from recipes (ingredients themselves stay private).
create or replace function get_menu()
returns table (
  id uuid, slug text, name text, description text, category text, price_cents int,
  image_url text, is_flavor_of_month boolean, translations jsonb, allergens text[]
)
language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.name, p.description, p.category, p.price_cents, p.image_url,
         p.is_flavor_of_month, p.translations,
         coalesce(array(
           select distinct a from recipe_items ri
             join ingredients i on i.id = ri.ingredient_id, unnest(i.allergens) a
            where ri.product_id = p.id order by a
         ), '{}')
    from products p
   where p.is_active
   order by p.is_flavor_of_month desc, p.sort_order, p.name;
$$;
grant execute on function get_menu() to anon, authenticated;

-- Realtime for the live order queue.
alter publication supabase_realtime add table orders;
