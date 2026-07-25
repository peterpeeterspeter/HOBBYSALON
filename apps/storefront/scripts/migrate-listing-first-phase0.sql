-- Listing-first model, phase 0: schema foundation
-- See docs/listing-first-integration-plan.md for the full phased plan.
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-listing-first-phase0.sql

-- =========================================================
-- 0.1 Price column on products
-- Price has lived only in Medusa (calculated_price). Makers leaving
-- Medusa need somewhere to store an asking price. This is an indicative
-- listing price, not a transactional price - no checkout is bound to it.
-- =========================================================

alter table public.products
  add column if not exists price_cents integer,
  add column if not exists currency_code text not null default 'EUR';

-- =========================================================
-- 0.2 `destash` product type
-- Kept separate from `supply` so leftover hobbyist materials don't fall
-- under the 10% merchant commission rule, which matches on `supply`.
-- =========================================================

alter table public.products drop constraint if exists products_product_type_check;
alter table public.products add constraint products_product_type_check check (
  product_type in (
    'supply', 'handmade', 'destash',
    'event_listing', 'event_ticket', 'workshop_ticket', 'workshop_kit'
  )
);

-- =========================================================
-- 0.3 Listing expiry
-- Paid per-listing placements (e.g. a EUR15 workshop slot) need a term,
-- otherwise a one-time fee buys a permanent listing.
-- =========================================================

alter table public.products add column if not exists listing_expires_at timestamptz;
alter table public.workshops add column if not exists listing_expires_at timestamptz;

create index if not exists idx_products_listing_expires_at
  on public.products(listing_expires_at)
  where listing_expires_at is not null;
create index if not exists idx_workshops_listing_expires_at
  on public.workshops(listing_expires_at)
  where listing_expires_at is not null;

-- =========================================================
-- 0.4 Generic listing inquiry inbox
-- Mirrors the existing workshop_booking_requests pattern, generalized so
-- product and event listings can share one inquiry inbox instead of a
-- shopping cart. workshop_booking_requests keeps its workshop-specific
-- fields and is not migrated into this table.
-- =========================================================

create table if not exists public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  creator_id uuid not null references public.creators(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_inquiries_entity_type_check check (
    entity_type in ('product', 'event', 'creator')
  ),
  constraint listing_inquiries_status_check check (
    status in ('new', 'read', 'replied', 'archived', 'spam')
  )
);

create index if not exists idx_listing_inquiries_creator_id on public.listing_inquiries(creator_id);
create index if not exists idx_listing_inquiries_entity on public.listing_inquiries(entity_type, entity_id);
create index if not exists idx_listing_inquiries_status on public.listing_inquiries(status);

drop trigger if exists trg_listing_inquiries_updated_at on public.listing_inquiries;
create trigger trg_listing_inquiries_updated_at
before update on public.listing_inquiries
for each row execute function public.set_updated_at();

alter table public.listing_inquiries enable row level security;

drop policy if exists listing_inquiries_anon_insert on public.listing_inquiries;
create policy listing_inquiries_anon_insert
  on public.listing_inquiries
  for insert
  to anon, authenticated
  with check (
    entity_type in ('product', 'event', 'creator')
    and entity_id is not null
    and creator_id is not null
    and full_name is not null
    and char_length(trim(full_name)) between 2 and 120
    and email is not null
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and status = 'new'
  );

drop policy if exists listing_inquiries_owner_select on public.listing_inquiries;
create policy listing_inquiries_owner_select
  on public.listing_inquiries
  for select
  to authenticated
  using (
    creator_id in (
      select id from public.creators where user_id = auth.uid()
    )
  );

drop policy if exists listing_inquiries_owner_update on public.listing_inquiries;
create policy listing_inquiries_owner_update
  on public.listing_inquiries
  for update
  to authenticated
  using (
    creator_id in (
      select id from public.creators where user_id = auth.uid()
    )
  )
  with check (
    creator_id in (
      select id from public.creators where user_id = auth.uid()
    )
  );

-- =========================================================
-- 0.5 Listing credit reasons for the new placement types
-- =========================================================

alter table public.listing_credit_transactions
  drop constraint if exists listing_credit_transactions_reason_check;
alter table public.listing_credit_transactions
  add constraint listing_credit_transactions_reason_check check (
    reason in (
      'purchase', 'listing_create', 'listing_bump', 'spotlight',
      'refund', 'manual_adjustment',
      'workshop_publish', 'event_publish', 'exhibitor_outreach', 'newsletter_feature'
    )
  );
