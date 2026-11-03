-- Fix hobby tags that do not fit an article's crafts metadata. Applied on
-- 2026-11-03: 203 main hobbies moved, 99 extra links removed, "Crochet"
-- renamed to "Haken". Articles whose crafts fit no hobby (for example
-- borduren, weven, strijkkralen) keep their tag.
--
-- Undo:
--   update public.articles a set domain_id = b.domain_id
--     from public.backup_20261103_article_domain_id b where b.article_id = a.id;
--   insert into public.article_domains select * from public.backup_20261103_article_domains
--     on conflict do nothing;

-- Synonym seen in the data.
insert into public.domain_crafts (domain_slug, craft) values ('scrapbooking','scrapbooken') on conflict do nothing;

-- Backups, so every change below can be undone.
create table if not exists public.backup_20261103_article_domain_id as
  select id as article_id, domain_id from public.articles;
create table if not exists public.backup_20261103_article_domains as
  select * from public.article_domains;
alter table public.backup_20261103_article_domain_id enable row level security;
alter table public.backup_20261103_article_domains enable row level security;

-- 1. Main hobby: wrong tag and a clear fit by crafts -> move.
with wp as (
  select a.id,
    (select dc.domain_slug from public.domain_crafts dc join public.domains d2 on d2.slug = dc.domain_slug
      where dc.craft = any (a.crafts) and d2.is_active order by d2.sort_order limit 1) as fit
  from public.articles a join public.domains d on d.id = a.domain_id
  where cardinality(a.crafts) > 0
    and exists (select 1 from public.domain_crafts dc where dc.domain_slug = d.slug)
    and not exists (select 1 from public.domain_crafts dc where dc.domain_slug = d.slug and dc.craft = any (a.crafts))
)
update public.articles a set domain_id = d.id
from wp join public.domains d on d.slug = wp.fit
where a.id = wp.id and wp.fit is not null;

-- 2. Extra hobby links that do not fit the crafts -> remove.
delete from public.article_domains ad
using public.articles a, public.domains d
where a.id = ad.article_id and d.id = ad.domain_id
  and cardinality(a.crafts) > 0
  and exists (select 1 from public.domain_crafts dc where dc.domain_slug = d.slug)
  and not exists (select 1 from public.domain_crafts dc where dc.domain_slug = d.slug and dc.craft = any (a.crafts));

-- 3. Dutch name.
update public.domains set name = 'Haken' where slug = 'crochet' and name = 'Crochet';
