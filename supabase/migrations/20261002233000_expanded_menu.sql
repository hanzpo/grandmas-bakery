-- Expanded menu: pastries, breads, cookies & bars, cakes & pies and drinks alongside the parfaits.
-- `products.category` is the menu section the customer site groups items under
-- (parfait, pastry, bread, cookie, cake, drink; labels and order live in src/i18n).
--
-- Written to be safe on a database that already has data: ingredients match on name,
-- products on slug, and existing rows (e.g. prices grandma has changed) are left alone.

-- ─────────────────────────────────────────────────────────────
-- Ingredients (the original eight are listed so recipes below can use them on a fresh database)
-- ─────────────────────────────────────────────────────────────
insert into ingredients (id, name, unit, reorder_threshold, allergens) values
  ('00000000-0000-0000-0000-00000000b001', 'Heavy cream',     'ml',   2000, '{dairy}'),
  ('00000000-0000-0000-0000-00000000b002', 'Greek yogurt',    'g',    2000, '{dairy}'),
  ('00000000-0000-0000-0000-00000000b003', 'Strawberries',    'g',    1000, '{}'),
  ('00000000-0000-0000-0000-00000000b004', 'Apples',          'each',   10, '{}'),
  ('00000000-0000-0000-0000-00000000b005', 'Granola',         'g',    1000, '{gluten,nuts}'),
  ('00000000-0000-0000-0000-00000000b006', 'Pumpkin purée',   'g',    1000, '{}'),
  ('00000000-0000-0000-0000-00000000b007', 'Cinnamon',        'g',      50, '{}'),
  ('00000000-0000-0000-0000-00000000b008', 'Parfait cups',    'each',   40, '{}'),
  ('00000000-0000-0000-0000-00000000b009', 'All-purpose flour', 'g',  5000, '{gluten}'),
  ('00000000-0000-0000-0000-00000000b010', 'Butter',          'g',    2000, '{dairy}'),
  ('00000000-0000-0000-0000-00000000b011', 'Eggs',            'each',   24, '{egg}'),
  ('00000000-0000-0000-0000-00000000b012', 'Sugar',           'g',    3000, '{}'),
  ('00000000-0000-0000-0000-00000000b013', 'Whole milk',      'ml',   4000, '{dairy}'),
  ('00000000-0000-0000-0000-00000000b014', 'Blueberries',     'g',    1000, '{}'),
  ('00000000-0000-0000-0000-00000000b015', 'Bananas',         'each',   10, '{}'),
  ('00000000-0000-0000-0000-00000000b016', 'Lemons',          'each',   10, '{}'),
  ('00000000-0000-0000-0000-00000000b017', 'Mango',           'g',    1000, '{}'),
  ('00000000-0000-0000-0000-00000000b018', 'Honey',           'g',     500, '{}'),
  ('00000000-0000-0000-0000-00000000b019', 'Chocolate chips', 'g',    1000, '{dairy,soy}'),
  ('00000000-0000-0000-0000-00000000b020', 'Cocoa powder',    'g',     300, '{}'),
  ('00000000-0000-0000-0000-00000000b021', 'Rolled oats',     'g',    1000, '{}'),
  ('00000000-0000-0000-0000-00000000b022', 'Walnuts',         'g',     300, '{nuts}'),
  ('00000000-0000-0000-0000-00000000b023', 'Cream cheese',    'g',    1000, '{dairy}'),
  ('00000000-0000-0000-0000-00000000b024', 'Carrots',         'g',    1000, '{}'),
  ('00000000-0000-0000-0000-00000000b025', 'Coffee beans',    'g',    1000, '{}'),
  ('00000000-0000-0000-0000-00000000b026', 'Black tea bags',  'each',   50, '{}'),
  ('00000000-0000-0000-0000-00000000b027', 'Pastry bags',     'each',  100, '{}'),
  ('00000000-0000-0000-0000-00000000b028', 'Cake boxes',      'each',   30, '{}'),
  ('00000000-0000-0000-0000-00000000b029', 'Hot cups',        'each',  100, '{}'),
  ('00000000-0000-0000-0000-00000000b030', 'Cold cups',       'each',   50, '{}')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- Products
