-- Facet counts for /artikelen and /patronen. Each facet is counted over
-- the rows that match every other active filter, so a count never leads
-- to an empty result. Hobby uses article_hobby_slugs.
-- Which crafts (from the metadata sidecar) belong to a hobby domain. An
-- article counts for a hobby when it carries the domain tag and, if it has
-- crafts metadata, at least one craft fits. Many articles carry a wrong
-- domain tag (for example 97 crochet articles tagged scrapbooking). A
-- domain without rows here (diy) accepts every tagged article.
create table if not exists public.domain_crafts (
  domain_slug text not null references public.domains (slug) on delete cascade,
  craft text not null,
  primary key (domain_slug, craft)
);
alter table public.domain_crafts enable row level security;
drop policy if exists domain_crafts_read on public.domain_crafts;
create policy domain_crafts_read on public.domain_crafts for select to anon, authenticated using (true);

insert into public.domain_crafts (domain_slug, craft) values
  ('crochet','haken'),
  ('knitting','breien'),
  ('card-making','kaarten maken'),('card-making','papierknutselen'),('card-making','papierbewerking'),('card-making','stempelen'),('card-making','origami'),
  ('sewing','naaien'),('sewing','quilten'),('sewing','patchwork'),
  ('jewelry-making','sieraden maken'),('jewelry-making','kralen rijgen'),('jewelry-making','kralenweven'),('jewelry-making','kralenwerk'),('jewelry-making','kralenborduren'),
  ('scrapbooking','scrapbooking'),('scrapbooking','papierknutselen'),('scrapbooking','stempelen'),('scrapbooking','journaling'),
  ('pottery','boetseren'),('pottery','kleien'),('pottery','keramiek'),('pottery','pottenbakken'),('pottery','boetseren met klei'),
  ('felting','vilten'),('felting','droogvilten'),('felting','viltwerk'),('felting','naaldvilten'),('felting','natvilten'),
  ('leathercraft','leerbewerking'),
  ('polymer-clay','polymeerklei'),
  ('lettering','handlettering'),('lettering','kalligrafie'),('lettering','lettering'),
  ('glass-art','glas schilderen'),('glass-art','glas in lood (tiffany-techniek)'),('glass-art','glasfusie')
on conflict do nothing;

-- Active hobby slugs of one article under the rule above.
create or replace function public.article_hobby_slugs(p_domain_id uuid, p_article_id uuid, p_crafts text[])
returns text[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(array_agg(d.slug order by d.sort_order), '{}')
  from domains d
  where d.is_active
    and (d.id = p_domain_id
      or d.id in (select ad.domain_id from article_domains ad where ad.article_id = p_article_id))
    and (
      cardinality(coalesce(p_crafts, '{}')) = 0
      or not exists (select 1 from domain_crafts dc where dc.domain_slug = d.slug)
      or exists (select 1 from domain_crafts dc where dc.domain_slug = d.slug and dc.craft = any (p_crafts))
    )
$$;

-- Article ids for one hobby, for the result list.
create or replace function public.article_ids_for_hobby(p_domain text)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select a.id from articles a
  where a.is_published
    and p_domain = any (public.article_hobby_slugs(a.domain_id, a.id, a.crafts))
$$;
grant execute on function public.article_hobby_slugs(uuid, uuid, text[]) to anon, authenticated;
grant execute on function public.article_ids_for_hobby(text) to anon, authenticated;

create or replace function public.article_hub_facets(
  p_patterns boolean,
  p_domain text default null,
  p_niveau text default null,
  p_soort text default null,
  p_type text default null,
  p_techniek text default null,
  p_thema text default null,
  p_voor text default null,
  p_q text default null
)
returns table (facet text, value text, label text, sort integer, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select a.id, a.article_type, a.difficulty_level, a.content_kind,
      a.techniques, a.themes, a.audience,
      public.article_hobby_slugs(a.domain_id, a.id, a.crafts) as doms
    from articles a
    where a.is_published
      and ((a.article_type = 'pattern') = p_patterns)
      and (p_q is null or a.title ilike '%' || p_q || '%' or a.excerpt ilike '%' || p_q || '%')
  ),
  f as (
    select *,
      (p_domain is null or p_domain = any (doms)) as m_domain,
      (p_niveau is null or difficulty_level = p_niveau) as m_niveau,
      (p_soort is null or content_kind = p_soort) as m_soort,
      (p_type is null or article_type = p_type) as m_type,
      (p_techniek is null or p_techniek = any (techniques)) as m_tech,
      (p_thema is null or p_thema = any (themes)) as m_thema,
      (p_voor is null or p_voor = any (audience)) as m_voor
    from base
  )
  select 'domain', d.slug, d.name, d.sort_order, count(*)
  from f cross join lateral unnest(f.doms) as v(slug) join domains d on d.slug = v.slug
  where m_niveau and m_soort and m_type and m_tech and m_thema and m_voor
  group by d.slug, d.name, d.sort_order
  union all
  select 'niveau', difficulty_level, null, null, count(*) from f
  where difficulty_level is not null and m_domain and m_soort and m_type and m_tech and m_thema and m_voor
  group by difficulty_level
  union all
  select 'soort', content_kind, null, null, count(*) from f
  where content_kind is not null and m_domain and m_niveau and m_type and m_tech and m_thema and m_voor
  group by content_kind
  union all
  select 'type', article_type, null, null, count(*) from f
  where m_domain and m_niveau and m_soort and m_tech and m_thema and m_voor
  group by article_type
  union all
  select 'techniek', v, null, null, count(*) from f cross join lateral unnest(f.techniques) v
  where m_domain and m_niveau and m_soort and m_type and m_thema and m_voor
  group by v
  union all
  select 'thema', v, null, null, count(*) from f cross join lateral unnest(f.themes) v
  where m_domain and m_niveau and m_soort and m_type and m_tech and m_voor
  group by v
  union all
  select 'voor', v, null, null, count(*) from f cross join lateral unnest(f.audience) v
  where m_domain and m_niveau and m_soort and m_type and m_tech and m_thema
  group by v
$$;

grant execute on function public.article_hub_facets(boolean, text, text, text, text, text, text, text, text) to anon, authenticated;

-- One page of results with the same rules as article_hub_facets.
create or replace function public.article_hub_page(
  p_patterns boolean,
  p_domain text default null,
  p_niveau text default null,
  p_soort text default null,
  p_type text default null,
  p_techniek text default null,
  p_thema text default null,
  p_voor text default null,
  p_q text default null,
  p_offset integer default 0,
  p_limit integer default 24
)
returns table (article jsonb, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select to_jsonb(a), count(*) over ()
  from articles a
  where a.is_published
    and ((a.article_type = 'pattern') = p_patterns)
    and (p_q is null or a.title ilike '%' || p_q || '%' or a.excerpt ilike '%' || p_q || '%')
    and (p_domain is null or p_domain = any (public.article_hobby_slugs(a.domain_id, a.id, a.crafts)))
    and (p_niveau is null or a.difficulty_level = p_niveau)
    and (p_soort is null or a.content_kind = p_soort)
    and (p_type is null or a.article_type = p_type)
    and (p_techniek is null or p_techniek = any (a.techniques))
    and (p_thema is null or p_thema = any (a.themes))
    and (p_voor is null or p_voor = any (a.audience))
  order by a.is_featured desc, a.published_at desc nulls last, a.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 96)
$$;

grant execute on function public.article_hub_page(boolean, text, text, text, text, text, text, text, text, integer, integer) to anon, authenticated;
