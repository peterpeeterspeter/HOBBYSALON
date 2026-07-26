-- Listing-first model, phase 4: event pricing + exhibitor outreach
-- See docs/listing-first-integration-plan.md for the full phased plan.
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-listing-first-phase4.sql

-- Maker opt-in for exhibitor outreach. Never sold/shared directly - an
-- organizer pays credits to send a call to matching opt-in makers via the
-- platform; makers who want to respond do so through the existing
-- event_vendor_inquiries flow, sharing their own contact info themselves.
alter table public.creators
  add column if not exists open_to_markets boolean not null default false;

-- Audit log of outreach sends. Does not store recipient identities - who
-- was contacted is derivable from event_vendor_inquiries responses, not
-- from this table.
create table if not exists public.event_exhibitor_outreach (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_creator_id uuid not null references public.creators(id) on delete cascade,
  message text,
  recipient_count integer not null default 0,
  credits_spent integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_exhibitor_outreach_event_id
  on public.event_exhibitor_outreach(event_id);
create index if not exists idx_event_exhibitor_outreach_organizer_id
  on public.event_exhibitor_outreach(organizer_creator_id);

alter table public.event_exhibitor_outreach enable row level security;
-- Service-role only: no anon/authenticated policy, same trust boundary as
-- listing_credit_wallets.

-- Event publishing and exhibitor outreach now spend credits (when
-- COMMERCIAL_GATING_ENABLED is true) - extend the allowed reasons.
alter table public.listing_credit_transactions
  drop constraint if exists listing_credit_transactions_reason_check;
alter table public.listing_credit_transactions
  add constraint listing_credit_transactions_reason_check check (
    reason in (
      'purchase', 'listing_create', 'listing_bump', 'spotlight',
      'refund', 'manual_adjustment',
      'event_publish', 'exhibitor_outreach'
    )
  );
