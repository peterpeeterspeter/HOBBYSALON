-- Explicit consent and moderation boundary for community photos shown below articles.
-- A personal project/gallery image is never public unless this record is approved.

create table if not exists public.article_project_showcase_submissions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  submitted_by_user_id uuid not null,
  status text not null default 'pending',
  consented_at timestamptz not null default now(),
  consent_text_version text not null,
  approved_at timestamptz,
  approved_by_user_id uuid,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_project_showcase_submissions_status_check
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  unique (article_id, project_id)
);

create index if not exists idx_article_project_showcase_public
  on public.article_project_showcase_submissions(article_id, status, approved_at desc);
