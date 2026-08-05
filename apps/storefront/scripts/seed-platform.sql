-- Hobbysalon platform seed data
-- Run via Supabase SQL Editor or: psql $DATABASE_URL -f scripts/seed-platform.sql
-- Prerequisite: Platform schema (docs/SQL.md) must be applied first

-- Domains (19)
INSERT INTO public.domains (id, slug, name, short_description, sort_order, is_active, seo_title, seo_description) VALUES
  ('d1111111-1111-1111-1111-111111111101', 'crochet', 'Crochet', 'Haakwerk en amigurumi', 1, true, 'Crochet | Hobbysalon', 'Ontdek haakprojecten, patronen en makers'),
  ('d1111111-1111-1111-1111-111111111102', 'knitting', 'Breien', 'Breien en tricot', 2, true, 'Breien | Hobbysalon', 'Breipatronen en wol van makers'),
  ('d1111111-1111-1111-1111-111111111103', 'card-making', 'Kaarten maken', 'Handgemaakte kaarten', 3, true, 'Kaarten maken | Hobbysalon', 'Stempels, papier en inspiratie'),
  ('d1111111-1111-1111-1111-111111111104', 'sewing', 'Naaien', 'Naaien en stoffen', 4, true, 'Naaien | Hobbysalon', 'Patronen, stoffen en naaimachines'),
  ('d1111111-1111-1111-1111-111111111105', 'jewelry-making', 'Sieraden maken', 'Kralen en juwelen', 5, true, 'Sieraden | Hobbysalon', 'Materialen en workshops'),
  ('d1111111-1111-1111-1111-111111111106', 'scrapbooking', 'Scrapbooking', 'Fotoalbums en decoratie', 6, true, 'Scrapbooking | Hobbysalon', 'Papier en embellishments'),
  ('d1111111-1111-1111-1111-111111111107', 'pottery', 'Keramiek', 'Klei en draaien', 7, true, 'Keramiek | Hobbysalon', 'Pottenbakken en workshops'),
  ('d1111111-1111-1111-1111-111111111108', 'diy', 'DIY', 'Doe-het-zelf projecten', 8, true, 'DIY | Hobbysalon', 'Creatieve projecten'),
  ('d1111111-1111-1111-1111-111111111109', 'macrame', 'Macramé', 'Knooptechnieken en wandhangers', 9, true, 'Macramé | Hobbysalon', 'Macramé projecten, koord en makers'),
  ('d1111111-1111-1111-1111-11111111110a', 'embroidery', 'Borduren', 'Handborduurwerk en patronen', 10, true, 'Borduren | Hobbysalon', 'Borduurpakketten, workshops en inspiratie'),
  ('d1111111-1111-1111-1111-11111111110b', 'painting', 'Schilderen', 'Aquarel, acryl en mixed media', 11, true, 'Schilderen | Hobbysalon', 'Schilderworkshops, verf en inspiratie'),
  ('d1111111-1111-1111-1111-11111111110c', 'candle-making', 'Kaarsen maken', 'Gieten, kleuren en geuren', 12, true, 'Kaarsen maken | Hobbysalon', 'Kaarsenworkshops en materialen'),
  ('d1111111-1111-1111-1111-11111111110d', 'woodworking', 'Houtbewerking', 'Snijden, schuren en afwerken', 13, true, 'Houtbewerking | Hobbysalon', 'Houtprojecten en tools'),
  ('d1111111-1111-1111-1111-11111111110e', 'quilting', 'Quilten', 'Patchwork en quilts', 14, true, 'Quilten | Hobbysalon', 'Quiltprojecten, stoffen en patronen'),
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

