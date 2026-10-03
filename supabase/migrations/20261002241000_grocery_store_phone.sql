-- Canadian grocery line (647 is a Toronto area code). +1 is the country code for Canada.
insert into suppliers (name, phone, is_local, notes)
select 'Grocery store', '+16479662880', false, 'Canadian number. Called when reclaiming low stock.'
where not exists (
  select 1 from suppliers
  where regexp_replace(coalesce(phone, ''), '\D', '', 'g') in ('6479662880', '16479662880')
);
