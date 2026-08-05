-- Free-text specialty tags on creator profiles + a few extra hobby domains.
-- Makers who don't fit a fixed domain can describe their craft themselves.

alter table public.creators
  add column if not exists specialty_tags text[] not null default '{}';

comment on column public.creators.specialty_tags is
  'Free-text hobby/specialty labels (e.g. vilten, glas-in-lood). Shown alongside domain chips.';

create index if not exists idx_creators_specialty_tags
  on public.creators using gin (specialty_tags);

-- Extra domains for common hobbies missing from the base set.
INSERT INTO public.domains (id, slug, name, short_description, sort_order, is_active, seo_title, seo_description) VALUES
  ('d1111111-1111-1111-1111-11111111110f', 'felting', 'Vilten', 'Natvilten, naaldvilten en wolprojecten', 15, true, 'Vilten | Hobbysalon', 'Vilten workshops, materialen en makers'),
  ('d1111111-1111-1111-1111-111111111110', 'leathercraft', 'Leerbewerking', 'Tassen, riemen en leeraccessoires', 16, true, 'Leerbewerking | Hobbysalon', 'Leerprojecten, workshops en materialen'),
  ('d1111111-1111-1111-1111-111111111111', 'polymer-clay', 'Polymer klei', 'Figuren, sieraden en miniaturen', 17, true, 'Polymer klei | Hobbysalon', 'Polymer klei projecten en makers'),
  ('d1111111-1111-1111-1111-111111111112', 'lettering', 'Lettering & kalligrafie', 'Handlettering, brush lettering en kalligrafie', 18, true, 'Lettering | Hobbysalon', 'Lettering workshops en inspiratie'),
  ('d1111111-1111-1111-1111-111111111113', 'glass-art', 'Glas & glasfusie', 'Glas-in-lood, fusie en glasbewerking', 19, true, 'Glas | Hobbysalon', 'Glasprojecten, workshops en makers')
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description;

-- Generic "Overig" product category under DIY for listings that don't fit.
INSERT INTO public.product_categories (domain_id, slug, name, sort_order) VALUES
  ('d1111111-1111-1111-1111-111111111108', 'overig', 'Overig', 90)
ON CONFLICT (domain_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;
