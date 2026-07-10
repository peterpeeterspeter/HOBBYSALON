-- Commercial plans and subscriptions
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-commercial-plans.sql

create table if not exists public.commercial_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  segment text not null,
  name text not null,
  price_cents integer not null default 0,
  currency_code text not null default 'EUR',
  billing_period text not null,
  listing_limit integer,
  product_limit integer,
  external_links_allowed boolean not null default false,
  featured_allowed boolean not null default false,
  video_allowed boolean not null default false,
  analytics_allowed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_plans_segment_check check (
    segment in ('workshop', 'maker', 'supplier', 'organizer')
  ),
  constraint commercial_plans_billing_period_check check (
    billing_period in ('monthly', 'yearly', 'one_time')
  )
);

create index if not exists idx_commercial_plans_segment on public.commercial_plans(segment);
create index if not exists idx_commercial_plans_is_active on public.commercial_plans(is_active);

drop trigger if exists trg_commercial_plans_updated_at on public.commercial_plans;
create trigger trg_commercial_plans_updated_at
before update on public.commercial_plans
for each row execute function public.set_updated_at();

create table if not exists public.creator_plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  plan_id uuid not null references public.commercial_plans(id) on delete restrict,
  status text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  external_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_plan_subscriptions_status_check check (
    status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')
  )
);

create index if not exists idx_creator_plan_subscriptions_creator_id
  on public.creator_plan_subscriptions(creator_id);
create index if not exists idx_creator_plan_subscriptions_plan_id
  on public.creator_plan_subscriptions(plan_id);
create index if not exists idx_creator_plan_subscriptions_status
  on public.creator_plan_subscriptions(status);

drop trigger if exists trg_creator_plan_subscriptions_updated_at on public.creator_plan_subscriptions;
create trigger trg_creator_plan_subscriptions_updated_at
before update on public.creator_plan_subscriptions
for each row execute function public.set_updated_at();

create table if not exists public.event_plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  plan_id uuid not null references public.commercial_plans(id) on delete restrict,
  status text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  external_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_plan_subscriptions_status_check check (
    status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')
  )
);

create index if not exists idx_event_plan_subscriptions_event_id
  on public.event_plan_subscriptions(event_id);
create index if not exists idx_event_plan_subscriptions_plan_id
  on public.event_plan_subscriptions(plan_id);
create index if not exists idx_event_plan_subscriptions_status
  on public.event_plan_subscriptions(status);

drop trigger if exists trg_event_plan_subscriptions_updated_at on public.event_plan_subscriptions;
create trigger trg_event_plan_subscriptions_updated_at
before update on public.event_plan_subscriptions
for each row execute function public.set_updated_at();

alter table public.commercial_plans enable row level security;
alter table public.creator_plan_subscriptions enable row level security;
alter table public.event_plan_subscriptions enable row level security;

drop policy if exists commercial_plans_public_read on public.commercial_plans;
create policy commercial_plans_public_read on public.commercial_plans
  for select using (is_active = true);

drop policy if exists creator_plan_subscriptions_service_all on public.creator_plan_subscriptions;
create policy creator_plan_subscriptions_service_all on public.creator_plan_subscriptions
  for all using (true) with check (true);

drop policy if exists event_plan_subscriptions_service_all on public.event_plan_subscriptions;
create policy event_plan_subscriptions_service_all on public.event_plan_subscriptions
  for all using (true) with check (true);