-- ─────────────────────────────────────────────────────────────
insert into products (id, slug, name, description, category, price_cents, sort_order, translations) values
  -- Parfaits
  ('00000000-0000-0000-0000-00000000c101', 'triple-berry-parfait', 'Triple Berry Parfait',
   'Greek yogurt, whipped cream, strawberries, blueberries and house granola.', 'parfait', 800, 3,
   '{"es": {"name": "Parfait de Tres Bayas", "description": "Yogur griego, crema batida, fresas, arándanos y granola de la casa."},
     "zh": {"name": "三重莓果芭菲", "description": "希腊酸奶、鲜奶油、草莓、蓝莓和自制格兰诺拉麦片。"}}'),
  ('00000000-0000-0000-0000-00000000c102', 'mango-sunrise-parfait', 'Mango Sunrise Parfait',
   'Greek yogurt, ripe mango, a swirl of honey and granola.', 'parfait', 800, 4,
   '{"es": {"name": "Parfait Amanecer de Mango", "description": "Yogur griego, mango maduro, un toque de miel y granola."},
     "zh": {"name": "芒果朝阳芭菲", "description": "希腊酸奶、熟芒果、蜂蜜和格兰诺拉麦片。"}}'),
  ('00000000-0000-0000-0000-00000000c103', 'chocolate-banana-parfait', 'Chocolate Banana Parfait',
   'Cocoa yogurt, sliced banana, whipped cream and chocolate chips.', 'parfait', 850, 5,
   '{"es": {"name": "Parfait de Chocolate y Plátano", "description": "Yogur de cacao, plátano en rodajas, crema batida y chispas de chocolate."},
     "zh": {"name": "巧克力香蕉芭菲", "description": "可可酸奶、香蕉片、鲜奶油和巧克力豆。"}}'),
  ('00000000-0000-0000-0000-00000000c104', 'lemon-blueberry-parfait', 'Lemon Blueberry Parfait',
   'Lemon-zest yogurt, whipped cream, blueberries and granola.', 'parfait', 800, 6,
   '{"es": {"name": "Parfait de Limón y Arándanos", "description": "Yogur con ralladura de limón, crema batida, arándanos y granola."},
     "zh": {"name": "柠檬蓝莓芭菲", "description": "柠檬皮酸奶、鲜奶油、蓝莓和格兰诺拉麦片。"}}'),
  ('00000000-0000-0000-0000-00000000c105', 'mini-parfait', 'Little One''s Parfait',
   'A kid-size cup of yogurt, strawberries and granola.', 'parfait', 400, 7,
   '{"es": {"name": "Parfait Pequeñito", "description": "Un vasito para niños con yogur, fresas y granola."},
     "zh": {"name": "儿童小芭菲", "description": "儿童份量的酸奶、草莓和格兰诺拉麦片。"}}'),

  -- Pastries
  ('00000000-0000-0000-0000-00000000c201', 'cinnamon-roll', 'Cinnamon Roll',
   'Soft, swirled and glazed with cream cheese icing.', 'pastry', 450, 10,
   '{"es": {"name": "Rollo de Canela", "description": "Suave, en espiral y glaseado con crema de queso."},
     "zh": {"name": "肉桂卷", "description": "松软的肉桂卷，淋上奶油奶酪糖霜。"}}'),
  ('00000000-0000-0000-0000-00000000c202', 'butter-croissant', 'Butter Croissant',
   'Flaky, golden and made with real butter.', 'pastry', 375, 11,
   '{"es": {"name": "Croissant de Mantequilla", "description": "Hojaldrado, dorado y hecho con mantequilla de verdad."},
     "zh": {"name": "黄油可颂", "description": "酥脆金黄，用真正的黄油制作。"}}'),
  ('00000000-0000-0000-0000-00000000c203', 'chocolate-croissant', 'Chocolate Croissant',
   'Our butter croissant with dark chocolate tucked inside.', 'pastry', 425, 12,
   '{"es": {"name": "Croissant de Chocolate", "description": "Nuestro croissant de mantequilla con chocolate oscuro por dentro."},
     "zh": {"name": "巧克力可颂", "description": "黄油可颂里包着黑巧克力。"}}'),
  ('00000000-0000-0000-0000-00000000c204', 'blueberry-muffin', 'Blueberry Muffin',
   'Bursting with blueberries, with a sugar-crackle top.', 'pastry', 375, 13,
   '{"es": {"name": "Magdalena de Arándanos", "description": "Llena de arándanos, con cubierta crujiente de azúcar."},
     "zh": {"name": "蓝莓玛芬", "description": "满满的蓝莓，顶部是酥脆的糖粒。"}}'),
  ('00000000-0000-0000-0000-00000000c205', 'lemon-cream-scone', 'Lemon Cream Scone',
   'Tender cream scone with lemon zest and a light glaze.', 'pastry', 375, 14,
   '{"es": {"name": "Scone de Limón", "description": "Scone tierno de nata con ralladura de limón y un glaseado ligero."},
     "zh": {"name": "柠檬奶油司康", "description": "加入柠檬皮的松软奶油司康，薄薄一层糖霜。"}}'),
  ('00000000-0000-0000-0000-00000000c206', 'apple-turnover', 'Apple Turnover',
   'Puff pastry folded around cinnamon apples.', 'pastry', 425, 15,
   '{"es": {"name": "Empanada de Manzana", "description": "Hojaldre relleno de manzanas con canela."},
     "zh": {"name": "苹果酥角", "description": "酥皮包裹肉桂苹果馅。"}}'),

  -- Breads
  ('00000000-0000-0000-0000-00000000c301', 'sourdough-loaf', 'Country Sourdough Loaf',
   'Slow-fermented for two days. Crackly crust, chewy middle.', 'bread', 900, 20,
   '{"es": {"name": "Pan de Masa Madre", "description": "Fermentado lentamente durante dos días. Corteza crujiente, miga suave."},
     "zh": {"name": "乡村酸种面包", "description": "慢发酵两天，外皮酥脆，内里有嚼劲。"}}'),
  ('00000000-0000-0000-0000-00000000c302', 'honey-oat-loaf', 'Honey Oat Loaf',
   'Soft sandwich bread with rolled oats and honey.', 'bread', 850, 21,
   '{"es": {"name": "Pan de Avena y Miel", "description": "Pan de molde suave con avena y miel."},
     "zh": {"name": "蜂蜜燕麦面包", "description": "加入燕麦和蜂蜜的松软吐司。"}}'),
  ('00000000-0000-0000-0000-00000000c303', 'banana-walnut-bread', 'Banana Walnut Bread',
   'A thick slice of Grandma''s banana bread with toasted walnuts.', 'bread', 400, 22,
   '{"es": {"name": "Pan de Plátano y Nuez", "description": "Una rebanada gruesa del pan de plátano de la abuela con nueces tostadas."},
     "zh": {"name": "香蕉核桃面包", "description": "厚切一片奶奶的香蕉面包，加烤核桃。"}}'),
  ('00000000-0000-0000-0000-00000000c304', 'pumpkin-spice-loaf', 'Pumpkin Spice Loaf',
   'A slice of moist pumpkin bread with cinnamon.', 'bread', 400, 23,
   '{"es": {"name": "Pan de Calabaza Especiada", "description": "Una rebanada de pan de calabaza jugoso con canela."},
     "zh": {"name": "南瓜香料面包", "description": "一片湿润的南瓜面包，带肉桂香。"}}'),

  -- Cookies & bars
  ('00000000-0000-0000-0000-00000000c401', 'chocolate-chip-cookie', 'Chocolate Chip Cookie',
   'Crispy edges, gooey middle, lots of chocolate.', 'cookie', 275, 30,
   '{"es": {"name": "Galleta con Chispas de Chocolate", "description": "Bordes crujientes, centro suave y mucho chocolate."},
     "zh": {"name": "巧克力豆曲奇", "description": "边缘酥脆，中间软糯，满满巧克力。"}}'),
  ('00000000-0000-0000-0000-00000000c402', 'oatmeal-cookie', 'Oatmeal Cookie',
   'Chewy oats, warm cinnamon, brown-sugar sweet.', 'cookie', 250, 31,
   '{"es": {"name": "Galleta de Avena", "description": "Avena masticable, canela y el dulzor del azúcar morena."},
     "zh": {"name": "燕麦曲奇", "description": "有嚼劲的燕麦、温暖的肉桂和红糖的甜。"}}'),
  ('00000000-0000-0000-0000-00000000c403', 'snickerdoodle', 'Snickerdoodle',
   'Soft sugar cookie rolled in cinnamon sugar.', 'cookie', 250, 32,
   '{"es": {"name": "Galleta Snickerdoodle", "description": "Galleta suave de azúcar, cubierta de azúcar con canela."},
     "zh": {"name": "肉桂糖曲奇", "description": "裹满肉桂糖的软曲奇。"}}'),
  ('00000000-0000-0000-0000-00000000c404', 'fudge-brownie', 'Fudge Brownie',
   'Dense, fudgy and extra chocolatey.', 'cookie', 375, 33,
   '{"es": {"name": "Brownie de Chocolate", "description": "Denso, húmedo y extra chocolatoso."},
     "zh": {"name": "软心布朗尼", "description": "浓郁扎实，巧克力味十足。"}}'),
  ('00000000-0000-0000-0000-00000000c405', 'lemon-bar', 'Lemon Bar',
   'Tangy lemon curd on a buttery shortbread base.', 'cookie', 350, 34,
   '{"es": {"name": "Barra de Limón", "description": "Crema ácida de limón sobre una base de galleta de mantequilla."},
     "zh": {"name": "柠檬方块", "description": "酸甜柠檬凝乳铺在黄油酥饼底上。"}}'),
  ('00000000-0000-0000-0000-00000000c406', 'honey-oat-bar', 'Honey Oat Bar',
   'No-bake oats, honey, walnuts and chocolate chips.', 'cookie', 325, 35,
   '{"es": {"name": "Barra de Avena y Miel", "description": "Avena sin hornear con miel, nueces y chispas de chocolate."},
     "zh": {"name": "蜂蜜燕麦棒", "description": "免烤燕麦棒，加蜂蜜、核桃和巧克力豆。"}}'),

  -- Cakes & pies
  ('00000000-0000-0000-0000-00000000c501', 'apple-pie-slice', 'Apple Pie Slice',
   'Flaky lattice crust over cinnamon apples.', 'cake', 525, 40,
   '{"es": {"name": "Rebanada de Pay de Manzana", "description": "Corteza hojaldrada en celosía sobre manzanas con canela."},
     "zh": {"name": "苹果派（切片）", "description": "格子酥皮下是肉桂苹果。"}}'),
  ('00000000-0000-0000-0000-00000000c502', 'pumpkin-pie-slice', 'Pumpkin Pie Slice',
   'Silky spiced pumpkin with a dollop of whipped cream.', 'cake', 525, 41,
   '{"es": {"name": "Rebanada de Pay de Calabaza", "description": "Calabaza especiada y cremosa con un poco de crema batida."},
     "zh": {"name": "南瓜派（切片）", "description": "丝滑的香料南瓜派，配一勺鲜奶油。"}}'),
  ('00000000-0000-0000-0000-00000000c503', 'carrot-cake-slice', 'Carrot Cake Slice',
   'Spiced carrot cake with walnuts and cream cheese frosting.', 'cake', 600, 42,
   '{"es": {"name": "Rebanada de Pastel de Zanahoria", "description": "Pastel de zanahoria especiado con nueces y betún de queso crema."},
     "zh": {"name": "胡萝卜蛋糕（切片）", "description": "香料胡萝卜蛋糕，配核桃和奶油奶酪霜。"}}'),
  ('00000000-0000-0000-0000-00000000c504', 'strawberry-shortcake', 'Strawberry Shortcake',
   'Buttery biscuit, fresh strawberries and whipped cream.', 'cake', 650, 43,
   '{"es": {"name": "Tarta de Fresas con Crema", "description": "Bizcocho de mantequilla, fresas frescas y crema batida."},
     "zh": {"name": "草莓奶油酥饼", "description": "黄油酥饼、新鲜草莓和鲜奶油。"}}'),
  ('00000000-0000-0000-0000-00000000c505', 'whole-apple-pie', 'Whole Apple Pie',
   'Serves 8. Please order a day ahead if you can.', 'cake', 2800, 44,
   '{"es": {"name": "Pay de Manzana Entero", "description": "Para 8 personas. Si puedes, pídelo con un día de anticipación."},
     "zh": {"name": "整个苹果派", "description": "8人份。请尽量提前一天预订。"}}'),

  -- Drinks
  ('00000000-0000-0000-0000-00000000c601', 'drip-coffee', 'Drip Coffee',
   'Fresh-brewed house blend. Free refills while you''re here.', 'drink', 300, 50,
   '{"es": {"name": "Café de Filtro", "description": "Mezcla de la casa recién hecha. Rellenos gratis mientras estés aquí."},
     "zh": {"name": "滴滤咖啡", "description": "现煮招牌拼配，店内免费续杯。"}}'),
  ('00000000-0000-0000-0000-00000000c602', 'latte', 'Latte',
   'Espresso with steamed whole milk.', 'drink', 475, 51,
   '{"es": {"name": "Café con Leche", "description": "Espresso con leche entera vaporizada."},
     "zh": {"name": "拿铁", "description": "浓缩咖啡加蒸全脂牛奶。"}}'),
  ('00000000-0000-0000-0000-00000000c603', 'hot-chocolate', 'Hot Chocolate',
   'Real cocoa and steamed milk, topped with whipped cream.', 'drink', 425, 52,
   '{"es": {"name": "Chocolate Caliente", "description": "Cacao de verdad y leche vaporizada, con crema batida."},
     "zh": {"name": "热巧克力", "description": "真可可加蒸牛奶，顶上一层鲜奶油。"}}'),
  ('00000000-0000-0000-0000-00000000c604', 'english-breakfast-tea', 'English Breakfast Tea',
   'A pot-for-one of strong black tea.', 'drink', 275, 53,
   '{"es": {"name": "Té English Breakfast", "description": "Una tetera individual de té negro fuerte."},
     "zh": {"name": "英式早餐茶", "description": "一人份的浓郁红茶。"}}'),
  ('00000000-0000-0000-0000-00000000c605', 'fresh-lemonade', 'Fresh Lemonade',
   'Squeezed to order, just sweet enough.', 'drink', 400, 54,
   '{"es": {"name": "Limonada Fresca", "description": "Exprimida al momento, con el dulzor justo."},
     "zh": {"name": "鲜榨柠檬水", "description": "现点现榨，甜度刚好。"}}')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Recipes (per 1 item, in each ingredient's unit). Matched by slug and ingredient name.
