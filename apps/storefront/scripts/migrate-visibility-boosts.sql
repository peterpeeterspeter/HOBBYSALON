-- Visibility boosts for paid ranking and spotlight
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-visibility-boosts.sql

create table if not exists public.visibility_boosts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  boost_type text not null,
  source text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  boost_score integer not null default 100,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint visibility_boosts_entity_type_check check (
    entity_type in ('creator', 'product', 'workshop', 'event', 'article')
  ),
  constraint visibility_boosts_boost_type_check check (
    boost_type in ('spotlight', 'category_top', 'homepage', 'newsletter', 'sponsored', 'manual')
  ),
  constraint visibility_boosts_source_check check (
    source in ('plan', 'credits', 'manual', 'sponsored')
  )
);

create index if not exists idx_visibility_boosts_entity
  on public.visibility_boosts(entity_type, entity_id);
create index if not exists idx_visibility_boosts_active
  on public.visibility_boosts(starts_at, ends_at);
create index if not exists idx_visibility_boosts_boost_type
  on public.visibility_boosts(boost_type);

alter table public.visibility_boosts enable row level security;

drop policy if exists visibility_boosts_public_read on public.visibility_boosts;
create policy visibility_boosts_public_read on public.visibility_boosts
  for select using (true);

drop policy if exists visibility_boosts_service_all on public.visibility_boosts;
create policy visibility_boosts_service_all on public.visibility_boosts
  for all using (true) with check (true);
