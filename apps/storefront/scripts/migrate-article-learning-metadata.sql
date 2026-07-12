-- Adds editorial difficulty metadata to articles without inventing legacy values.
-- Apply through the established Supabase SQL deployment workflow after review.

alter table public.articles
  add column if not exists difficulty_level text;

alter table public.articles
  drop constraint if exists articles_difficulty_level_check;

alter table public.articles
  add constraint articles_difficulty_level_check
  check (
    difficulty_level is null
    or difficulty_level in ('beginner', 'intermediate', 'advanced')
  );

create index if not exists idx_articles_published_difficulty
  on public.articles (difficulty_level)
  where is_published = true and difficulty_level is not null;
