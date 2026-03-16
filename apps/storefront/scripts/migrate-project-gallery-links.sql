-- Adds creator project gallery support:
-- 1) project_gallery_images for finished creation photos
-- 2) project_product_links for material/product linking

create table if not exists public.project_gallery_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_gallery_images_project_id
  on public.project_gallery_images(project_id);
create index if not exists idx_project_gallery_images_project_sort
  on public.project_gallery_images(project_id, sort_order, created_at);

create table if not exists public.project_product_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  link_type text not null default 'material',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, product_id)
);

create index if not exists idx_project_product_links_project_id
  on public.project_product_links(project_id);
create index if not exists idx_project_product_links_product_id
  on public.project_product_links(product_id);
