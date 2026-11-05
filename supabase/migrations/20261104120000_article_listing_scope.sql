-- Article visibility by author role.
--   hub     : listed in /artikelen, /patronen, search and other overviews.
--   profile : only on the author's profile and by direct link (Google may index).
-- Workshop hosts (workshopgever), shops (supplier) and the editorial team get
-- 'hub'. Every other creator gets 'profile'. A trigger sets the scope, so a
-- form cannot choose it.

alter table public.creators
  add column if not exists editorial_publisher boolean not null default false;

-- The editorial team publishes from these creator accounts.
update public.creators set editorial_publisher = true
where slug in ('nathalie-hobbysalon', 'peter-hobbysalon', 'hobbysalon-redactie');

alter table public.articles
  add column if not exists listing_scope text not null default 'hub'
    check (listing_scope in ('hub', 'profile')),
  add column if not exists video_url text
    check (video_url is null or video_url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/');

create index if not exists articles_listing_scope_idx
  on public.articles (listing_scope) where is_published;

create or replace function public.article_scope_for_creator(p_creator_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when p_creator_id is null then 'hub'
    when exists (
      select 1 from creators c
      where c.id = p_creator_id
        and (c.editorial_publisher
             or c.creator_types && array['workshopgever', 'supplier']::text[])
    ) then 'hub'
    else 'profile'
  end
$$;

create or replace function public.articles_set_listing_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.listing_scope := public.article_scope_for_creator(new.author_creator_id);
  return new;
end
$$;

drop trigger if exists articles_set_listing_scope on public.articles;
create trigger articles_set_listing_scope
  before insert or update of author_creator_id, listing_scope on public.articles
  for each row execute function public.articles_set_listing_scope();

-- When a creator becomes (or stops being) a workshop host, shop or editor,
-- their articles follow.
create or replace function public.creators_refresh_article_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update articles
  set listing_scope = public.article_scope_for_creator(new.id)
  where author_creator_id = new.id
    and listing_scope is distinct from public.article_scope_for_creator(new.id);
  return new;
end
$$;

drop trigger if exists creators_refresh_article_scope on public.creators;
create trigger creators_refresh_article_scope
  after update of creator_types, editorial_publisher on public.creators
  for each row execute function public.creators_refresh_article_scope();

-- Backup, then apply the rule to existing articles.
create table if not exists public.backup_20261104_article_scope as
  select id, author_creator_id from public.articles where false;
alter table public.backup_20261104_article_scope enable row level security;
insert into public.backup_20261104_article_scope (id, author_creator_id)
  select id, author_creator_id from public.articles
  where public.article_scope_for_creator(author_creator_id) = 'profile';

update public.articles
set listing_scope = public.article_scope_for_creator(author_creator_id)
where listing_scope is distinct from public.article_scope_for_creator(author_creator_id);

-- Photo gallery per article.
create table if not exists public.article_gallery_images (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists article_gallery_images_article_idx
  on public.article_gallery_images (article_id, sort_order);
alter table public.article_gallery_images enable row level security;
drop policy if exists article_gallery_images_public_read on public.article_gallery_images;
create policy article_gallery_images_public_read on public.article_gallery_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.articles a where a.id = article_id and a.is_published
  ));

-- Hub functions: only 'hub' articles. Promoted articles (an active
-- visibility boost) come first and carry is_promoted.
create or replace function public.article_is_promoted(p_article_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from visibility_boosts b
    where b.entity_type = 'article'
      and b.entity_id = p_article_id
      and b.starts_at <= now()
      and (b.ends_at is null or b.ends_at > now())
  )
$$;

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
      and a.listing_scope = 'hub'
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
  select to_jsonb(a) || jsonb_build_object('is_promoted', p.promoted), count(*) over ()
  from articles a
  cross join lateral (select public.article_is_promoted(a.id) as promoted) p
  where a.is_published
    and a.listing_scope = 'hub'
    and ((a.article_type = 'pattern') = p_patterns)
    and (p_q is null or a.title ilike '%' || p_q || '%' or a.excerpt ilike '%' || p_q || '%')
    and (p_domain is null or p_domain = any (public.article_hobby_slugs(a.domain_id, a.id, a.crafts)))
    and (p_niveau is null or a.difficulty_level = p_niveau)
    and (p_soort is null or a.content_kind = p_soort)
    and (p_type is null or a.article_type = p_type)
    and (p_techniek is null or p_techniek = any (a.techniques))
    and (p_thema is null or p_thema = any (a.themes))
    and (p_voor is null or p_voor = any (a.audience))
  order by p.promoted desc, a.is_featured desc, a.published_at desc nulls last, a.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 96)
$$;

grant execute on function public.article_is_promoted(uuid) to anon, authenticated;
grant execute on function public.article_scope_for_creator(uuid) to anon, authenticated;

-- Undo:
--   drop trigger articles_set_listing_scope on public.articles;
--   drop trigger creators_refresh_article_scope on public.creators;
--   alter table public.articles drop column listing_scope, drop column video_url;
--   drop table public.article_gallery_images;
--   alter table public.creators drop column editorial_publisher;
--   then re-apply 20261103140000_article_hub_facets.sql for the old hub functions.
