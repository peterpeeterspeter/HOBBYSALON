-- Hobby passport + saved project progress tables
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-user-activity-log.sql

create table if not exists public.user_hobby_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  points_total integer not null default 0,
  completed_activity_count integer not null default 0,
  favorite_count integer not null default 0,
  preferred_domain_ids uuid[] not null default '{}',
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_hobby_profiles_user_id
  on public.user_hobby_profiles(user_id);
create index if not exists idx_user_hobby_profiles_last_activity_at
  on public.user_hobby_profiles(last_activity_at);

drop trigger if exists trg_user_hobby_profiles_updated_at on public.user_hobby_profiles;
create trigger trg_user_hobby_profiles_updated_at
before update on public.user_hobby_profiles
for each row execute function public.set_updated_at();

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  badge_key text not null,
  badge_name text not null,
  badge_description text,
  level integer not null default 1,
  progress_value integer not null default 0,
  progress_target integer not null default 1,
  unlocked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index if not exists idx_user_badges_user_id on public.user_badges(user_id);
create index if not exists idx_user_badges_badge_key on public.user_badges(badge_key);
create index if not exists idx_user_badges_unlocked_at on public.user_badges(unlocked_at);

drop trigger if exists trg_user_badges_updated_at on public.user_badges;
create trigger trg_user_badges_updated_at
before update on public.user_badges
for each row execute function public.set_updated_at();

create table if not exists public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_name text not null,
  source text not null default 'storefront',
  path text,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_activity_log_user_id on public.user_activity_log(user_id);
create index if not exists idx_user_activity_log_event_name on public.user_activity_log(event_name);
create index if not exists idx_user_activity_log_occurred_at on public.user_activity_log(occurred_at);
create index if not exists idx_user_activity_log_entity
  on public.user_activity_log(entity_type, entity_id);

alter table public.user_hobby_profiles enable row level security;
alter table public.user_badges enable row level security;
alter table public.user_activity_log enable row level security;

drop policy if exists user_hobby_profiles_service_all on public.user_hobby_profiles;
create policy user_hobby_profiles_service_all on public.user_hobby_profiles
  for all using (true) with check (true);

drop policy if exists user_badges_service_all on public.user_badges;
create policy user_badges_service_all on public.user_badges
  for all using (true) with check (true);

drop policy if exists user_activity_log_service_all on public.user_activity_log;
create policy user_activity_log_service_all on public.user_activity_log
  for all using (true) with check (true);
