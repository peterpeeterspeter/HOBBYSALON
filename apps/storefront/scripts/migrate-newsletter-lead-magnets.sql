-- Consent and lifecycle tracking for lead-magnet email subscriptions.
-- Apply through the established reviewed Supabase SQL workflow only.

create table if not exists public.newsletter_lead_magnets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  file_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_opt_in_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  lead_magnet_id uuid not null references public.newsletter_lead_magnets(id) on delete cascade,
  source_path text not null,
  status text not null default 'pending',
  consented_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_opt_in_events_status_check check (status in ('pending', 'confirmed', 'unsubscribed')),
  unique (email, lead_magnet_id)
);

create index if not exists idx_newsletter_opt_in_events_email
  on public.newsletter_opt_in_events(email);
