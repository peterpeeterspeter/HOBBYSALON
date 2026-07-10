-- Standholder inquiry flow for event organizers
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-event-vendor-inquiries.sql

create table if not exists public.event_vendor_inquiries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_creator_id uuid not null references public.creators(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  email text not null,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_vendor_inquiries_status_check check (
    status in ('new', 'contacted', 'accepted', 'declined')
  )
);

create index if not exists idx_event_vendor_inquiries_event_id
  on public.event_vendor_inquiries(event_id);
create index if not exists idx_event_vendor_inquiries_organizer_creator_id
  on public.event_vendor_inquiries(organizer_creator_id);
create index if not exists idx_event_vendor_inquiries_status
  on public.event_vendor_inquiries(status);

drop trigger if exists trg_event_vendor_inquiries_updated_at on public.event_vendor_inquiries;
create trigger trg_event_vendor_inquiries_updated_at
before update on public.event_vendor_inquiries
for each row execute function public.set_updated_at();

alter table public.event_vendor_inquiries enable row level security;

drop policy if exists event_vendor_inquiries_anon_insert on public.event_vendor_inquiries;
create policy event_vendor_inquiries_anon_insert on public.event_vendor_inquiries
  for insert with check (true);

drop policy if exists event_vendor_inquiries_service_all on public.event_vendor_inquiries;
create policy event_vendor_inquiries_service_all on public.event_vendor_inquiries
  for all using (true) with check (true);
