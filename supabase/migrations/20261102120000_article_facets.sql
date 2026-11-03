-- Public filter facets for articles and patterns.
-- Filled by `yarn workspace storefront sync:article-facets` from the pinned
-- private metadata sidecar. Only rows whose body hash matches get values.
alter table public.articles
  add column if not exists content_kind text,
  add column if not exists crafts text[] not null default '{}',
  add column if not exists techniques text[] not null default '{}',
  add column if not exists themes text[] not null default '{}',
  add column if not exists audience text[] not null default '{}',
  add column if not exists facets_source_sha256 text,
  add column if not exists facets_synced_at timestamptz;

create index if not exists articles_crafts_gin on public.articles using gin (crafts);
create index if not exists articles_techniques_gin on public.articles using gin (techniques);
create index if not exists articles_themes_gin on public.articles using gin (themes);
create index if not exists articles_audience_gin on public.articles using gin (audience);
create index if not exists articles_content_kind_idx on public.articles (content_kind);

-- Facet counts over all published rows of one listing (patterns or not).
create or replace function public.article_facet_counts(p_patterns boolean)
returns table (facet text, value text, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select * from public.articles
    where is_published
      and ((article_type = 'pattern') = p_patterns)
  )
  select 'craft', v, count(*) from base, unnest(crafts) v group by v
  union all
  select 'technique', v, count(*) from base, unnest(techniques) v group by v
  union all
  select 'theme', v, count(*) from base, unnest(themes) v group by v
  union all
  select 'audience', v, count(*) from base, unnest(audience) v group by v
  union all
  select 'content_kind', content_kind, count(*) from base where content_kind is not null group by content_kind
  union all
  select 'difficulty', difficulty_level, count(*) from base where difficulty_level is not null group by difficulty_level
  union all
  select 'article_type', article_type, count(*) from base group by article_type
$$;

grant execute on function public.article_facet_counts(boolean) to anon, authenticated;
