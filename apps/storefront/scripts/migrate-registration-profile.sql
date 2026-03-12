-- REG-P0-01: registration profile foundation
-- Run via:
-- psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-registration-profile.sql

create table if not exists public.user_preferences (
  user_id uuid primary key,
  postal_code text,
  city text,
  country_code text not null default 'BE',
  radius_km integer not null default 25,
  preferred_domain_ids uuid[] not null default '{}',
  interest_types text[] not null default '{}',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_radius_km_check check (
    radius_km between 5 and 200
  ),
  constraint user_preferences_interest_types_check check (
    interest_types <@ array['workshop','supply','handmade','event','article']::text[]
  )
);

create index if not exists idx_user_preferences_country_code on public.user_preferences(country_code);
create index if not exists idx_user_preferences_postal_code on public.user_preferences(postal_code);

drop trigger if exists trg_user_preferences_updated_at on public.user_preferences;
create trigger trg_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create table if not exists public.user_account_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  created_at timestamptz not null default now(),
  constraint user_account_roles_role_check check (
    role in ('user','creator','merchant','workshop_host','organizer')
  ),
  unique (user_id, role)
);

create index if not exists idx_user_account_roles_user_id on public.user_account_roles(user_id);
create index if not exists idx_user_account_roles_role on public.user_account_roles(role);

create table if not exists public.user_seller_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  seller_id text not null,
  seller_type text not null,
  created_at timestamptz not null default now(),
  constraint user_seller_links_seller_type_check check (
    seller_type in ('creator','merchant')
  ),
  unique (user_id, seller_type),
  unique (seller_id)
);

create index if not exists idx_user_seller_links_user_id on public.user_seller_links(user_id);
create index if not exists idx_user_seller_links_seller_id on public.user_seller_links(seller_id);
