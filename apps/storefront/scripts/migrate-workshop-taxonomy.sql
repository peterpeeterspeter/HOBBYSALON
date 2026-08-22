-- Workshop taxonomy: domain-scoped subcategories + filter metadata.
-- Existing workshops keep empty languages (unknown) — do not invent nl.

create table if not exists public.workshop_categories (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  slug text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (domain_id, slug)
);

create index if not exists idx_workshop_categories_domain_id
  on public.workshop_categories(domain_id);
create index if not exists idx_workshop_categories_active_sort
  on public.workshop_categories(domain_id, sort_order)
  where is_active = true;

alter table public.workshops
  add column if not exists category_id uuid references public.workshop_categories(id) on delete set null,
  add column if not exists audience_types text[] not null default '{}',
  add column if not exists age_groups text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists offer_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workshops_offer_type_check'
  ) then
    alter table public.workshops
      add constraint workshops_offer_type_check
      check (
        offer_type is null
        or offer_type in ('open_workshop', 'private_group', 'ongoing_course')
      );
  end if;
end $$;

create index if not exists idx_workshops_category_id on public.workshops(category_id);
create index if not exists idx_workshops_offer_type on public.workshops(offer_type);
create index if not exists idx_workshops_audience_types on public.workshops using gin (audience_types);
create index if not exists idx_workshops_age_groups on public.workshops using gin (age_groups);
create index if not exists idx_workshops_languages on public.workshops using gin (languages);

create index if not exists idx_workshop_sessions_starts_at_workshop_active
  on public.workshop_sessions (starts_at, workshop_id)
  where is_cancelled = false;

-- Seed semantic categories per domain (ids stable for re-runs via on conflict).
insert into public.workshop_categories (id, domain_id, slug, name, sort_order) values
  -- Crochet
  ('c2111111-1111-1111-1111-111111111101', 'd1111111-1111-1111-1111-111111111101', 'basis-haken', 'Basis haken', 10),
  ('c2111111-1111-1111-1111-111111111102', 'd1111111-1111-1111-1111-111111111101', 'amigurumi', 'Amigurumi', 20),
  ('c2111111-1111-1111-1111-111111111103', 'd1111111-1111-1111-1111-111111111101', 'kleding', 'Kleding', 30),
  ('c2111111-1111-1111-1111-111111111104', 'd1111111-1111-1111-1111-111111111101', 'accessoires', 'Accessoires', 40),
  -- Breien
  ('c2111111-1111-1111-1111-111111111201', 'd1111111-1111-1111-1111-111111111102', 'basis-breien', 'Basis breien', 10),
  ('c2111111-1111-1111-1111-111111111202', 'd1111111-1111-1111-1111-111111111102', 'sokken', 'Sokken', 20),
  ('c2111111-1111-1111-1111-111111111203', 'd1111111-1111-1111-1111-111111111102', 'kabels', 'Kabels', 30),
  ('c2111111-1111-1111-1111-111111111204', 'd1111111-1111-1111-1111-111111111102', 'kleding', 'Kleding', 40),
  -- Kaarten maken
  ('c2111111-1111-1111-1111-111111111301', 'd1111111-1111-1111-1111-111111111103', 'basis-kaarten', 'Basis kaarten', 10),
  ('c2111111-1111-1111-1111-111111111302', 'd1111111-1111-1111-1111-111111111103', 'stansen', 'Stansen', 20),
  ('c2111111-1111-1111-1111-111111111303', 'd1111111-1111-1111-1111-111111111103', 'watercolor', 'Watercolour', 30),
  -- Naaien
  ('c2111111-1111-1111-1111-111111111401', 'd1111111-1111-1111-1111-111111111104', 'basis-naaien', 'Basis naaien', 10),
  ('c2111111-1111-1111-1111-111111111402', 'd1111111-1111-1111-1111-111111111104', 'kleding', 'Kleding', 20),
  ('c2111111-1111-1111-1111-111111111403', 'd1111111-1111-1111-1111-111111111104', 'tassen', 'Tassen', 30),
  ('c2111111-1111-1111-1111-111111111404', 'd1111111-1111-1111-1111-111111111104', 'interieur', 'Interieur', 40),
  -- Sieraden
  ('c2111111-1111-1111-1111-111111111501', 'd1111111-1111-1111-1111-111111111105', 'kralenwerken', 'Kralenwerken', 10),
  ('c2111111-1111-1111-1111-111111111502', 'd1111111-1111-1111-1111-111111111105', 'draadwerken', 'Draadwerken', 20),
  ('c2111111-1111-1111-1111-111111111503', 'd1111111-1111-1111-1111-111111111105', 'metaalklei', 'Metaalklei', 30),
  -- Scrapbooking
  ('c2111111-1111-1111-1111-111111111601', 'd1111111-1111-1111-1111-111111111106', 'layouts', 'Layouts', 10),
  ('c2111111-1111-1111-1111-111111111602', 'd1111111-1111-1111-1111-111111111106', 'albums', 'Albums', 20),
  ('c2111111-1111-1111-1111-111111111603', 'd1111111-1111-1111-1111-111111111106', 'journaling', 'Journaling', 30),
  -- Keramiek
  ('c2111111-1111-1111-1111-111111111701', 'd1111111-1111-1111-1111-111111111107', 'draaien', 'Draaien', 10),
  ('c2111111-1111-1111-1111-111111111702', 'd1111111-1111-1111-1111-111111111107', 'handbouw', 'Handbouw', 20),
  ('c2111111-1111-1111-1111-111111111703', 'd1111111-1111-1111-1111-111111111107', 'glazuren', 'Glazuren', 30),
  -- DIY
  ('c2111111-1111-1111-1111-111111111801', 'd1111111-1111-1111-1111-111111111108', 'houtwerken', 'Houtwerken', 10),
  ('c2111111-1111-1111-1111-111111111802', 'd1111111-1111-1111-1111-111111111108', 'upcycling', 'Upcycling', 20),
  ('c2111111-1111-1111-1111-111111111803', 'd1111111-1111-1111-1111-111111111108', 'decoratie', 'Decoratie', 30)
on conflict (domain_id, slug) do update
  set name = excluded.name,
      sort_order = excluded.sort_order,
      is_active = true;

alter table public.workshop_categories enable row level security;

drop policy if exists workshop_categories_public_read on public.workshop_categories;
create policy workshop_categories_public_read on public.workshop_categories
  for select
  to anon, authenticated
  using (is_active = true);
