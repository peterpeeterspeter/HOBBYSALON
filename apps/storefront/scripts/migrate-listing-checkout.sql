-- Listing-first model, phase 3: paid checkout for credit packs and plans
-- See docs/listing-first-integration-plan.md for the full phased plan.
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-listing-checkout.sql

-- Stripe can deliver the same webhook event more than once. Insert the
-- session id here before granting anything; a unique-violation on insert
-- means this session was already processed, so the webhook handler skips
-- granting a second time.
create table if not exists public.stripe_checkout_events (
  session_id text primary key,
  kind text not null,
  creator_id uuid references public.creators(id) on delete set null,
  processed_at timestamptz not null default now(),
  constraint stripe_checkout_events_kind_check check (
    kind in ('credit_pack', 'plan')
  )
);

alter table public.stripe_checkout_events enable row level security;

-- Service-role only: no anon/authenticated policy. The webhook route uses
-- the service-role client, same trust boundary as listing_credit_wallets.
