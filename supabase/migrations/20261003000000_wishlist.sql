-- Grandma's wishlist: inventory-ledger fixes, end-of-day close-outs, and a customer taste poll.

-- ─────────────────────────────────────────────────────────────
-- Inventory ledger fixes
-- ─────────────────────────────────────────────────────────────

-- Deleting an order that already put stock on the shelf would turn its deliveries into
-- stray "unpaid purchase" bills. Cancel orders instead; only never-delivered ones can be deleted.
alter table inventory_transactions
  drop constraint inventory_transactions_supplier_order_id_fkey,
  add constraint inventory_transactions_supplier_order_id_fkey
    foreign key (supplier_order_id) references supplier_orders (id) on delete restrict;

-- Create an order and its lines in one transaction (no half-saved orders).
-- p_lines: [{"ingredient_id": uuid, "quantity": number, "unit_cost_cents": number}, ...]
-- p_today: the bakery's local date (the database runs in UTC).
create or replace function create_supplier_order(
  p_supplier_id uuid,
  p_lines jsonb,
  p_expected_on date default null,
  p_paid_on date default null,
  p_notes text default null,
  p_today date default current_date
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if jsonb_array_length(coalesce(p_lines, '[]')) = 0 then
    raise exception 'Add at least one ingredient';
  end if;

  insert into supplier_orders (supplier_id, ordered_on, expected_on, paid_on, notes)
  values (p_supplier_id, p_today, p_expected_on, p_paid_on, p_notes)
  returning id into v_id;

  insert into supplier_order_items (order_id, ingredient_id, quantity, unit_cost_cents)
  select v_id, l.ingredient_id, l.quantity, l.unit_cost_cents
    from jsonb_to_recordset(p_lines) as l (ingredient_id uuid, quantity numeric, unit_cost_cents numeric);

  return v_id;
end $$;

grant execute on function create_supplier_order(uuid, jsonb, date, date, text, date) to authenticated;

-- Record a delivery. Fixes over the first version:
--  * lines left out of p_lines count as not delivered (received 0), so they aren't billed;
--  * the same item listed twice is summed once instead of stocking twice;
--  * amounts are rounded to the column's precision before the "> 0" check;
--  * arrived_on uses the bakery's local date (p_today) rather than UTC.
drop function receive_supplier_order(uuid, jsonb);
create function receive_supplier_order(p_order_id uuid, p_lines jsonb, p_today date default current_date)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  o supplier_orders;
begin
  select * into o from supplier_orders where id = p_order_id for update;
  if not found then
    raise exception 'Ingredient order not found';
  end if;
  if o.status <> 'ordered' then
    raise exception 'This order is already %', o.status;
  end if;

  with l as (
    select x.item_id,
           greatest(sum(x.quantity), 0)::numeric(12, 3) as quantity
      from jsonb_to_recordset(coalesce(p_lines, '[]')) as x (item_id uuid, quantity numeric, expires_on date)
     group by x.item_id
  )
  update supplier_order_items i
     set quantity_received = coalesce((select l.quantity from l where l.item_id = i.id), 0)
   where i.order_id = o.id;

  insert into inventory_transactions
    (ingredient_id, type, quantity, unit_cost_cents, supplier_id, expires_on, paid, supplier_order_id, notes)
  select i.ingredient_id, 'purchase', i.quantity_received, i.unit_cost_cents, o.supplier_id,
         (select max(x.expires_on)
            from jsonb_to_recordset(coalesce(p_lines, '[]')) as x (item_id uuid, quantity numeric, expires_on date)
           where x.item_id = i.id),
         o.paid_on is not null, o.id, 'Delivery'
    from supplier_order_items i
   where i.order_id = o.id and i.quantity_received > 0;

  update supplier_orders set status = 'arrived', arrived_on = p_today where id = o.id;
end $$;

grant execute on function receive_supplier_order(uuid, jsonb, date) to authenticated;

-- Close out an expiring lot (used up, or partly thrown away) in one step. Safe to retry:
-- a lot that's already closed is left alone, so spoilage is never logged twice.
create or replace function close_lot(p_lot_id uuid, p_spoiled numeric default 0)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  t inventory_transactions;
  v_spoiled numeric(12, 3) := greatest(coalesce(p_spoiled, 0), 0);
begin
  select * into t from inventory_transactions where id = p_lot_id and type = 'purchase' for update;
  if not found then
    raise exception 'Lot not found';
  end if;
  if t.lot_closed_at is not null then
    return;
  end if;

  if v_spoiled > 0 then
    insert into inventory_transactions (ingredient_id, type, quantity, notes)
    values (t.ingredient_id, 'spoilage', -v_spoiled,
            'Spoiled lot' || coalesce(', use by ' || to_char(t.expires_on, 'Mon DD'), ''));
  end if;

  update inventory_transactions set lot_closed_at = now() where id = t.id;
end $$;

grant execute on function close_lot(uuid, numeric) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Recurring bills: series, month-end anchoring, and bills entered already paid
-- ─────────────────────────────────────────────────────────────
-- Every instance of a repeating bill shares a series_id, so two bills with the same name
-- (e.g. water on the 1st and on the 15th) no longer block each other.
alter table expenses add column series_id uuid;

update expenses e
   set series_id = s.sid
  from (
    select id,
           first_value(id) over (partition by category, description, supplier_id, recurrence
                                 order by incurred_on, created_at) as sid
      from expenses
     where is_recurring
  ) s
 where e.id = s.id;

create index on expenses (series_id, incurred_on) where series_id is not null;

-- Next due date, keeping the original day of month (Jan 31 → Feb 28 → Mar 31, not Mar 28).
create or replace function next_due_date(d date, recurrence text, anchor date)
returns date
language sql immutable as $$
  select case recurrence
    when 'weekly' then d + 7
    else (
      select first_of_month
             + (least(extract(day from anchor)::int,
                      extract(day from (first_of_month + interval '1 month' - interval '1 day'))::int) - 1)
        from (select (date_trunc('month', d)
                      + case recurrence when 'monthly' then interval '1 month' else interval '1 year' end)::date
                     as first_of_month) m
    )
  end
$$;

drop trigger expenses_on_paid on expenses;
drop function on_expense_paid();

-- Keep paid_on in step with paid, and start a series for new repeating bills.
create or replace function expenses_before_write() returns trigger
language plpgsql as $$
begin
  if new.is_recurring and new.series_id is null then
    new.series_id := new.id;
  end if;
  if new.paid then
    new.paid_on := coalesce(new.paid_on, current_date);
  else
    new.paid_on := null;
  end if;
  return new;
end $$;

create trigger expenses_before_write
before insert or update on expenses
for each row execute function expenses_before_write();

-- Paying a repeating bill (or entering one already paid) queues up the next one.
create or replace function expenses_roll_forward() returns trigger
language plpgsql as $$
begin
  if new.paid and new.is_recurring and (tg_op = 'INSERT' or not old.paid) then
    insert into expenses (category, description, amount_cents, supplier_id, incurred_on,
                          is_recurring, recurrence, paid, series_id)
    select new.category, new.description, new.amount_cents, new.supplier_id,
           next_due_date(new.incurred_on, new.recurrence,
                         (select min(e.incurred_on) from expenses e where e.series_id = new.series_id)),
           true, new.recurrence, false, new.series_id
     where not exists (
       select 1 from expenses e where e.series_id = new.series_id and e.incurred_on > new.incurred_on
     );
  end if;
  return null;
end $$;

create trigger expenses_roll_forward
after insert or update of paid on expenses
for each row execute function expenses_roll_forward();

-- Bills already paid before this migration (e.g. seeded rent) get the next instance now.
insert into expenses (category, description, amount_cents, supplier_id, incurred_on, is_recurring, recurrence, paid, series_id)
select e.category, e.description, e.amount_cents, e.supplier_id,
       next_due_date(e.incurred_on, e.recurrence, (select min(x.incurred_on) from expenses x where x.series_id = e.series_id)),
       true, e.recurrence, false, e.series_id
  from expenses e
 where e.is_recurring and e.paid
   and e.incurred_on = (select max(x.incurred_on) from expenses x where x.series_id = e.series_id);

-- ─────────────────────────────────────────────────────────────
-- End-of-day close-out (sales vs. Verifone terminal and cash drawer)
-- ─────────────────────────────────────────────────────────────
-- Expected amounts are what the app recorded that day; counted amounts are what grandma
-- reads off the terminal's batch report and counts in the drawer. Snapshotting both keeps
-- the record stable for tax time even if an order is edited later.
create table daily_closeouts (
  day date primary key,
  card_expected_cents int not null default 0,
  card_counted_cents int,
  cash_expected_cents int not null default 0,
  cash_counted_cents int,
  online_cents int not null default 0,
  notes text,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) default auth.uid()
);