-- Articles (3)
INSERT INTO public.articles (id, slug, title, excerpt, body_markdown, article_type, reading_time_minutes, published_at, is_published, is_featured, author_creator_id, domain_id, seo_title, seo_description) VALUES
  ('a8888888-8888-8888-8888-888888888801', 'starten-met-amigurumi', 'Starten met amigurumi', 'De eerste steken en tools die je nodig hebt om amigurumi te leren.', 'Amigurumi is een toegankelijke manier om te starten met haken. In dit artikel overlopen we materialen, basissteken en een eenvoudig eerste project.', 'guide', 6, NOW() - INTERVAL '5 days', true, true, 'c2222222-2222-2222-2222-222222222201', 'd1111111-1111-1111-1111-111111111101', 'Starten met amigurumi | Hobbysalon', 'Leer hoe je begint met amigurumi en welke materialen je nodig hebt.'),
  ('a8888888-8888-8888-8888-888888888802', 'pottenbakken-thuis-beginnen', 'Pottenbakken thuis beginnen', 'Praktische tips om met klei te starten, ook zonder draaischijf.', 'Je kan perfect thuis starten met klei en handvormtechnieken. We tonen welke basismaterialen je nodig hebt en hoe je eerste objecten maakt.', 'tutorial', 7, NOW() - INTERVAL '3 days', true, true, 'c2222222-2222-2222-2222-222222222203', 'd1111111-1111-1111-1111-111111111107', 'Pottenbakken thuis beginnen | Hobbysalon', 'Praktische gids om thuis te starten met keramiek en pottenbakken.'),
  ('a8888888-8888-8888-8888-888888888803', 'bezoek-de-handmade-markt-antwerpen', 'Bezoek de Handmade Markt Antwerpen', 'Wat je mag verwachten op de volgende editie van de markt in Antwerpen.', 'De Handmade Markt Antwerpen brengt makers, workshops en inspiratie samen. Hier vind je het programma, de locaties en onze tips.', 'inspiration', 4, NOW() - INTERVAL '1 day', true, false, 'c2222222-2222-2222-2222-222222222203', 'd1111111-1111-1111-1111-111111111101', 'Handmade Markt Antwerpen | Hobbysalon', 'Ontdek het programma van de Handmade Markt Antwerpen.');

-- Article domains
INSERT INTO public.article_domains (article_id, domain_id) VALUES
  ('a8888888-8888-8888-8888-888888888801', 'd1111111-1111-1111-1111-111111111101'),
  ('a8888888-8888-8888-8888-888888888802', 'd1111111-1111-1111-1111-111111111107'),
  ('a8888888-8888-8888-8888-888888888803', 'd1111111-1111-1111-1111-111111111101')
ON CONFLICT (article_id, domain_id) DO NOTHING;

-- Projects (3)
INSERT INTO public.projects (
  id,
  slug,
  title,
  short_description,
  description,
  difficulty_level,
  estimated_duration_minutes,
  budget_min_cents,
  budget_max_cents,
  currency_code,
  is_featured,
  is_active,
  seo_title,
  seo_description
) VALUES
  (
    '99999999-9999-9999-9999-999999999901',
    'amigurumi-eerste-beertje',
    'Amigurumi: je eerste beertje',
    'Een beginner-proof startproject met een duidelijk stappenplan.',
    'Combineer materialen, een workshop en inspiratie om je eerste amigurumi-beertje te maken.',
    'beginner',
    180,
    3500,
    9000,
    'EUR',
    true,
    true,
    'Amigurumi eerste beertje | Hobbysalon Project',
    'Start met amigurumi via een volledig project met materialen en workshop.'
  ),
  (
    '99999999-9999-9999-9999-999999999902',
    'keramiek-mok-weekend',
    'Keramiek mok weekendproject',
    'Maak in een weekend je eerste handgemaakte mok.',
    'Project met workshop, inspiratie en materiaalkeuzes voor een afgewerkte keramiek mok.',
    'beginner',
    240,
    7500,
    15000,
    'EUR',
    true,
    true,
    'Keramiek mok weekendproject | Hobbysalon',
    'Volg een keramiek traject met workshop en tips om je eerste mok te maken.'
  ),
  (
    '99999999-9999-9999-9999-999999999903',
    'handmade-markt-voorbereiding',
    'Voorbereiding op een handmade markt',
    'Praktisch project om je creaties marktklaar te maken.',
    'Plan je beursvoorbereiding met inspiratie, event-context en relevante workshops.',
    'intermediate',
    300,
    5000,
    18000,
    'EUR',
    false,
    true,
    'Handmade markt voorbereiding | Hobbysalon',
    'Bereid je slim voor op je volgende handmade markt met een duidelijk projectplan.'
  )
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  short_description = EXCLUDED.short_description,
  description = EXCLUDED.description,
  difficulty_level = EXCLUDED.difficulty_level,
  estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
  budget_min_cents = EXCLUDED.budget_min_cents,
  budget_max_cents = EXCLUDED.budget_max_cents,
  currency_code = EXCLUDED.currency_code,
  is_featured = EXCLUDED.is_featured,
  is_active = EXCLUDED.is_active,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description;

