-- Handmade listings: platform price + contact inquiries (no Medusa required)
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-handmade-listings.sql

alter table public.products
  add column if not exists price_cents integer,
  add column if not exists currency_code text,
  add column if not exists stock_mode text;

alter table public.products
  drop constraint if exists products_stock_mode_check;

alter table public.products
  add constraint products_stock_mode_check check (
    stock_mode is null
    or stock_mode in ('made_to_order', 'in_stock', 'contact')
  );

alter table public.products
  drop constraint if exists products_currency_code_check;

alter table public.products
  add constraint products_currency_code_check check (
    currency_code is null
    or char_length(currency_code) = 3
  );

create table if not exists public.product_inquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  full_name text not null,
  email text not null,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_inquiries_status_check check (
    status in ('new', 'contacted', 'accepted', 'declined')
  )
);

create index if not exists idx_product_inquiries_product_id
  on public.product_inquiries(product_id);
create index if not exists idx_product_inquiries_creator_id
  on public.product_inquiries(creator_id);
create index if not exists idx_product_inquiries_status
  on public.product_inquiries(status);

drop trigger if exists trg_product_inquiries_updated_at on public.product_inquiries;
create trigger trg_product_inquiries_updated_at
before update on public.product_inquiries
for each row execute function public.set_updated_at();

alter table public.product_inquiries enable row level security;

drop policy if exists product_inquiries_anon_insert on public.product_inquiries;
drop policy if exists product_inquiries_service_all on public.product_inquiries;

-- Public may only insert new inquiries. Dashboard reads/updates use service role (bypasses RLS).
create policy product_inquiries_anon_insert on public.product_inquiries
  for insert
  to anon, authenticated
  with check (
    full_name is not null
    and length(trim(full_name)) > 0
    and email is not null
    and length(trim(email)) > 0
    and status = 'new'
  );
