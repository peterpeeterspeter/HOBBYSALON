-- One row per article: the latest complete metadata that matches the
-- article's current text. Filled by `sync:article-metadata`. Read by the
-- facet sync and the matching worker, so an overwritten bucket file can no
-- longer break them. Service role only: no RLS policies.
create table if not exists public.article_metadata (
  article_id uuid primary key references public.articles (id) on delete cascade,
  metadata jsonb not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  metadata_version text not null,
  source_file_sha256 text,
  imported_at timestamptz not null default now()
);
alter table public.article_metadata enable row level security;