-- Project domains
INSERT INTO public.project_domains (project_id, domain_id, is_primary) VALUES
  ('99999999-9999-9999-9999-999999999901', 'd1111111-1111-1111-1111-111111111101', true),
  ('99999999-9999-9999-9999-999999999902', 'd1111111-1111-1111-1111-111111111107', true),
  ('99999999-9999-9999-9999-999999999903', 'd1111111-1111-1111-1111-111111111101', true),
  ('99999999-9999-9999-9999-999999999903', 'd1111111-1111-1111-1111-111111111107', false)
ON CONFLICT (project_id, domain_id) DO NOTHING;

-- Project steps
INSERT INTO public.project_steps (
  id,
  project_id,
  step_order,
  title,
  instruction,
  related_entity_type,
  related_entity_id
) VALUES
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaa901', '99999999-9999-9999-9999-999999999901', 1, 'Kies je startmateriaal', 'Start met een eenvoudig wolpakket zodat je meteen kan oefenen.', 'product', '44444444-4444-4444-4444-444444444402'),
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaa902', '99999999-9999-9999-9999-999999999901', 2, 'Volg een basisworkshop', 'Leer de kernsteken en basisvormen met begeleiding.', 'workshop', '55555555-5555-5555-5555-555555555501'),
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaa903', '99999999-9999-9999-9999-999999999901', 3, 'Werk met een eenvoudig patroon', 'Gebruik het artikel als leidraad voor je eerste figuurtje.', 'article', 'a8888888-8888-8888-8888-888888888801'),
  ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaa901', '99999999-9999-9999-9999-999999999902', 1, 'Voorzie je klei en tools', 'Gebruik een afgewerkt voorbeeld om materiaalkeuze te versnellen.', 'product', '44444444-4444-4444-4444-444444444405'),
  ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaa902', '99999999-9999-9999-9999-999999999902', 2, 'Volg de draaischijf workshop', 'Plan je sessie en focus op basisvormen voor je eerste mok.', 'workshop', '55555555-5555-5555-5555-555555555502'),
  ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaa903', '99999999-9999-9999-9999-999999999902', 3, 'Lees de thuisgids', 'Gebruik het artikel om thuis verder te oefenen.', 'article', 'a8888888-8888-8888-8888-888888888802'),
  ('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaa901', '99999999-9999-9999-9999-999999999903', 1, 'Verzamel marktreferenties', 'Bekijk het event om sfeer en doelgroep in te schatten.', 'event', 'e7777777-7777-7777-7777-777777777701'),
  ('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaa902', '99999999-9999-9999-9999-999999999903', 2, 'Kies je focuscollectie', 'Selecteer een beperkt aanbod voor een duidelijke stand.', 'creator', 'c2222222-2222-2222-2222-222222222201'),
  ('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaa903', '99999999-9999-9999-9999-999999999903', 3, 'Test een snelle live demo', 'Gebruik een korte workshopflow als attractie op de stand.', 'workshop', '55555555-5555-5555-5555-555555555503')
ON CONFLICT (project_id, step_order) DO UPDATE SET
  title = EXCLUDED.title,
  instruction = EXCLUDED.instruction,
  related_entity_type = EXCLUDED.related_entity_type,
  related_entity_id = EXCLUDED.related_entity_id;

