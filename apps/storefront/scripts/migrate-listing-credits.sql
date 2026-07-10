-- Listing credit wallets for maker monetization
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-listing-credits.sql

create table if not exists public.listing_credit_wallets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators(id) on delete cascade,
  balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_credit_wallets_balance_check check (balance >= 0)
);

drop trigger if exists trg_listing_credit_wallets_updated_at on public.listing_credit_wallets;
create trigger trg_listing_credit_wallets_updated_at
before update on public.listing_credit_wallets
for each row execute function public.set_updated_at();

create table if not exists public.listing_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  amount integer not null,
  reason text not null,
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint listing_credit_transactions_reason_check check (
    reason in (
      'purchase', 'listing_create', 'listing_bump', 'spotlight',
      'refund', 'manual_adjustment'
    )
  )
);

create index if not exists idx_listing_credit_transactions_creator_id
  on public.listing_credit_transactions(creator_id);
create index if not exists idx_listing_credit_transactions_created_at
  on public.listing_credit_transactions(created_at desc);

create table if not exists public.listing_credit_products (
  id uuid primary key default gen_random_uuid(),
  pack_code text not null unique,
  name text not null,
  credits integer not null,
  price_cents integer not null,
  currency_code text not null default 'EUR',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.listing_credit_products (pack_code, name, credits, price_cents, currency_code, is_active)
values
  ('starter', 'Starter', 10, 900, 'EUR', true),
  ('maker', 'Maker', 25, 1900, 'EUR', true),
  ('growth', 'Growth', 60, 3900, 'EUR', true),
  ('pro', 'Pro', 150, 7900, 'EUR', true),
  ('market_pack', 'Market Pack', 350, 14900, 'EUR', true)
on conflict (pack_code) do update set
  name = excluded.name,
  credits = excluded.credits,
  price_cents = excluded.price_cents,
  is_active = excluded.is_active;

-- Ensure every maker has a wallet
insert into public.listing_credit_wallets (creator_id, balance)
select c.id, 0
from public.creators c
where 'maker' = any(c.creator_types)
on conflict (creator_id) do nothing;

alter table public.listing_credit_wallets enable row level security;
alter table public.listing_credit_transactions enable row level security;
alter table public.listing_credit_products enable row level security;

drop policy if exists listing_credit_products_public_read on public.listing_credit_products;
create policy listing_credit_products_public_read on public.listing_credit_products
  for select using (is_active = true);

drop policy if exists listing_credit_wallets_service_all on public.listing_credit_wallets;
create policy listing_credit_wallets_service_all on public.listing_credit_wallets
  for all using (true) with check (true);

drop policy if exists listing_credit_transactions_service_all on public.listing_credit_transactions;
create policy listing_credit_transactions_service_all on public.listing_credit_transactions
  for all using (true) with check (true);
