-- Hobbysalon platform seed data
-- Run via Supabase SQL Editor or: psql $DATABASE_URL -f scripts/seed-platform.sql
-- Prerequisite: Platform schema (docs/SQL.md) must be applied first

-- Domains (8)
INSERT INTO public.domains (id, slug, name, short_description, sort_order, is_active, seo_title, seo_description) VALUES
  ('d1111111-1111-1111-1111-111111111101', 'crochet', 'Crochet', 'Haakwerk en amigurumi', 1, true, 'Crochet | Hobbysalon', 'Ontdek haakprojecten, patronen en makers'),
  ('d1111111-1111-1111-1111-111111111102', 'knitting', 'Breien', 'Breien en tricot', 2, true, 'Breien | Hobbysalon', 'Breipatronen en wol van makers'),
  ('d1111111-1111-1111-1111-111111111103', 'card-making', 'Kaarten maken', 'Handgemaakte kaarten', 3, true, 'Kaarten maken | Hobbysalon', 'Stempels, papier en inspiratie'),
  ('d1111111-1111-1111-1111-111111111104', 'sewing', 'Naaien', 'Naaien en stoffen', 4, true, 'Naaien | Hobbysalon', 'Patronen, stoffen en naaimachines'),
  ('d1111111-1111-1111-1111-111111111105', 'jewelry-making', 'Sieraden maken', 'Kralen en juwelen', 5, true, 'Sieraden | Hobbysalon', 'Materialen en workshops'),
  ('d1111111-1111-1111-1111-111111111106', 'scrapbooking', 'Scrapbooking', 'Fotoalbums en decoratie', 6, true, 'Scrapbooking | Hobbysalon', 'Papier en embellishments'),
  ('d1111111-1111-1111-1111-111111111107', 'pottery', 'Keramiek', 'Klei en draaien', 7, true, 'Keramiek | Hobbysalon', 'Pottenbakken en workshops'),
  ('d1111111-1111-1111-1111-111111111108', 'diy', 'DIY', 'Doe-het-zelf projecten', 8, true, 'DIY | Hobbysalon', 'Creatieve projecten')
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description;