-- Learning paths (at least one per top domain)
INSERT INTO public.learning_paths (
  id,
  domain_id,
  slug,
  title,
  short_description,
  difficulty_level,
  estimated_duration_minutes,
  is_featured,
  is_active,
  sort_order
) VALUES
  ('b1111111-1111-4111-8111-111111111101', 'd1111111-1111-1111-1111-111111111101', 'crochet-starterspad', 'Crochet starterspad', 'Van eerste steek tot je eerste afgewerkt project.', 'beginner', 180, true, true, 1),
  ('b1111111-1111-4111-8111-111111111102', 'd1111111-1111-1111-1111-111111111102', 'knitting-basis', 'Breien basistraject', 'Leer de basistechnieken en werk naar een eenvoudig eindresultaat.', 'beginner', 200, true, true, 1),
  ('b1111111-1111-4111-8111-111111111103', 'd1111111-1111-1111-1111-111111111103', 'kaart-ontwerp-flow', 'Kaarten maken: ontwerpflow', 'Van inspiratie tot een eerste collectie handgemaakte kaarten.', 'beginner', 150, false, true, 1),
  ('b1111111-1111-4111-8111-111111111104', 'd1111111-1111-1111-1111-111111111104', 'naaien-startflow', 'Naaien startflow', 'Een pragmatisch traject om je eerste naaiproject te plannen.', 'beginner', 210, false, true, 1),
  ('b1111111-1111-4111-8111-111111111105', 'd1111111-1111-1111-1111-111111111105', 'sieraden-beginner', 'Sieraden maken voor beginners', 'Werk met een startset en leer je eerste eenvoudige ontwerpen.', 'beginner', 170, false, true, 1),
  ('b1111111-1111-4111-8111-111111111106', 'd1111111-1111-1111-1111-111111111106', 'scrapbook-opbouw', 'Scrapbooking opbouwtraject', 'Structuur voor je eerste scrapbook-project.', 'beginner', 160, false, true, 1),
  ('b1111111-1111-4111-8111-111111111107', 'd1111111-1111-1111-1111-111111111107', 'pottery-van-start-tot-mok', 'Keramiek: van start tot mok', 'Start met klei en werk stapsgewijs naar je eerste mok.', 'beginner', 240, true, true, 1),
  ('b1111111-1111-4111-8111-111111111108', 'd1111111-1111-1111-1111-111111111108', 'diy-project-flow', 'DIY project flow', 'Bouw een gestructureerde aanpak voor je volgende DIY-project.', 'intermediate', 220, false, true, 1)
