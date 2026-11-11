-- Facet counts for /creators (makersmarkt). Each facet counts over the
-- listings that match every other active filter. 'type' feeds the tabs.
create or replace function public.maker_market_facets(
  p_type text default null,
  p_domain uuid default null,
  p_category uuid default null,
  p_seller uuid default null,
  p_price_min integer default null,
  p_price_max integer default null,
  p_condition text default null,
  p_featured boolean default false,
  p_q text default null
)
returns table (facet text, value text, label text, sort integer, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with f as (
    select p.product_type, p.domain_id, p.category_id, p.creator_id, p.price_cents,
      p.condition_type, p.is_featured,
      (p_type is null or p.product_type = p_type) as m_type,
      (p_domain is null or p.domain_id = p_domain) as m_domain,
      (p_category is null or p.category_id = p_category) as m_category,
      (p_seller is null or p.creator_id = p_seller) as m_seller,
      ((p_price_min is null or p.price_cents >= p_price_min) and (p_price_max is null or p.price_cents < p_price_max)) as m_price,
      (p_condition is null or p.condition_type = p_condition) as m_condition,
      (not p_featured or p.is_featured) as m_featured
    from products p
    where p.is_active and p.status = 'active'
      and p.product_type in ('handmade', 'destash')
      and (p_q is null or p.title ilike '%' || p_q || '%' or p.short_description ilike '%' || p_q || '%')
  )
  select 'type', product_type, null, null, count(*) from f
  where m_domain and m_category and m_seller and m_price and m_condition and m_featured
  group by product_type
  union all
  select 'domain', d.id::text, d.name, d.sort_order, count(*)
  from f join domains d on d.id = f.domain_id
  where m_type and m_seller and m_price and m_condition and m_featured
  group by d.id, d.name, d.sort_order
  union all
  select 'category', c.id::text, c.name, c.sort_order, count(*)
  from f join product_categories c on c.id = f.category_id and c.catalog = 'listing'
  where m_type and m_domain and m_seller and m_price and m_condition and m_featured
  group by c.id, c.name, c.sort_order
  union all
  select 'seller', cr.id::text, cr.display_name, null, count(*)
  from f join creators cr on cr.id = f.creator_id
  where m_type and m_domain and m_category and m_price and m_condition and m_featured
  group by cr.id, cr.display_name
  union all
  select 'price', band, null, null, count(*) from (
    select case
      when price_cents >= 1 and price_cents < 1500 then 'under_15'
      when price_cents >= 1500 and price_cents < 3000 then '15_30'
      when price_cents >= 3000 and price_cents < 5000 then '30_50'
      when price_cents >= 5000 then '50_plus'
    end as band
    from f where m_type and m_domain and m_category and m_seller and m_condition and m_featured
  ) b where band is not null group by band
  union all
  select 'condition', condition_type, null, null, count(*) from f
  where condition_type is not null and m_type and m_domain and m_category and m_seller and m_price and m_featured
  group by condition_type
  union all
  select 'featured', 'true', null, null, count(*) from f
  where is_featured and m_type and m_domain and m_category and m_seller and m_price and m_condition
$$;

grant execute on function public.maker_market_facets(text, uuid, uuid, uuid, integer, integer, text, boolean, text) to anon, authenticated;
