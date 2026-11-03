-- Material taxonomy for /materials, independent of hobby (like a craft
-- store). Hobby stays a separate filter. The old per-hobby categories stay
-- for maker listings (catalog = 'listing').

alter table public.product_categories
  add column if not exists catalog text not null default 'listing'
  check (catalog in ('listing', 'material'));

create unique index if not exists product_categories_material_slug_key
  on public.product_categories (slug) where catalog = 'material';

-- Groups and subcategories. domain_id stays null: materials serve many hobbies.
with groups (slug, name, sort_order) as (
  values
    ('garen-en-wol', 'Garen & wol', 10),
    ('stof-en-naaien', 'Stof & naaien', 20),
    ('papier-en-kaarten', 'Papier & kaarten', 30),
    ('tekenen-en-schilderen', 'Tekenen & schilderen', 40),
    ('klei-en-keramiek', 'Klei & keramiek', 50),
    ('kralen-en-sieraden', 'Kralen & sieraden', 60),
    ('gieten-en-resin', 'Gieten & resin', 70),
    ('kaarsen-en-zeep', 'Kaarsen & zeep', 80),
    ('hout-en-decoratie', 'Hout & decoratie', 90),
    ('basismaterialen', 'Basismaterialen', 100),
    ('patronen-en-pakketten', 'Patronen & pakketten', 110)
)
insert into public.product_categories (slug, name, sort_order, catalog)
select slug, name, sort_order, 'material' from groups
on conflict do nothing;

with subs (parent_slug, slug, name, sort_order) as (
  values
    ('garen-en-wol', 'wol', 'Wol', 10),
    ('garen-en-wol', 'katoen', 'Katoen', 20),
    ('garen-en-wol', 'acryl-en-mix', 'Acryl & mix', 30),
    ('garen-en-wol', 'haaknaalden', 'Haaknaalden', 40),
    ('garen-en-wol', 'breinaalden', 'Breinaalden', 50),
    ('stof-en-naaien', 'stoffen', 'Stoffen', 10),
    ('stof-en-naaien', 'fournituren', 'Fournituren', 20),
    ('stof-en-naaien', 'naaigaren', 'Naaigaren', 30),
    ('stof-en-naaien', 'borduren', 'Borduren', 40),
    ('papier-en-kaarten', 'papier-en-karton', 'Papier & karton', 10),
    ('papier-en-kaarten', 'stempels-en-inkt', 'Stempels & inkt', 20),
    ('papier-en-kaarten', 'stansen', 'Stansen', 30),
    ('papier-en-kaarten', 'scrapbook-en-journaling', 'Scrapbook & journaling', 40),
    ('tekenen-en-schilderen', 'verf', 'Verf', 10),
    ('tekenen-en-schilderen', 'penselen', 'Penselen', 20),
    ('tekenen-en-schilderen', 'doeken-en-ondergronden', 'Doeken & ondergronden', 30),
    ('tekenen-en-schilderen', 'tekenmateriaal', 'Tekenmateriaal', 40),
    ('klei-en-keramiek', 'klei-materiaal', 'Klei', 10),
    ('klei-en-keramiek', 'glazuur', 'Glazuur', 20),
    ('klei-en-keramiek', 'boetseergereedschap', 'Boetseergereedschap', 30),
    ('klei-en-keramiek', 'polymeerklei', 'Polymeerklei', 40),
    ('kralen-en-sieraden', 'kralen-materiaal', 'Kralen', 10),
    ('kralen-en-sieraden', 'sieraadonderdelen', 'Sieraadonderdelen', 20),
    ('kralen-en-sieraden', 'draad-en-koord', 'Draad & koord', 30),
    ('kralen-en-sieraden', 'tangen', 'Tangen', 40),
    ('gieten-en-resin', 'epoxy-en-resin', 'Epoxy & resin', 10),
    ('gieten-en-resin', 'gietvormen', 'Gietvormen', 20),
    ('gieten-en-resin', 'pigmenten', 'Pigmenten', 30),
    ('kaarsen-en-zeep', 'kaarsenwas', 'Kaarsenwas', 10),
    ('kaarsen-en-zeep', 'lonten', 'Lonten', 20),
    ('kaarsen-en-zeep', 'zeepbasis', 'Zeepbasis', 30),
    ('kaarsen-en-zeep', 'geuren-en-kleuren', 'Geuren & kleuren', 40),
    ('hout-en-decoratie', 'hout', 'Hout', 10),
    ('hout-en-decoratie', 'decoratiemateriaal', 'Decoratiemateriaal', 20),
    ('basismaterialen', 'lijm-en-tape', 'Lijm & tape', 10),
    ('basismaterialen', 'scharen-en-snijden', 'Scharen & snijden', 20),
    ('basismaterialen', 'opbergen', 'Opbergen', 30),
    ('patronen-en-pakketten', 'startpakketten', 'Startpakketten', 10),
    ('patronen-en-pakketten', 'patronen', 'Patronen', 20)
)
insert into public.product_categories (slug, name, sort_order, catalog, parent_id)
select s.slug, s.name, s.sort_order, 'material', g.id
from subs s join public.product_categories g on g.slug = s.parent_slug and g.catalog = 'material'
on conflict do nothing;

-- Backup before reassigning the existing materials.
create table if not exists public.backup_20261103_supply_category as
  select id as product_id, category_id from public.products where product_type in ('supply', 'supplies');
alter table public.backup_20261103_supply_category enable row level security;

