-- Demo data for local development (`supabase db reset`).

insert into suppliers (id, name, contact_name, phone, is_local, delivery_days, lead_time_days, notes) values
  ('00000000-0000-0000-0000-00000000a001', 'Valley Dairy Co.',     'Ruth',  '555-0101', false, '{mon,wed,fri}', 1, 'Trusted cream supplier. Raised prices in Sept.'),
  ('00000000-0000-0000-0000-00000000a002', 'Hillside Family Farm', 'Marco', '555-0102', true,  '{tue,sat}',     2, 'Local berries & apples, seasonal.'),
  ('00000000-0000-0000-0000-00000000a003', 'Metro Restaurant Supply', null, '555-0103', false, '{mon,tue,wed,thu,fri}', 1, 'Dry goods, packaging.');

-- Ingredients are created by the expanded_menu migration; give them their usual suppliers.
update ingredients i set preferred_supplier_id = s.supplier_id::uuid
  from (values
    ('00000000-0000-0000-0000-00000000a001', '{Heavy cream,Greek yogurt,Butter,Whole milk,Cream cheese,Eggs}'::text[]),
    ('00000000-0000-0000-0000-00000000a002', '{Strawberries,Apples,Blueberries,Carrots,Honey}'::text[]),
    ('00000000-0000-0000-0000-00000000a003', '{Granola,Pumpkin purée,Cinnamon,Parfait cups,All-purpose flour,Sugar,Bananas,Lemons,Mango,Chocolate chips,Cocoa powder,Rolled oats,Walnuts,Coffee beans,Black tea bags,Pastry bags,Cake boxes,Hot cups,Cold cups}'::text[])
  ) as s(supplier_id, names)
 where i.name = any(s.names);

-- Opening stock (purchases set on-hand and current cost via trigger).
insert into inventory_transactions (ingredient_id, type, quantity, unit_cost_cents, supplier_id, expires_on, notes, created_by) values
  ('00000000-0000-0000-0000-00000000b001', 'purchase', 6000, 0.9,  '00000000-0000-0000-0000-00000000a001', current_date + 5, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b002', 'purchase', 5000, 0.6,  '00000000-0000-0000-0000-00000000a001', current_date + 7, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b003', 'purchase', 3000, 1.1,  '00000000-0000-0000-0000-00000000a002', current_date + 2, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b004', 'purchase',   40, 60,   '00000000-0000-0000-0000-00000000a002', current_date + 14, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b005', 'purchase', 4000, 0.8,  '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b006', 'purchase', 3000, 0.5,  '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b007', 'purchase',  200, 4,    '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b008', 'purchase',  200, 18,   '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b009', 'purchase', 20000, 0.2, '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b010', 'purchase', 6000, 1.6,  '00000000-0000-0000-0000-00000000a001', current_date + 30, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b011', 'purchase',  120, 35,   '00000000-0000-0000-0000-00000000a001', current_date + 21, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b012', 'purchase', 10000, 0.25, '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b013', 'purchase', 12000, 0.15, '00000000-0000-0000-0000-00000000a001', current_date + 6, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b014', 'purchase', 2500, 2.2,  '00000000-0000-0000-0000-00000000a002', current_date + 3, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b015', 'purchase',   24, 30,   '00000000-0000-0000-0000-00000000a003', current_date + 4, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b016', 'purchase',   30, 60,   '00000000-0000-0000-0000-00000000a003', current_date + 14, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b017', 'purchase', 2000, 0.9,  '00000000-0000-0000-0000-00000000a003', current_date + 4, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b018', 'purchase', 1500, 1.4,  '00000000-0000-0000-0000-00000000a002', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b019', 'purchase', 3000, 1.2,  '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b020', 'purchase', 1000, 2,    '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b021', 'purchase', 4000, 0.4,  '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b022', 'purchase', 1000, 2.5,  '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b023', 'purchase', 2000, 1.1,  '00000000-0000-0000-0000-00000000a001', current_date + 12, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b024', 'purchase', 2000, 0.3,  '00000000-0000-0000-0000-00000000a002', current_date + 10, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b025', 'purchase', 2500, 3,    '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b026', 'purchase',  100, 12,   '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b027', 'purchase',  500, 5,    '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b028', 'purchase',   80, 45,   '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b029', 'purchase',  300, 12,   '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null),
  ('00000000-0000-0000-0000-00000000b030', 'purchase',  150, 10,   '00000000-0000-0000-0000-00000000a003', null, 'Opening stock', null);

insert into supplier_prices (supplier_id, ingredient_id, price_cents, effective_on, notes) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', 0.9,  current_date - 60, 'Before tariff'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', 1.25, current_date - 3,  'Tariff increase'),
  ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000b001', 1.05, current_date - 3,  'Quote');

insert into products (id, slug, name, description, category, price_cents, is_flavor_of_month, sort_order, translations) values
  ('00000000-0000-0000-0000-00000000c001', 'strawberry-classic', 'Strawberry Classic',
   'Greek yogurt, whipped cream, fresh strawberries and house granola.', 'parfait', 750, false, 1,
   '{"es": {"name": "Clásico de Fresa", "description": "Yogur griego, crema batida, fresas frescas y granola de la casa."},
     "zh": {"name": "经典草莓芭菲", "description": "希腊酸奶、鲜奶油、新鲜草莓和自制格兰诺拉麦片。"}}'),
  ('00000000-0000-0000-0000-00000000c002', 'fall-parfait', 'Fall Parfait',
   'Spiced pumpkin cream, cinnamon apples and granola crunch.', 'parfait', 850, true, 0,
   '{"es": {"name": "Parfait de Otoño", "description": "Crema de calabaza especiada, manzanas con canela y granola crujiente."},
     "zh": {"name": "秋日芭菲", "description": "香料南瓜奶油、肉桂苹果和香脆格兰诺拉麦片。"}}'),
  ('00000000-0000-0000-0000-00000000c003', 'yogurt-cup', 'Simple Yogurt Cup',
   'Greek yogurt with a drizzle of honey and granola.', 'parfait', 500, false, 2,
   '{"es": {"name": "Vasito de Yogur", "description": "Yogur griego con un chorrito de miel y granola."},
     "zh": {"name": "简单酸奶杯", "description": "希腊酸奶淋上蜂蜜，配格兰诺拉麦片。"}}');

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

-- Ingredient orders: one on its way, one delivered but not paid yet.
insert into supplier_orders (id, supplier_id, ordered_on, expected_on, notes) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000a002', current_date - 1, current_date + 1, 'Weekend berries'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000a003', current_date - 4, current_date - 2, null);

insert into supplier_order_items (id, order_id, ingredient_id, quantity, unit_cost_cents) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b003', 2000, 1.1),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000b005', 2000, 0.8),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000b008', 100, 18);

select receive_supplier_order('00000000-0000-0000-0000-00000000d002',
  '[{"item_id": "00000000-0000-0000-0000-00000000e002", "quantity": 2000, "expires_on": null},
    {"item_id": "00000000-0000-0000-0000-00000000e003", "quantity": 100, "expires_on": null}]');
