-- Inventory ledger: ingredient orders placed with suppliers, their arrival, bills to pay
-- (supplier orders, ad-hoc purchases, recurring expenses) and closing out spoiled lots.

-- ─────────────────────────────────────────────────────────────
-- Ingredient orders (placed with a supplier, arrive later)
-- ─────────────────────────────────────────────────────────────
create type supplier_order_status as enum ('ordered', 'arrived', 'cancelled');

create table supplier_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete restrict,
  status supplier_order_status not null default 'ordered',
  ordered_on date not null default current_date,
  expected_on date,
  arrived_on date,
  paid_on date,                          -- null = still owed
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index on supplier_orders (status, expected_on);

create table supplier_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references supplier_orders (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),          -- ordered, in the ingredient's unit
  quantity_received numeric(12, 3) check (quantity_received >= 0), -- set on arrival (short deliveries)
  unit_cost_cents numeric(12, 4) not null check (unit_cost_cents >= 0)
);
create index on supplier_order_items (order_id);

-- Deliveries and lot close-out on the stock ledger.
alter table inventory_transactions
  add column supplier_order_id uuid references supplier_orders (id) on delete set null,
  -- Purchase lots only: set once the lot is used up or thrown out, so it leaves the expiry list.
  add column lot_closed_at timestamptz;
create index on inventory_transactions (supplier_order_id) where supplier_order_id is not null;

-- Record a delivery: one purchase movement per received line (with its use-by date), then mark
-- the order arrived. Runs as the caller, so RLS (staff only) applies.
-- p_lines: [{"item_id": uuid, "quantity": number, "expires_on": "YYYY-MM-DD" | null}, ...]
create or replace function receive_supplier_order(p_order_id uuid, p_lines jsonb)
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

  update supplier_order_items i
     set quantity_received = greatest(l.quantity, 0)
    from jsonb_to_recordset(p_lines) as l (item_id uuid, quantity numeric, expires_on date)
   where i.id = l.item_id and i.order_id = o.id;

  insert into inventory_transactions
    (ingredient_id, type, quantity, unit_cost_cents, supplier_id, expires_on, paid, supplier_order_id, notes)
  select i.ingredient_id, 'purchase', l.quantity, i.unit_cost_cents, o.supplier_id, l.expires_on,
         o.paid_on is not null, o.id, 'Delivery'
    from jsonb_to_recordset(p_lines) as l (item_id uuid, quantity numeric, expires_on date)
    join supplier_order_items i on i.id = l.item_id and i.order_id = o.id
   where l.quantity > 0;

  update supplier_orders set status = 'arrived', arrived_on = current_date where id = o.id;
end $$;

grant execute on function receive_supplier_order(uuid, jsonb) to authenticated;

-- Paying an order also marks its delivered stock as paid.
create or replace function sync_supplier_order_paid() returns trigger
language plpgsql as $$
begin
  update inventory_transactions set paid = (new.paid_on is not null)
   where supplier_order_id = new.id;
  return null;
end $$;

create trigger supplier_orders_sync_paid
after update of paid_on on supplier_orders
for each row when (old.paid_on is distinct from new.paid_on)
execute function sync_supplier_order_paid();

-- ─────────────────────────────────────────────────────────────
-- Bills: recurring expenses roll forward when paid
-- ─────────────────────────────────────────────────────────────
-- incurred_on doubles as the due date for unpaid bills.
alter table expenses
  add column paid_on date,
  add constraint expenses_recurrence_required check (not is_recurring or recurrence is not null);
update expenses set paid_on = incurred_on where paid;

create or replace function on_expense_paid() returns trigger
language plpgsql as $$
begin
  if new.paid and not old.paid then
    new.paid_on := coalesce(new.paid_on, current_date);
    -- Recurring: queue up the next one, unless it already exists.
    if new.is_recurring then
      insert into expenses (category, description, amount_cents, supplier_id, incurred_on, is_recurring, recurrence, paid)
      select new.category, new.description, new.amount_cents, new.supplier_id,
             (new.incurred_on + case new.recurrence
                                  when 'weekly' then interval '7 days'
                                  when 'monthly' then interval '1 month'
                                  else interval '1 year' end)::date,
             true, new.recurrence, false
       where not exists (
         select 1 from expenses e
          where e.is_recurring
            and e.category = new.category
            and e.description is not distinct from new.description
            and e.supplier_id is not distinct from new.supplier_id
            and e.incurred_on > new.incurred_on
       );
    end if;
  elsif not new.paid then
    new.paid_on := null;
  end if;
  return new;
end $$;

create trigger expenses_on_paid
before update of paid on expenses
for each row execute function on_expense_paid();

-- Everything still owed, oldest first: ingredient orders, ad-hoc purchases logged as unpaid, and bills.
create view bills_due with (security_invoker = true) as
select 'supplier_order'::text as kind, o.id, s.name as payee,
       'Ingredient order (' || to_char(o.ordered_on, 'Mon DD') || ')' as description,
       coalesce(o.arrived_on, o.expected_on, o.ordered_on) as due_on,
       round(sum(coalesce(i.quantity_received, i.quantity) * i.unit_cost_cents))::int as amount_cents,
       false as is_recurring
  from supplier_orders o
  join suppliers s on s.id = o.supplier_id
  join supplier_order_items i on i.order_id = o.id
 where o.status <> 'cancelled' and o.paid_on is null
 group by o.id, s.name
union all
select 'purchase', t.id, coalesce(s.name, 'No supplier'), ing.name,
       t.occurred_at::date, round(t.quantity * coalesce(t.unit_cost_cents, 0))::int, false
  from inventory_transactions t
  join ingredients ing on ing.id = t.ingredient_id
  left join suppliers s on s.id = t.supplier_id
 where t.type = 'purchase' and not t.paid and t.supplier_order_id is null
union all
select 'expense', e.id, coalesce(s.name, initcap(e.category)), coalesce(e.description, e.category),
       e.incurred_on, e.amount_cents, e.is_recurring
  from expenses e
  left join suppliers s on s.id = e.supplier_id
 where not e.paid;

-- Purchase lots expiring within 3 days (or already expired) that haven't been used up or thrown out.
create or replace view expiring_lots with (security_invoker = true) as
select t.id, t.ingredient_id, i.name, t.quantity, i.unit, t.expires_on
  from inventory_transactions t join ingredients i on i.id = t.ingredient_id
 where t.type = 'purchase' and t.expires_on is not null
   and t.expires_on <= current_date + 3
   and t.lot_closed_at is null
 order by t.expires_on;

-- ─────────────────────────────────────────────────────────────
-- RLS + grants
-- ─────────────────────────────────────────────────────────────
alter table supplier_orders enable row level security;
alter table supplier_order_items enable row level security;
create policy "staff full access" on supplier_orders for all to authenticated using (is_staff()) with check (is_staff());
create policy "staff full access" on supplier_order_items for all to authenticated using (is_staff()) with check (is_staff());

grant select, insert, update, delete on supplier_orders, supplier_order_items to authenticated;
grant select on bills_due to authenticated;
