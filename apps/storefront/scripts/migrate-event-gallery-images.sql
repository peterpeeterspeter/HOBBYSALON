-- Gallery images for event pages (extra photos beyond featured_image_url).

create table if not exists public.event_gallery_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_gallery_images_event_id
  on public.event_gallery_images(event_id);
create index if not exists idx_event_gallery_images_event_sort
  on public.event_gallery_images(event_id, sort_order, created_at);

alter table public.event_gallery_images enable row level security;

drop policy if exists event_gallery_images_public_read on public.event_gallery_images;
create policy event_gallery_images_public_read on public.event_gallery_images
  for select
  to anon, authenticated
  using (true);