alter table daily_closeouts enable row level security;
create policy "staff full access" on daily_closeouts for all to authenticated using (is_staff()) with check (is_staff());
grant select, insert, update, delete on daily_closeouts to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Taste poll: customers vote on candidate flavors before one goes on the menu
-- ─────────────────────────────────────────────────────────────
alter table products add column in_taste_poll boolean not null default false;

create table flavor_votes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  -- Hash of the voter's IP + product, so one person can't stuff the ballot. Null when unknown.
  voter_hash text,
  created_at timestamptz not null default now(),
  unique (product_id, voter_hash)
);
create index on flavor_votes (product_id);

alter table flavor_votes enable row level security;
create policy "staff full access" on flavor_votes for all to authenticated using (is_staff()) with check (is_staff());
grant select, insert, update, delete on flavor_votes to authenticated;

-- Public: the candidates and their vote counts (candidates can be off the menu, so this bypasses RLS).
create or replace function get_flavor_poll()
returns table (
  id uuid, slug text, name text, description text, category text, price_cents int,
  translations jsonb, allergens text[], votes bigint
)
language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.name, p.description, p.category, p.price_cents, p.translations,
         coalesce(array(
           select distinct a from recipe_items ri
             join ingredients i on i.id = ri.ingredient_id, unnest(i.allergens) a
            where ri.product_id = p.id order by a
         ), '{}'),
         (select count(*) from flavor_votes v where v.product_id = p.id)
    from products p
   where p.in_taste_poll
   order by p.sort_order, p.name;
$$;
grant execute on function get_flavor_poll() to anon, authenticated;

-- Public: cast a vote. Repeat votes from the same IP for the same flavor are ignored.
create or replace function vote_for_flavor(p_product_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ip text := split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
    ''), ',', 1);
begin
  if not exists (select 1 from products where id = p_product_id and in_taste_poll) then
    raise exception 'That flavor is not in the taste poll';
  end if;
  insert into flavor_votes (product_id, voter_hash)
  values (p_product_id, nullif(md5(v_ip || p_product_id::text), md5(p_product_id::text)))
  on conflict (product_id, voter_hash) do nothing;
end $$;
grant execute on function vote_for_flavor(uuid) to anon, authenticated;