with map (product_id, sub_slug) as (
  values
    ('9a12d53f-d5d4-428f-8a43-82e2acf222ac'::uuid, 'verf'),
    ('44444444-4444-4444-4444-444444444425'::uuid, 'verf'),
    ('44444444-4444-4444-4444-444444444404'::uuid, 'patronen'),
    ('44444444-4444-4444-4444-44444444441f'::uuid, 'patronen'),
    ('44444444-4444-4444-4444-444444444416'::uuid, 'patronen'),
    ('44444444-4444-4444-4444-444444444412'::uuid, 'patronen'),
    ('44444444-4444-4444-4444-444444444419'::uuid, 'patronen'),
    ('44444444-4444-4444-4444-444444444406'::uuid, 'kralen-materiaal'),
    ('44444444-4444-4444-4444-44444444441a'::uuid, 'kralen-materiaal'),
    ('a98976fe-6566-47ff-b8fa-a2eb22885878'::uuid, 'decoratiemateriaal'),
    ('53e6b45d-1e67-4434-8eaf-17e22426c051'::uuid, 'scrapbook-en-journaling'),
    ('44444444-4444-4444-4444-44444444441b'::uuid, 'scrapbook-en-journaling'),
    ('44444444-4444-4444-4444-444444444410'::uuid, 'scrapbook-en-journaling'),
    ('f6a6f284-e710-4211-a5f4-6c9298b98315'::uuid, 'papier-en-karton'),
    ('44444444-4444-4444-4444-444444444426'::uuid, 'stempels-en-inkt'),
    ('44444444-4444-4444-4444-444444444402'::uuid, 'wol'),
    ('44444444-4444-4444-4444-444444444428'::uuid, 'wol'),
    ('44444444-4444-4444-4444-444444444413'::uuid, 'wol'),
    ('44444444-4444-4444-4444-44444444440c'::uuid, 'startpakketten'),
    ('44444444-4444-4444-4444-444444444421'::uuid, 'klei-materiaal'),
    ('44444444-4444-4444-4444-444444444415'::uuid, 'klei-materiaal'),
    ('44444444-4444-4444-4444-44444444441d'::uuid, 'hout'),
    ('44444444-4444-4444-4444-444444444411'::uuid, 'fournituren'),
    ('44444444-4444-4444-4444-444444444423'::uuid, 'stoffen'),
    ('44444444-4444-4444-4444-444444444408'::uuid, 'stoffen')
)
update public.products p set category_id = c.id
from map m join public.product_categories c on c.slug = m.sub_slug and c.catalog = 'material'
where p.id = m.product_id and p.product_type in ('supply', 'supplies');

-- Facet counts for /materials. Each facet counts over the products that
-- match every other active filter. Groups count their subcategories.
create or replace function public.materials_facets(
  p_types text[],
  p_group uuid default null,
  p_sub uuid default null,
  p_domain uuid default null,
  p_seller uuid default null,
  p_price_min integer default null,
  p_price_max integer default null,
  p_featured boolean default false,
  p_q text default null
)
returns table (facet text, value text, label text, sort integer, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select p.id, p.domain_id, p.creator_id, p.price_cents, p.is_featured,
      c.id as sub_id, coalesce(c.parent_id, c.id) as group_id
    from products p
    left join product_categories c on c.id = p.category_id and c.catalog = 'material'
    where p.is_active and p.status = 'active'
      and p.product_type = any (p_types)
      and (p_q is null or p.title ilike '%' || p_q || '%' or p.short_description ilike '%' || p_q || '%')
  ),
  f as (
    select *,
      (p_group is null or group_id = p_group) as m_group,
      (p_sub is null or sub_id = p_sub) as m_sub,
      (p_domain is null or domain_id = p_domain) as m_domain,
      (p_seller is null or creator_id = p_seller) as m_seller,
      ((p_price_min is null or price_cents >= p_price_min) and (p_price_max is null or price_cents < p_price_max)) as m_price,
      (not p_featured or is_featured) as m_featured
    from base
  )
  select 'group', g.id::text, g.name, g.sort_order, count(*)
  from f join product_categories g on g.id = f.group_id
  where m_domain and m_seller and m_price and m_featured
  group by g.id, g.name, g.sort_order
  union all
  select 'sub', s.id::text, s.name, s.sort_order, count(*)
  from f join product_categories s on s.id = f.sub_id and s.parent_id is not null
  where m_group and m_domain and m_seller and m_price and m_featured
  group by s.id, s.name, s.sort_order
  union all
  select 'domain', d.id::text, d.name, d.sort_order, count(*)
  from f join domains d on d.id = f.domain_id
  where m_group and m_sub and m_seller and m_price and m_featured
  group by d.id, d.name, d.sort_order
  union all
  select 'seller', cr.id::text, cr.display_name, null, count(*)
  from f join creators cr on cr.id = f.creator_id
  where m_group and m_sub and m_domain and m_price and m_featured
  group by cr.id, cr.display_name
  union all
  select 'price', band, null, null, count(*) from (
    select case
      when price_cents >= 1 and price_cents < 1500 then 'under_15'
      when price_cents >= 1500 and price_cents < 3000 then '15_30'
      when price_cents >= 3000 and price_cents < 5000 then '30_50'
      when price_cents >= 5000 then '50_plus'
    end as band
    from f where m_group and m_sub and m_domain and m_seller and m_featured
  ) b where band is not null group by band
  union all
  select 'featured', 'true', null, null, count(*) from f
  where is_featured and m_group and m_sub and m_domain and m_seller and m_price
$$;

grant execute on function public.materials_facets(text[], uuid, uuid, uuid, uuid, integer, integer, boolean, text) to anon, authenticated;
