-- Public survey responses (aanbod-verbeteren enquête)
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-survey-responses.sql

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_key text not null default 'aanbod-verbeteren-2026',
  activity_types text[] not null,
  activity_status text not null,
  outcomes text[] not null default '{}',
  answers jsonb not null default '{}'::jsonb,
  contact_ok boolean not null,
  contact_name text,
  contact_email text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint survey_responses_status_check check (status in ('new', 'reviewed', 'archived')),
  constraint survey_responses_activity_types_nonempty check (cardinality(activity_types) >= 1),
  constraint survey_responses_activity_types_allowed check (
    activity_types <@ array[
      'content',
      'handmade',
      'workshop',
      'webshop',
      'hobbybeurs',
      'makers_market'
    ]::text[]
  )
);

create index if not exists idx_survey_responses_survey_key
  on public.survey_responses(survey_key);
create index if not exists idx_survey_responses_status
  on public.survey_responses(status);
create index if not exists idx_survey_responses_created_at
  on public.survey_responses(created_at desc);
create index if not exists idx_survey_responses_activity_types
  on public.survey_responses using gin(activity_types);

drop trigger if exists trg_survey_responses_updated_at on public.survey_responses;
create trigger trg_survey_responses_updated_at
before update on public.survey_responses
for each row execute function public.set_updated_at();

alter table public.survey_responses enable row level security;

drop policy if exists survey_responses_anon_insert on public.survey_responses;
create policy survey_responses_anon_insert on public.survey_responses
  for insert
  to anon, authenticated
  with check (
    survey_key is not null
    and length(trim(survey_key)) > 0
    and cardinality(activity_types) >= 1
    and activity_status is not null
    and length(trim(activity_status)) > 0
    and status = 'new'
    and jsonb_typeof(answers) = 'object'
    and (
      contact_ok = false
      or (
        contact_email is not null
        and length(trim(contact_email)) > 0
        and contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    )
  );