ON CONFLICT (domain_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  short_description = EXCLUDED.short_description,
  difficulty_level = EXCLUDED.difficulty_level,
  estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
  is_featured = EXCLUDED.is_featured,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- Learning path steps (ordered and linked to existing article/workshop/product/project)
INSERT INTO public.learning_path_steps (
  id,
  learning_path_id,
  step_order,
  title,
  instruction,
  related_entity_type,
  related_entity_id,
  estimated_minutes,
  is_required
) VALUES
  ('b2222222-2222-4222-8222-222222221101', 'b1111111-1111-4111-8111-111111111101', 1, 'Open je eerste crochet project', 'Gebruik het project als kapstok voor je leerdoelen.', 'project', '99999999-9999-9999-9999-999999999901', 20, true),
  ('b2222222-2222-4222-8222-222222221102', 'b1111111-1111-4111-8111-111111111101', 2, 'Voorzie je materialen', 'Start met een compact wolpakket zodat je direct kan oefenen.', 'product', '44444444-4444-4444-4444-444444444402', 15, true),
  ('b2222222-2222-4222-8222-222222221103', 'b1111111-1111-4111-8111-111111111101', 3, 'Plan je eerste workshop', 'Boek een live sessie om techniekfouten snel te corrigeren.', 'workshop', '55555555-5555-5555-5555-555555555501', 45, true),

  ('b2222222-2222-4222-8222-222222221201', 'b1111111-1111-4111-8111-111111111102', 1, 'Kick-off met een eenvoudig project', 'Werk vanuit een bestaand beginnerstraject.', 'project', '99999999-9999-9999-9999-999999999901', 20, true),
  ('b2222222-2222-4222-8222-222222221202', 'b1111111-1111-4111-8111-111111111102', 2, 'Lees de basisuitleg', 'Gebruik de uitleg als checklist voor techniek en tempo.', 'article', 'a8888888-8888-8888-8888-888888888801', 20, true),
  ('b2222222-2222-4222-8222-222222221203', 'b1111111-1111-4111-8111-111111111102', 3, 'Rond af met een klein productdoel', 'Kies een compact item dat je volledig kan afwerken.', 'product', '44444444-4444-4444-4444-444444444403', 30, true),

  ('b2222222-2222-4222-8222-222222221301', 'b1111111-1111-4111-8111-111111111103', 1, 'Verzamel inspiratie', 'Start met actuele voorbeelden en noteer je stijlkeuzes.', 'article', 'a8888888-8888-8888-8888-888888888803', 20, true),
  ('b2222222-2222-4222-8222-222222221302', 'b1111111-1111-4111-8111-111111111103', 2, 'Gebruik een projecttemplate', 'Volg een bestaand projectformat voor structuur.', 'project', '99999999-9999-9999-9999-999999999903', 25, true),
  ('b2222222-2222-4222-8222-222222221303', 'b1111111-1111-4111-8111-111111111103', 3, 'Maak een materiaalkeuze', 'Kies een materiaalset die je stijl ondersteunt.', 'product', '44444444-4444-4444-4444-444444444406', 15, true),

  ('b2222222-2222-4222-8222-222222221401', 'b1111111-1111-4111-8111-111111111104', 1, 'Plan je naaiproject', 'Gebruik een projectflow om scope en timing scherp te zetten.', 'project', '99999999-9999-9999-9999-999999999903', 25, true),
  ('b2222222-2222-4222-8222-222222221402', 'b1111111-1111-4111-8111-111111111104', 2, 'Oefen met een begeleide sessie', 'Korte workshop om fouten vroeg te detecteren.', 'workshop', '55555555-5555-5555-5555-555555555503', 45, true),
  ('b2222222-2222-4222-8222-222222221403', 'b1111111-1111-4111-8111-111111111104', 3, 'Gebruik een referentieartikel', 'Check het artikel voor praktische uitvoeringstips.', 'article', 'a8888888-8888-8888-8888-888888888803', 20, true),

  ('b2222222-2222-4222-8222-222222221501', 'b1111111-1111-4111-8111-111111111105', 1, 'Start met een basiskit', 'Kies een starterskit om meteen te bouwen.', 'product', '44444444-4444-4444-4444-444444444406', 15, true),
  ('b2222222-2222-4222-8222-222222221502', 'b1111111-1111-4111-8111-111111111105', 2, 'Gebruik een projectstructuur', 'Werk in iteraties met een duidelijk projectkader.', 'project', '99999999-9999-9999-9999-999999999903', 20, true),
  ('b2222222-2222-4222-8222-222222221503', 'b1111111-1111-4111-8111-111111111105', 3, 'Lees marktinspiratie', 'Laat je inspireren door voorbeelden en trends.', 'article', 'a8888888-8888-8888-8888-888888888803', 20, true),

  ('b2222222-2222-4222-8222-222222221601', 'b1111111-1111-4111-8111-111111111106', 1, 'Onderzoek voorbeelden', 'Analyseer voorbeelden en kies je verhaallijn.', 'article', 'a8888888-8888-8888-8888-888888888803', 20, true),
  ('b2222222-2222-4222-8222-222222221602', 'b1111111-1111-4111-8111-111111111106', 2, 'Werk met projectkaders', 'Gebruik een traject met duidelijke milestones.', 'project', '99999999-9999-9999-9999-999999999903', 20, true),
  ('b2222222-2222-4222-8222-222222221603', 'b1111111-1111-4111-8111-111111111106', 3, 'Kies je materiaalset', 'Selecteer materialen die passen bij je lay-outplan.', 'product', '44444444-4444-4444-4444-444444444402', 15, true),

  ('b2222222-2222-4222-8222-222222221701', 'b1111111-1111-4111-8111-111111111107', 1, 'Open het keramiek traject', 'Volg het bestaande traject als basisroute.', 'project', '99999999-9999-9999-9999-999999999902', 20, true),
  ('b2222222-2222-4222-8222-222222221702', 'b1111111-1111-4111-8111-111111111107', 2, 'Plan draaischijf begeleiding', 'Boek een sessie om techniek onder begeleiding te leren.', 'workshop', '55555555-5555-5555-5555-555555555502', 50, true),
  ('b2222222-2222-4222-8222-222222221703', 'b1111111-1111-4111-8111-111111111107', 3, 'Werk thuis verder met gids', 'Gebruik het artikel als nabegeleiding.', 'article', 'a8888888-8888-8888-8888-888888888802', 25, true),

  ('b2222222-2222-4222-8222-222222221801', 'b1111111-1111-4111-8111-111111111108', 1, 'Definieer je DIY-scope', 'Start vanuit een project met duidelijke randvoorwaarden.', 'project', '99999999-9999-9999-9999-999999999903', 20, true),
  ('b2222222-2222-4222-8222-222222221802', 'b1111111-1111-4111-8111-111111111108', 2, 'Test je flow live', 'Gebruik een workshop om je aanpak te valideren.', 'workshop', '55555555-5555-5555-5555-555555555503', 45, true),
  ('b2222222-2222-4222-8222-222222221803', 'b1111111-1111-4111-8111-111111111108', 3, 'Documenteer je werkwijze', 'Leg je stappen vast met inspiratie uit het artikel.', 'article', 'a8888888-8888-8888-8888-888888888803', 20, true)
ON CONFLICT (learning_path_id, step_order) DO UPDATE SET
  title = EXCLUDED.title,
  instruction = EXCLUDED.instruction,
  related_entity_type = EXCLUDED.related_entity_type,
  related_entity_id = EXCLUDED.related_entity_id,
  estimated_minutes = EXCLUDED.estimated_minutes,
  is_required = EXCLUDED.is_required;

-- Entity links
INSERT INTO public.entity_links (source_entity_type, source_entity_id, target_entity_type, target_entity_id, relation_type, sort_order) VALUES
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'creator', 'c2222222-2222-2222-2222-222222222201', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'creator', 'c2222222-2222-2222-2222-222222222202', 'features', 2),
  ('domain', 'd1111111-1111-1111-1111-111111111107', 'creator', 'c2222222-2222-2222-2222-222222222203', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'project', '99999999-9999-9999-9999-999999999901', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111107', 'project', '99999999-9999-9999-9999-999999999902', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'project', '99999999-9999-9999-9999-999999999903', 'features', 2),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'product', '44444444-4444-4444-4444-444444444401', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'product', '44444444-4444-4444-4444-444444444402', 'features', 2),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'workshop', '55555555-5555-5555-5555-555555555501', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'workshop', '55555555-5555-5555-5555-555555555503', 'features', 2),
  ('domain', 'd1111111-1111-1111-1111-111111111107', 'workshop', '55555555-5555-5555-5555-555555555502', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'article', 'a8888888-8888-8888-8888-888888888801', 'features', 1),
  ('domain', 'd1111111-1111-1111-1111-111111111101', 'article', 'a8888888-8888-8888-8888-888888888803', 'features', 2),
  ('domain', 'd1111111-1111-1111-1111-111111111107', 'article', 'a8888888-8888-8888-8888-888888888802', 'features', 1),
  ('creator', 'c2222222-2222-2222-2222-222222222201', 'product', '44444444-4444-4444-4444-444444444401', 'sells', 1),
  ('creator', 'c2222222-2222-2222-2222-222222222201', 'product', '44444444-4444-4444-4444-444444444403', 'sells', 2),
  ('creator', 'c2222222-2222-2222-2222-222222222201', 'product', '44444444-4444-4444-4444-444444444404', 'sells', 3),
  ('creator', 'c2222222-2222-2222-2222-222222222201', 'article', 'a8888888-8888-8888-8888-888888888801', 'publishes', 1),
  ('creator', 'c2222222-2222-2222-2222-222222222203', 'article', 'a8888888-8888-8888-8888-888888888802', 'publishes', 1),
  ('creator', 'c2222222-2222-2222-2222-222222222203', 'article', 'a8888888-8888-8888-8888-888888888803', 'publishes', 2),
  ('creator', 'c2222222-2222-2222-2222-222222222202', 'product', '44444444-4444-4444-4444-444444444402', 'sells', 1),
  ('creator', 'c2222222-2222-2222-2222-222222222202', 'product', '44444444-4444-4444-4444-444444444406', 'sells', 2),
  ('creator', 'c2222222-2222-2222-2222-222222222203', 'product', '44444444-4444-4444-4444-444444444405', 'sells', 1),
  ('product', '44444444-4444-4444-4444-444444444401', 'workshop', '55555555-5555-5555-5555-555555555501', 'related', 1),
  ('product', '44444444-4444-4444-4444-444444444401', 'workshop', '55555555-5555-5555-5555-555555555503', 'related', 2),
  ('product', '44444444-4444-4444-4444-444444444405', 'workshop', '55555555-5555-5555-5555-555555555502', 'related', 1),
  ('product', '44444444-4444-4444-4444-444444444401', 'article', 'a8888888-8888-8888-8888-888888888801', 'related', 1),
  ('product', '44444444-4444-4444-4444-444444444405', 'article', 'a8888888-8888-8888-8888-888888888802', 'related', 1),
  ('workshop', '55555555-5555-5555-5555-555555555501', 'product', '44444444-4444-4444-4444-444444444401', 'uses', 1),
  ('workshop', '55555555-5555-5555-5555-555555555501', 'product', '44444444-4444-4444-4444-444444444402', 'uses', 2),
  ('workshop', '55555555-5555-5555-5555-555555555502', 'product', '44444444-4444-4444-4444-444444444405', 'uses', 1),
  ('workshop', '55555555-5555-5555-5555-555555555501', 'article', 'a8888888-8888-8888-8888-888888888801', 'related', 1),
  ('workshop', '55555555-5555-5555-5555-555555555502', 'article', 'a8888888-8888-8888-8888-888888888802', 'related', 1),
  ('event', 'e7777777-7777-7777-7777-777777777701', 'product', '44444444-4444-4444-4444-444444444401', 'features', 1),
  ('event', 'e7777777-7777-7777-7777-777777777701', 'product', '44444444-4444-4444-4444-444444444405', 'features', 2),
  ('event', 'e7777777-7777-7777-7777-777777777702', 'product', '44444444-4444-4444-4444-444444444402', 'features', 1),
  ('event', 'e7777777-7777-7777-7777-777777777701', 'article', 'a8888888-8888-8888-8888-888888888803', 'features', 1),
  ('project', '99999999-9999-9999-9999-999999999901', 'product', '44444444-4444-4444-4444-444444444402', 'requires', 1),
  ('project', '99999999-9999-9999-9999-999999999901', 'workshop', '55555555-5555-5555-5555-555555555501', 'includes', 1),
  ('project', '99999999-9999-9999-9999-999999999901', 'article', 'a8888888-8888-8888-8888-888888888801', 'inspires', 1),
  ('project', '99999999-9999-9999-9999-999999999901', 'creator', 'c2222222-2222-2222-2222-222222222201', 'led_by', 1),
  ('project', '99999999-9999-9999-9999-999999999902', 'product', '44444444-4444-4444-4444-444444444405', 'requires', 1),
  ('project', '99999999-9999-9999-9999-999999999902', 'workshop', '55555555-5555-5555-5555-555555555502', 'includes', 1),
  ('project', '99999999-9999-9999-9999-999999999902', 'article', 'a8888888-8888-8888-8888-888888888802', 'inspires', 1),
  ('project', '99999999-9999-9999-9999-999999999903', 'event', 'e7777777-7777-7777-7777-777777777701', 'prepares_for', 1),
  ('project', '99999999-9999-9999-9999-999999999903', 'workshop', '55555555-5555-5555-5555-555555555503', 'includes', 1),
  ('project', '99999999-9999-9999-9999-999999999903', 'creator', 'c2222222-2222-2222-2222-222222222201', 'mentions', 1),
  ('workshop', '55555555-5555-5555-5555-555555555501', 'project', '99999999-9999-9999-9999-999999999901', 'part_of_project', 1),
  ('article', 'a8888888-8888-8888-8888-888888888801', 'project', '99999999-9999-9999-9999-999999999901', 'part_of_project', 1),
  ('event', 'e7777777-7777-7777-7777-777777777701', 'project', '99999999-9999-9999-9999-999999999903', 'part_of_project', 1),
  ('article', 'a8888888-8888-8888-8888-888888888801', 'product', '44444444-4444-4444-4444-444444444402', 'recommends', 1),
  ('article', 'a8888888-8888-8888-8888-888888888801', 'workshop', '55555555-5555-5555-5555-555555555501', 'recommends', 1),
  ('article', 'a8888888-8888-8888-8888-888888888801', 'creator', 'c2222222-2222-2222-2222-222222222201', 'mentions', 1),
  ('article', 'a8888888-8888-8888-8888-888888888803', 'event', 'e7777777-7777-7777-7777-777777777701', 'mentions', 1);