-- Creators (3: maker, supplier, maker+workshop host)
INSERT INTO public.creators (id, slug, display_name, business_name, bio, creator_types, is_featured) VALUES
  ('c2222222-2222-2222-2222-222222222201', 'marie-haakt', 'Marie de Vries', 'Marie Haakt', 'Passie voor amigurumi en haakwerk. Mijn patronen zijn beginner-vriendelijk.', ARRAY['maker'], true),
  ('c2222222-2222-2222-2222-222222222202', 'yarn-paradise', 'Yarn Paradise', 'Yarn Paradise', 'Kwaliteitswol en garen voor elke project.', ARRAY['supplier'], true),
  ('c2222222-2222-2222-2222-222222222203', 'anna-creates', 'Anna Jansen', 'Anna Creates', 'Keramist, workshopgever en maker. Handgemaakte mokken en cursussen.', ARRAY['maker', 'workshopgever'], true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  display_name = EXCLUDED.display_name,
  business_name = EXCLUDED.business_name,
  bio = EXCLUDED.bio,
  creator_types = EXCLUDED.creator_types,
  is_featured = EXCLUDED.is_featured;

-- Creator-Domain links
INSERT INTO public.creator_domains (creator_id, domain_id, is_primary) VALUES
  ('c2222222-2222-2222-2222-222222222201', 'd1111111-1111-1111-1111-111111111101', true),
  ('c2222222-2222-2222-2222-222222222201', 'd1111111-1111-1111-1111-111111111102', false),
  ('c2222222-2222-2222-2222-222222222202', 'd1111111-1111-1111-1111-111111111101', true),
  ('c2222222-2222-2222-2222-222222222202', 'd1111111-1111-1111-1111-111111111102', false),
  ('c2222222-2222-2222-2222-222222222203', 'd1111111-1111-1111-1111-111111111107', true)
ON CONFLICT (creator_id, domain_id) DO NOTHING;

-- Product categories (per domain, minimal)
INSERT INTO public.product_categories (id, domain_id, slug, name, sort_order) VALUES
  ('33333333-3333-3333-3333-333333333301', 'd1111111-1111-1111-1111-111111111101', 'amigurumi', 'Amigurumi', 1),
  ('33333333-3333-3333-3333-333333333302', 'd1111111-1111-1111-1111-111111111101', 'garen', 'Garen', 2),
  ('33333333-3333-3333-3333-333333333303', 'd1111111-1111-1111-1111-111111111107', 'mokken', 'Mokken', 1)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- Products (6: 3 handmade, 3 supply). medusa_product_id populated by link script after Medusa seed.
INSERT INTO public.products (id, creator_id, domain_id, category_id, slug, title, short_description, product_type, status, is_active, featured_image_url, is_featured) VALUES
  ('44444444-4444-4444-4444-444444444401', 'c2222222-2222-2222-2222-222222222201', 'd1111111-1111-1111-1111-111111111101', '33333333-3333-3333-3333-333333333301', 'handmade-crochet-scarf', 'Handgehaakte sjaal', 'Warme wollen sjaal in naturel', 'handmade', 'active', true, NULL, true),
  ('44444444-4444-4444-4444-444444444402', 'c2222222-2222-2222-2222-222222222202', 'd1111111-1111-1111-1111-111111111101', '33333333-3333-3333-3333-333333333302', 'supply-yarn-bundle', 'Wolpakket beginners', 'Alles-in-één pakket om te starten met haken', 'supply', 'active', true, NULL, true),
  ('44444444-4444-4444-4444-444444444403', 'c2222222-2222-2222-2222-222222222201', 'd1111111-1111-1111-1111-111111111102', NULL, 'handmade-knitted-hat', 'Gebreide muts', 'Zachte muts in merinoswol', 'handmade', 'active', true, NULL, false),
  ('44444444-4444-4444-4444-444444444404', 'c2222222-2222-2222-2222-222222222201', 'd1111111-1111-1111-1111-111111111101', NULL, 'supply-pattern-pdf', 'Haakpatroon: Kleine beer', 'PDF patroon amigurumi beertje', 'supply', 'active', true, NULL, false),
  ('44444444-4444-4444-4444-444444444405', 'c2222222-2222-2222-2222-222222222203', 'd1111111-1111-1111-1111-111111111107', '33333333-3333-3333-3333-333333333303', 'handmade-pottery-mug', 'Handgemaakte keramiek mok', 'Unieke steengoed mok', 'handmade', 'active', true, NULL, true),
  ('44444444-4444-4444-4444-444444444406', 'c2222222-2222-2222-2222-222222222202', 'd1111111-1111-1111-1111-111111111105', NULL, 'supply-bead-kit', 'Kralenpakket startset', 'Kralen, draad en gespen voor sieraden', 'supply', 'active', true, NULL, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  short_description = EXCLUDED.short_description,
  product_type = EXCLUDED.product_type,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active,
  featured_image_url = EXCLUDED.featured_image_url,
  is_featured = EXCLUDED.is_featured;

-- Workshops (3). Use valid UUIDs (hex only: 0-9a-f).
INSERT INTO public.workshops (id, creator_id, domain_id, slug, title, short_description, format_type, difficulty_level, price_cents, currency_code, duration_minutes, capacity, booking_mode, booking_url, city, is_featured, is_active, seo_title, seo_description) VALUES
  ('55555555-5555-5555-5555-555555555501', 'c2222222-2222-2222-2222-222222222201', 'd1111111-1111-1111-1111-111111111101', 'amigurumi-beginners', 'Amigurumi voor beginners', 'Leer de basis van amigurumi: opzetten, meerderen en minderen.', 'physical', 'beginner', 4500, 'EUR', 180, 10, 'request', NULL, 'Antwerpen', true, true, 'Amigurumi voor beginners | Hobbysalon', 'Workshop amigurumi: leer de basis in een gezellige sfeer.'),
  ('55555555-5555-5555-5555-555555555502', 'c2222222-2222-2222-2222-222222222203', 'd1111111-1111-1111-1111-111111111107', 'pottery-draaien', 'Pottenbakken: draaien op de schijf', 'Eerste kennismaking met de draaischijf. Maak je eigen mok of schaal.', 'physical', 'beginner', 7500, 'EUR', 240, 6, 'external_link', 'https://example.com/boeken', 'Gent', true, true, 'Pottenbakken draaien | Hobbysalon', 'Workshop pottenbakken: leer draaien op de schijf.'),
  ('55555555-5555-5555-5555-555555555503', 'c2222222-2222-2222-2222-222222222201', 'd1111111-1111-1111-1111-111111111101', 'haak-sjaal-workshop', 'Haak een wollen sjaal', 'Workshop waar je een eenvoudige sjaal leert haken. Wol inbegrepen.', 'physical', 'beginner', 3500, 'EUR', 150, 12, 'request', NULL, 'Mechelen', false, true, 'Haak sjaal workshop | Hobbysalon', 'Leer haken: maak je eigen wollen sjaal.')
ON CONFLICT (id) DO NOTHING;

-- Workshop sessions (upcoming)
INSERT INTO public.workshop_sessions (id, workshop_id, starts_at, ends_at, capacity, remaining_spots, booking_status) VALUES
  ('66666666-6666-6666-6666-666666666601', '55555555-5555-5555-5555-555555555501', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '3 hours', 10, 7, 'open'),
  ('66666666-6666-6666-6666-666666666602', '55555555-5555-5555-5555-555555555502', NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days' + INTERVAL '4 hours', 6, 3, 'open'),
  ('66666666-6666-6666-6666-666666666603', '55555555-5555-5555-5555-555555555503', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '2.5 hours', 12, 12, 'open')
ON CONFLICT (id) DO NOTHING;

-- Events (2)
INSERT INTO public.events (id, slug, title, short_description, event_type, organizer_creator_id, starts_at, ends_at, location_name, address_line_1, city, postal_code, country_code, ticketing_mode, ticket_url, ticket_price_cents, currency_code, is_featured, is_active, seo_title, seo_description) VALUES
  ('e7777777-7777-7777-7777-777777777701', 'handmade-markt-antwerpen', 'Handmade Markt Antwerpen', 'Maandelijkse markt met makers van handgemaakte producten.', 'handmade_market', 'c2222222-2222-2222-2222-222222222203', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days' + INTERVAL '8 hours', 'De Studio', 'Maarschalk Gérardstraat 4', 'Antwerpen', '2000', 'BE', 'none', NULL, NULL, 'EUR', true, true, 'Handmade Markt Antwerpen | Hobbysalon', 'Bezoek de Handmade Markt Antwerpen met unieke handgemaakte producten.'),
  ('e7777777-7777-7777-7777-777777777702', 'hobbybeurs-mechelen', 'Hobbybeurs Mechelen', 'Grote hobbybeurs met stands, workshops en demonstraties.', 'hobby_fair', 'c2222222-2222-2222-2222-222222222201', NOW() + INTERVAL '45 days', NOW() + INTERVAL '46 days', 'Nekkerspoel', 'Nekkerspoel 1', 'Mechelen', '2800', 'BE', 'external_link', 'https://example.com/tickets', 1500, 'EUR', true, true, 'Hobbybeurs Mechelen | Hobbysalon', 'Ontdek de grootste hobbybeurs van de regio.')
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  short_description = EXCLUDED.short_description,
  event_type = EXCLUDED.event_type,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  location_name = EXCLUDED.location_name,
  city = EXCLUDED.city,
  is_active = EXCLUDED.is_active;

-- Event domains
INSERT INTO public.event_domains (event_id, domain_id) VALUES
  ('e7777777-7777-7777-7777-777777777701', 'd1111111-1111-1111-1111-111111111101'),
  ('e7777777-7777-7777-7777-777777777701', 'd1111111-1111-1111-1111-111111111107'),
  ('e7777777-7777-7777-7777-777777777702', 'd1111111-1111-1111-1111-111111111101'),
  ('e7777777-7777-7777-7777-777777777702', 'd1111111-1111-1111-1111-111111111103')
ON CONFLICT (event_id, domain_id) DO NOTHING;

-- Event creators (participating makers)
INSERT INTO public.event_creators (event_id, creator_id, role) VALUES
  ('e7777777-7777-7777-7777-777777777701', 'c2222222-2222-2222-2222-222222222201', 'vendor'),
  ('e7777777-7777-7777-7777-777777777701', 'c2222222-2222-2222-2222-222222222203', 'vendor'),
  ('e7777777-7777-7777-7777-777777777702', 'c2222222-2222-2222-2222-222222222201', 'workshop_host'),
  ('e7777777-7777-7777-7777-777777777702', 'c2222222-2222-2222-2222-222222222202', 'vendor')
ON CONFLICT (event_id, creator_id, role) DO NOTHING;

-- Event workshops
INSERT INTO public.event_workshops (event_id, workshop_id) VALUES
  ('e7777777-7777-7777-7777-777777777702', '55555555-5555-5555-5555-555555555501'),
  ('e7777777-7777-7777-7777-777777777702', '55555555-5555-5555-5555-555555555503')
ON CONFLICT (event_id, workshop_id) DO NOTHING;

-- Entity links
INSERT INTO public.entity_links (source_entity_type, source_entity_id, target_entity_type, target_entity_id, relation_type, sort_order) VALUES
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'creator', 'c2222222-2222-2222-2222-222222222201', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'creator', 'c2222222-2222-2222-2222-222222222202', 'features', 2),
  ('domain', 'd1111111-1111-1111-1111-111111111107', 'creator', 'c2222222-2222-2222-2222-222222222203', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'product', '44444444-4444-4444-4444-444444444401', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'product', '44444444-4444-4444-4444-444444444402', 'features', 2),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'workshop', '55555555-5555-5555-5555-555555555501', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'workshop', '55555555-5555-5555-5555-555555555503', 'features', 2),
  ('domain', 'd1111111-1111-1111-1111-111111111107', 'workshop', '55555555-5555-5555-5555-555555555502', 'features', 1),
  ('creator', 'c2222222-2222-2222-2222-222222222201', 'product', '44444444-4444-4444-4444-444444444401', 'sells', 1),
  ('creator', 'c2222222-2222-2222-2222-222222222201', 'product', '44444444-4444-4444-4444-444444444403', 'sells', 2),
  ('creator', 'c2222222-2222-2222-2222-222222222201', 'product', '44444444-4444-4444-4444-444444444404', 'sells', 3),
  ('creator', 'c2222222-2222-2222-2222-222222222202', 'product', '44444444-4444-4444-4444-444444444402', 'sells', 1),
  ('creator', 'c2222222-2222-2222-2222-222222222202', 'product', '44444444-4444-4444-4444-444444444406', 'sells', 2),
  ('creator', 'c2222222-2222-2222-2222-222222222203', 'product', '44444444-4444-4444-4444-444444444405', 'sells', 1),
  ('product', '44444444-4444-4444-4444-444444444401', 'workshop', '55555555-5555-5555-5555-555555555501', 'related', 1),
  ('product', '44444444-4444-4444-4444-444444444401', 'workshop', '55555555-5555-5555-5555-555555555503', 'related', 2),
  ('product', '44444444-4444-4444-4444-444444444405', 'workshop', '55555555-5555-5555-5555-555555555502', 'related', 1),
  ('workshop', '55555555-5555-5555-5555-555555555501', 'product', '44444444-4444-4444-4444-444444444401', 'uses', 1),
  ('workshop', '55555555-5555-5555-5555-555555555501', 'product', '44444444-4444-4444-4444-444444444402', 'uses', 2),
  ('workshop', '55555555-5555-5555-5555-555555555502', 'product', '44444444-4444-4444-4444-444444444405', 'uses', 1),
  ('event', 'e7777777-7777-7777-7777-777777777701', 'product', '44444444-4444-4444-4444-444444444401', 'features', 1),
  ('event', 'e7777777-7777-7777-7777-777777777701', 'product', '44444444-4444-4444-4444-444444444405', 'features', 2),
  ('event', 'e7777777-7777-7777-7777-777777777702', 'product', '44444444-4444-4444-4444-444444444402', 'features', 1);
