-- Gallery images for maker product pages + expanded product categories per domain.

create table if not exists public.product_gallery_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_gallery_images_product_id
  on public.product_gallery_images(product_id);
create index if not exists idx_product_gallery_images_product_sort
  on public.product_gallery_images(product_id, sort_order, created_at);

alter table public.product_gallery_images enable row level security;

drop policy if exists product_gallery_images_public_read on public.product_gallery_images;
create policy product_gallery_images_public_read on public.product_gallery_images
  for select
  to anon, authenticated
  using (true);

-- Upsert by (domain_id, slug) so existing seed rows keep their ids.
INSERT INTO public.product_categories (domain_id, slug, name, sort_order) VALUES
  ('d1111111-1111-1111-1111-111111111101', 'amigurumi', 'Amigurumi', 10),
  ('d1111111-1111-1111-1111-111111111101', 'garen', 'Garen & materialen', 20),
  ('d1111111-1111-1111-1111-111111111101', 'accessoires', 'Accessoires', 30),
  ('d1111111-1111-1111-1111-111111111101', 'kleding', 'Kleding', 40),
  ('d1111111-1111-1111-1111-111111111101', 'decoratie', 'Decoratie', 50),
  ('d1111111-1111-1111-1111-111111111102', 'accessoires', 'Accessoires', 10),
  ('d1111111-1111-1111-1111-111111111102', 'kleding', 'Kleding', 20),
  ('d1111111-1111-1111-1111-111111111102', 'sokken', 'Sokken', 30),
  ('d1111111-1111-1111-1111-111111111102', 'garen', 'Garen & materialen', 40),
  ('d1111111-1111-1111-1111-111111111103', 'stempels', 'Stempels', 10),
  ('d1111111-1111-1111-1111-111111111103', 'kaarten', 'Kaarten', 20),
  ('d1111111-1111-1111-1111-111111111103', 'stansen', 'Stansen', 30),
  ('d1111111-1111-1111-1111-111111111103', 'papier', 'Papier & materialen', 40),
  ('d1111111-1111-1111-1111-111111111104', 'stoffen', 'Stoffen', 10),
  ('d1111111-1111-1111-1111-111111111104', 'kleding', 'Kleding', 20),
  ('d1111111-1111-1111-1111-111111111104', 'tassen', 'Tassen', 30),
  ('d1111111-1111-1111-1111-111111111104', 'interieur', 'Interieur', 40),
  ('d1111111-1111-1111-1111-111111111105', 'kralen', 'Kralen', 10),
  ('d1111111-1111-1111-1111-111111111105', 'armbanden', 'Armbanden', 20),
  ('d1111111-1111-1111-1111-111111111105', 'oorbellen', 'Oorbellen', 30),
  ('d1111111-1111-1111-1111-111111111105', 'metaalklei', 'Metaalklei', 40),
  ('d1111111-1111-1111-1111-111111111106', 'papier', 'Papier', 10),
  ('d1111111-1111-1111-1111-111111111106', 'layouts', 'Layouts', 20),
  ('d1111111-1111-1111-1111-111111111106', 'albums', 'Albums', 30),
  ('d1111111-1111-1111-1111-111111111106', 'journaling', 'Journaling', 40),
  ('d1111111-1111-1111-1111-111111111107', 'mokken', 'Mokken', 10),
  ('d1111111-1111-1111-1111-111111111107', 'klei', 'Klei & materialen', 20),
  ('d1111111-1111-1111-1111-111111111107', 'schalen', 'Schalen', 30),
  ('d1111111-1111-1111-1111-111111111107', 'decoratie', 'Decoratie', 40),
  ('d1111111-1111-1111-1111-111111111108', 'decoratie', 'Decoratie', 10),
  ('d1111111-1111-1111-1111-111111111108', 'upcycling', 'Upcycling', 20),
  ('d1111111-1111-1111-1111-111111111108', 'houtwerken', 'Houtwerken', 30)
ON CONFLICT (domain_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;