-- ─────────────────────────────────────────────────────────────
insert into recipe_items (product_id, ingredient_id, quantity)
select p.id, i.id, r.qty
  from (values
    ('triple-berry-parfait', 'Greek yogurt', 150), ('triple-berry-parfait', 'Heavy cream', 50),
    ('triple-berry-parfait', 'Strawberries', 50), ('triple-berry-parfait', 'Blueberries', 40),
    ('triple-berry-parfait', 'Granola', 40), ('triple-berry-parfait', 'Parfait cups', 1),

    ('mango-sunrise-parfait', 'Greek yogurt', 150), ('mango-sunrise-parfait', 'Mango', 90),
    ('mango-sunrise-parfait', 'Honey', 10), ('mango-sunrise-parfait', 'Granola', 40),
    ('mango-sunrise-parfait', 'Parfait cups', 1),

    ('chocolate-banana-parfait', 'Greek yogurt', 130), ('chocolate-banana-parfait', 'Heavy cream', 60),
    ('chocolate-banana-parfait', 'Bananas', 0.5), ('chocolate-banana-parfait', 'Cocoa powder', 8),
    ('chocolate-banana-parfait', 'Chocolate chips', 15), ('chocolate-banana-parfait', 'Parfait cups', 1),

    ('lemon-blueberry-parfait', 'Greek yogurt', 140), ('lemon-blueberry-parfait', 'Heavy cream', 50),
    ('lemon-blueberry-parfait', 'Blueberries', 60), ('lemon-blueberry-parfait', 'Lemons', 0.25),
    ('lemon-blueberry-parfait', 'Granola', 40), ('lemon-blueberry-parfait', 'Parfait cups', 1),

    ('mini-parfait', 'Greek yogurt', 80), ('mini-parfait', 'Strawberries', 40),
    ('mini-parfait', 'Granola', 20), ('mini-parfait', 'Parfait cups', 1),

    ('cinnamon-roll', 'All-purpose flour', 90), ('cinnamon-roll', 'Butter', 30), ('cinnamon-roll', 'Sugar', 25),
    ('cinnamon-roll', 'Cinnamon', 3), ('cinnamon-roll', 'Eggs', 0.25), ('cinnamon-roll', 'Whole milk', 40),
    ('cinnamon-roll', 'Cream cheese', 15), ('cinnamon-roll', 'Pastry bags', 1),

    ('butter-croissant', 'All-purpose flour', 70), ('butter-croissant', 'Butter', 45),
    ('butter-croissant', 'Whole milk', 20), ('butter-croissant', 'Sugar', 8),
    ('butter-croissant', 'Eggs', 0.1), ('butter-croissant', 'Pastry bags', 1),

    ('chocolate-croissant', 'All-purpose flour', 70), ('chocolate-croissant', 'Butter', 45),
    ('chocolate-croissant', 'Chocolate chips', 20), ('chocolate-croissant', 'Whole milk', 20),
    ('chocolate-croissant', 'Sugar', 8), ('chocolate-croissant', 'Eggs', 0.1),
    ('chocolate-croissant', 'Pastry bags', 1),

    ('blueberry-muffin', 'All-purpose flour', 70), ('blueberry-muffin', 'Butter', 20),
    ('blueberry-muffin', 'Sugar', 30), ('blueberry-muffin', 'Eggs', 0.5),
    ('blueberry-muffin', 'Whole milk', 30), ('blueberry-muffin', 'Blueberries', 35),
    ('blueberry-muffin', 'Pastry bags', 1),

    ('lemon-cream-scone', 'All-purpose flour', 80), ('lemon-cream-scone', 'Butter', 30),
    ('lemon-cream-scone', 'Sugar', 20), ('lemon-cream-scone', 'Heavy cream', 30),
    ('lemon-cream-scone', 'Lemons', 0.25), ('lemon-cream-scone', 'Eggs', 0.25),
    ('lemon-cream-scone', 'Pastry bags', 1),

    ('apple-turnover', 'All-purpose flour', 60), ('apple-turnover', 'Butter', 35),
    ('apple-turnover', 'Apples', 0.5), ('apple-turnover', 'Sugar', 15),
    ('apple-turnover', 'Cinnamon', 1), ('apple-turnover', 'Pastry bags', 1),

    ('sourdough-loaf', 'All-purpose flour', 500), ('sourdough-loaf', 'Pastry bags', 1),

    ('honey-oat-loaf', 'All-purpose flour', 400), ('honey-oat-loaf', 'Rolled oats', 60),
    ('honey-oat-loaf', 'Honey', 40), ('honey-oat-loaf', 'Whole milk', 120),
    ('honey-oat-loaf', 'Butter', 20), ('honey-oat-loaf', 'Pastry bags', 1),

    ('banana-walnut-bread', 'All-purpose flour', 50), ('banana-walnut-bread', 'Bananas', 0.5),
    ('banana-walnut-bread', 'Butter', 15), ('banana-walnut-bread', 'Sugar', 20),
    ('banana-walnut-bread', 'Eggs', 0.25), ('banana-walnut-bread', 'Walnuts', 10),
    ('banana-walnut-bread', 'Pastry bags', 1),

    ('pumpkin-spice-loaf', 'All-purpose flour', 50), ('pumpkin-spice-loaf', 'Pumpkin purée', 50),
    ('pumpkin-spice-loaf', 'Sugar', 20), ('pumpkin-spice-loaf', 'Butter', 15),
    ('pumpkin-spice-loaf', 'Eggs', 0.25), ('pumpkin-spice-loaf', 'Cinnamon', 1),
    ('pumpkin-spice-loaf', 'Pastry bags', 1),

    ('chocolate-chip-cookie', 'All-purpose flour', 35), ('chocolate-chip-cookie', 'Butter', 20),
    ('chocolate-chip-cookie', 'Sugar', 20), ('chocolate-chip-cookie', 'Chocolate chips', 20),
    ('chocolate-chip-cookie', 'Eggs', 0.15), ('chocolate-chip-cookie', 'Pastry bags', 1),

    ('oatmeal-cookie', 'Rolled oats', 30), ('oatmeal-cookie', 'All-purpose flour', 20),
    ('oatmeal-cookie', 'Butter', 18), ('oatmeal-cookie', 'Sugar', 18),
    ('oatmeal-cookie', 'Cinnamon', 0.5), ('oatmeal-cookie', 'Eggs', 0.15),
    ('oatmeal-cookie', 'Pastry bags', 1),

    ('snickerdoodle', 'All-purpose flour', 35), ('snickerdoodle', 'Butter', 20),
    ('snickerdoodle', 'Sugar', 22), ('snickerdoodle', 'Cinnamon', 1),
    ('snickerdoodle', 'Eggs', 0.15), ('snickerdoodle', 'Pastry bags', 1),

    ('fudge-brownie', 'All-purpose flour', 25), ('fudge-brownie', 'Butter', 30),
    ('fudge-brownie', 'Sugar', 35), ('fudge-brownie', 'Cocoa powder', 15),
    ('fudge-brownie', 'Chocolate chips', 15), ('fudge-brownie', 'Eggs', 0.4),
    ('fudge-brownie', 'Pastry bags', 1),

    ('lemon-bar', 'All-purpose flour', 25), ('lemon-bar', 'Butter', 20), ('lemon-bar', 'Sugar', 30),
    ('lemon-bar', 'Eggs', 0.4), ('lemon-bar', 'Lemons', 0.3), ('lemon-bar', 'Pastry bags', 1),

    ('honey-oat-bar', 'Rolled oats', 40), ('honey-oat-bar', 'Honey', 20),
    ('honey-oat-bar', 'Walnuts', 10), ('honey-oat-bar', 'Chocolate chips', 10),
    ('honey-oat-bar', 'Pastry bags', 1),

    ('apple-pie-slice', 'All-purpose flour', 40), ('apple-pie-slice', 'Butter', 25),
    ('apple-pie-slice', 'Apples', 1), ('apple-pie-slice', 'Sugar', 20),
    ('apple-pie-slice', 'Cinnamon', 1), ('apple-pie-slice', 'Cake boxes', 1),

    ('pumpkin-pie-slice', 'All-purpose flour', 40), ('pumpkin-pie-slice', 'Butter', 25),
    ('pumpkin-pie-slice', 'Pumpkin purée', 100), ('pumpkin-pie-slice', 'Sugar', 20),
    ('pumpkin-pie-slice', 'Heavy cream', 30), ('pumpkin-pie-slice', 'Eggs', 0.3),
    ('pumpkin-pie-slice', 'Cinnamon', 1), ('pumpkin-pie-slice', 'Cake boxes', 1),

    ('carrot-cake-slice', 'All-purpose flour', 50), ('carrot-cake-slice', 'Carrots', 60),
    ('carrot-cake-slice', 'Sugar', 35), ('carrot-cake-slice', 'Eggs', 0.5),
    ('carrot-cake-slice', 'Cream cheese', 40), ('carrot-cake-slice', 'Butter', 15),
    ('carrot-cake-slice', 'Walnuts', 10), ('carrot-cake-slice', 'Cinnamon', 1),
    ('carrot-cake-slice', 'Cake boxes', 1),

    ('strawberry-shortcake', 'All-purpose flour', 45), ('strawberry-shortcake', 'Butter', 20),
    ('strawberry-shortcake', 'Sugar', 20), ('strawberry-shortcake', 'Heavy cream', 80),
    ('strawberry-shortcake', 'Strawberries', 80), ('strawberry-shortcake', 'Eggs', 0.25),
    ('strawberry-shortcake', 'Cake boxes', 1),

    ('whole-apple-pie', 'All-purpose flour', 300), ('whole-apple-pie', 'Butter', 180),
    ('whole-apple-pie', 'Apples', 7), ('whole-apple-pie', 'Sugar', 150),
    ('whole-apple-pie', 'Cinnamon', 6), ('whole-apple-pie', 'Cake boxes', 1),

    ('drip-coffee', 'Coffee beans', 18), ('drip-coffee', 'Hot cups', 1),

    ('latte', 'Coffee beans', 18), ('latte', 'Whole milk', 240), ('latte', 'Hot cups', 1),

    ('hot-chocolate', 'Whole milk', 240), ('hot-chocolate', 'Cocoa powder', 20),
    ('hot-chocolate', 'Sugar', 15), ('hot-chocolate', 'Heavy cream', 20), ('hot-chocolate', 'Hot cups', 1),

    ('english-breakfast-tea', 'Black tea bags', 1), ('english-breakfast-tea', 'Hot cups', 1),

    ('fresh-lemonade', 'Lemons', 1), ('fresh-lemonade', 'Sugar', 30), ('fresh-lemonade', 'Cold cups', 1)
  ) as r(slug, ingredient, qty)
  join products p on p.slug = r.slug
  join ingredients i on i.name = r.ingredient
on conflict do nothing;
