begin;

-- No historical account/entity backfill: analytics storage requires occurrence consent.
create table if not exists public.analytics_conversion_claims (
  event text not null check (event in ('sign_up', 'listing_published', 'workshop_booking_registered', 'platform_charge_returned')),
  entity_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (event, entity_id)
);
-- Also upgrade an already-applied version of this migration.
alter table public.analytics_conversion_claims drop constraint if exists analytics_conversion_claims_event_check;
alter table public.analytics_conversion_claims add constraint analytics_conversion_claims_event_check
  check (event in ('sign_up', 'listing_published', 'workshop_booking_registered', 'platform_charge_returned'));
create table if not exists public.analytics_signup_candidates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation uuid not null,
  created_at timestamptz not null default now()
);
create table if not exists public.analytics_receipt_claims (
  receipt_id uuid primary key,
  claimed_at timestamptz not null default now()
);
alter table public.analytics_conversion_claims enable row level security;
alter table public.analytics_signup_candidates enable row level security;
alter table public.analytics_receipt_claims enable row level security;
revoke all on public.analytics_conversion_claims, public.analytics_signup_candidates, public.analytics_receipt_claims from public, anon, authenticated;
grant select, insert on public.analytics_conversion_claims, public.analytics_signup_candidates, public.analytics_receipt_claims to service_role;

-- Repair operational resend rows, without adding any analytics records.
update public.newsletter_opt_in_events set status = 'confirmed'
where status = 'pending' and confirmed_at is not null;

commit;
