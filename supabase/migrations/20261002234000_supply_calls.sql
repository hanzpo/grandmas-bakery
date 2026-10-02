-- Grocery reclaim: quote every supplier, then order from the one store that can fill the list.

create type supply_run_status as enum ('quoting', 'ordering', 'placed', 'failed');
create type supply_call_purpose as enum ('quote', 'order');
create type supply_call_status as enum ('pending', 'dialing', 'quoted', 'ordered', 'failed', 'skipped');

create table supply_settings (
  id int primary key default 1 check (id = 1),
  polling_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into supply_settings (id) values (1);

create table supply_runs (
  id uuid primary key default gen_random_uuid(),
  status supply_run_status not null default 'quoting',
  trigger text not null check (trigger in ('manual', 'poll')),
  winner_supplier_id uuid references suppliers (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open run at a time. Placed and failed runs do not count.
create unique index supply_runs_one_active
  on supply_runs ((true))
  where status in ('quoting', 'ordering');

create index supply_runs_created_at_idx on supply_runs (created_at desc);

create table supply_run_items (
  run_id uuid not null references supply_runs (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),
  primary key (run_id, ingredient_id)
);

create table supply_quotes (
  run_id uuid not null references supply_runs (id) on delete cascade,
  supplier_id uuid not null references suppliers (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  price_cents numeric(12, 4),
  available boolean not null,
  conversation_id text,
  primary key (run_id, supplier_id, ingredient_id),
  check (price_cents is null or price_cents >= 0),
  check (not available or price_cents is not null)
);

create table supply_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references supply_runs (id) on delete cascade,
  supplier_id uuid not null references suppliers (id) on delete cascade,
  purpose supply_call_purpose not null,
  status supply_call_status not null default 'pending',
  to_number text,
  conversation_id text,
  error text,
  created_at timestamptz not null default now(),
  unique (run_id, supplier_id, purpose)
);

create index supply_calls_run_id_idx on supply_calls (run_id);

create table supply_orders (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references supply_runs (id) on delete cascade,
  supplier_id uuid not null references suppliers (id) on delete restrict,
  total_cents numeric(12, 4) not null check (total_cents >= 0),
  conversation_id text,
  notes text,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'supply_settings', 'supply_runs', 'supply_run_items', 'supply_quotes', 'supply_calls', 'supply_orders'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "staff full access" on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

grant select, insert, update, delete on
  public.supply_settings,
  public.supply_runs,
  public.supply_run_items,
  public.supply_quotes,
  public.supply_calls,
  public.supply_orders
to authenticated;

grant all on
  public.supply_settings,
  public.supply_runs,
  public.supply_run_items,
  public.supply_quotes,
  public.supply_calls,
  public.supply_orders
to service_role;

grant usage on type
  public.supply_run_status,
  public.supply_call_purpose,
  public.supply_call_status
to authenticated, service_role;
