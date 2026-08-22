-- Gallery images for workshop pages (extra photos beyond featured_image_url).

create table if not exists public.workshop_gallery_images (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_workshop_gallery_images_workshop_id
  on public.workshop_gallery_images(workshop_id);
create index if not exists idx_workshop_gallery_images_workshop_sort
  on public.workshop_gallery_images(workshop_id, sort_order, created_at);

alter table public.workshop_gallery_images enable row level security;

drop policy if exists workshop_gallery_images_public_read on public.workshop_gallery_images;
create policy workshop_gallery_images_public_read on public.workshop_gallery_images
  for select
  to anon, authenticated
  using (true);
