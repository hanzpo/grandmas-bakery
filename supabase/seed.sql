-- Demo data for local development (`supabase db reset`).

insert into suppliers (id, name, contact_name, phone, is_local, delivery_days, lead_time_days, notes) values
  ('00000000-0000-0000-0000-00000000a001', 'Valley Dairy Co.',     'Ruth',  '555-0101', false, '{mon,wed,fri}', 1, 'Trusted cream supplier. Raised prices in Sept.'),
  ('00000000-0000-0000-0000-00000000a002', 'Hillside Family Farm', 'Marco', '555-0102', true,  '{tue,sat}',     2, 'Local berries & apples, seasonal.'),
  ('00000000-0000-0000-0000-00000000a003', 'Metro Restaurant Supply', null, '555-0103', false, '{mon,tue,wed,thu,fri}', 1, 'Dry goods, packaging.');

insert into ingredients (id, name, unit, reorder_threshold, preferred_supplier_id, allergens) values
  ('00000000-0000-0000-0000-00000000b001', 'Heavy cream',    'ml',   2000, '00000000-0000-0000-0000-00000000a001', '{dairy}'),
  ('00000000-0000-0000-0000-00000000b002', 'Greek yogurt',   'g',    2000, '00000000-0000-0000-0000-00000000a001', '{dairy}'),
  ('00000000-0000-0000-0000-00000000b003', 'Strawberries',   'g',    1000, '00000000-0000-0000-0000-00000000a002', '{}'),
  ('00000000-0000-0000-0000-00000000b004', 'Apples',         'each',   10, '00000000-0000-0000-0000-00000000a002', '{}'),
  ('00000000-0000-0000-0000-00000000b005', 'Granola',        'g',    1000, '00000000-0000-0000-0000-00000000a003', '{gluten,nuts}'),
  ('00000000-0000-0000-0000-00000000b006', 'Pumpkin purée',  'g',    1000, '00000000-0000-0000-0000-00000000a003', '{}'),
  ('00000000-0000-0000-0000-00000000b007', 'Cinnamon',       'g',      50, '00000000-0000-0000-0000-00000000a003', '{}'),
  ('00000000-0000-0000-0000-00000000b008', 'Parfait cups',   'each',   40, '00000000-0000-0000-0000-00000000a003', '{}');

-- Opening stock (purchases set on-hand and current cost via trigger).
insert into inventory_transactions (ingredient_id, type, quantity, unit_cost_cents, supplier_id, expires_on, notes, created_by) values
  ('00000000-0000-0000-0000-00000000b001', 'purchase', 6000, 0.9,  '00000000-0000-0000-0000-00000000a001', current_date + 5, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b002', 'purchase', 5000, 0.6,  '00000000-0000-0000-0000-00000000a001', current_date + 7, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b003', 'purchase', 3000, 1.1,  '00000000-0000-0000-0000-00000000a002', current_date + 2, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b004', 'purchase',   40, 60,   '00000000-0000-0000-0000-00000000a002', current_date + 14, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b005', 'purchase', 4000, 0.8,  '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b006', 'purchase', 3000, 0.5,  '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b007', 'purchase',  200, 4,    '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b008', 'purchase',  200, 18,   '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null);

insert into supplier_prices (supplier_id, ingredient_id, price_cents, effective_on, notes) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', 0.9,  current_date - 60, 'Before tariff'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', 1.25, current_date - 3,  'Tariff increase'),
  ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000b001', 1.05, current_date - 3,  'Quote');

insert into products (id, slug, name, description, category, price_cents, is_flavor_of_month, sort_order, translations) values
  ('00000000-0000-0000-0000-00000000c001', 'strawberry-classic', 'Strawberry Classic',
   'Greek yogurt, whipped cream, fresh strawberries and house granola.', 'parfait', 750, false, 1,
   '{"es": {"name": "Clásico de Fresa", "description": "Yogur griego, crema batida, fresas frescas y granola de la casa."}}'),
  ('00000000-0000-0000-0000-00000000c002', 'fall-parfait', 'Fall Parfait',
   'Spiced pumpkin cream, cinnamon apples and granola crunch.', 'parfait', 850, true, 0,
   '{"es": {"name": "Parfait de Otoño", "description": "Crema de calabaza especiada, manzanas con canela y granola crujiente."}}'),
  ('00000000-0000-0000-0000-00000000c003', 'yogurt-cup', 'Simple Yogurt Cup',
   'Greek yogurt with a drizzle of honey and granola.', 'parfait', 500, false, 2, '{}');

insert into recipe_items (product_id, ingredient_id, quantity) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002', 150),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 60),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b003', 80),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b005', 40),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b008', 1),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b002', 120),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b001', 80),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b006', 70),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b004', 0.5),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b007', 1),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b005', 40),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b008', 1),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000b002', 180),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000b005', 30),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000b008', 1);

insert into customers (id, name, email, phone, organization, is_b2b, notes) values
  ('00000000-0000-0000-0000-00000000d001', 'Eleanor Park', 'eleanor@example.com', '555-0201', null, false, 'Comes every Saturday. Extra strawberries.'),
  ('00000000-0000-0000-0000-00000000d002', 'Sam Okafor',   'sam@example.com',     '555-0202', null, false, null),
  ('00000000-0000-0000-0000-00000000d003', 'Dana Lee',     'events@university.example', '555-0203', 'State University Events', true, 'Needs 2-day notice ideally.');

-- A few orders in the queue (status 'new' triggers inventory usage + loyalty points).
with o as (
  insert into orders (customer_id, source, status, pickup_at, subtotal_cents, total_cents, notes) values
    ('00000000-0000-0000-0000-00000000d001', 'walk_in', 'completed', now() - interval '2 days', 1500, 1500, null),
    ('00000000-0000-0000-0000-00000000d001', 'online',  'new',       now() + interval '2 hours', 1600, 1600, 'Extra strawberries please'),
    ('00000000-0000-0000-0000-00000000d002', 'phone',   'in_progress', now() + interval '1 hour', 850, 850, null),
    ('00000000-0000-0000-0000-00000000d003', 'b2b',     'new',       now() + interval '1 day', 25500, 25500, 'Campus open house, 30 cups')
  returning id, total_cents
)
insert into order_items (order_id, product_id, quantity, unit_price_cents)
select o.id, x.product_id, x.qty, x.price from o
join lateral (values
  (1500, '00000000-0000-0000-0000-00000000c001'::uuid, 2, 750),
  (1600, '00000000-0000-0000-0000-00000000c001'::uuid, 1, 750),
  (1600, '00000000-0000-0000-0000-00000000c002'::uuid, 1, 850),
  (850,  '00000000-0000-0000-0000-00000000c002'::uuid, 1, 850),
  (25500,'00000000-0000-0000-0000-00000000c002'::uuid, 30, 850)
) as x(total, product_id, qty, price) on x.total = o.total_cents;

insert into payments (order_id, method, amount_cents, notes)
select id, 'cash', total_cents, 'Seed' from orders where status = 'completed';

insert into expenses (category, description, amount_cents, supplier_id, is_recurring, recurrence, paid) values
  ('rent', 'Shop rent', 180000, null, true, 'monthly', true),
  ('utilities', 'Electric', 22000, null, true, 'monthly', false);
