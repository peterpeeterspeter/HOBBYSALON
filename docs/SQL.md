-- =========================================================
-- HOBBYSALON PLATFORM SCHEMA V1
-- Postgres / Supabase
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- ENUM-LIKE CHECKS VIA TEXT FIELDS
-- Kept flexible for speed and easier iteration
-- =========================================================

-- =========================================================
-- TIMESTAMP HELPER
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- DOMAINS
-- Creative verticals: crochet, knitting, pottery, ...
-- =========================================================

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text,
  long_description text,
  icon_url text,
  hero_image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_domains_updated_at
before update on public.domains
for each row execute function public.set_updated_at();

-- =========================================================
-- CREATORS
-- Makers / suppliers / workshop hosts / content creators
-- =========================================================

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, -- optional link to auth.users
  slug text not null unique,
  display_name text not null,
  business_name text,
  bio text,
  avatar_url text,
  banner_url text,
  email text,
  phone text,
  website_url text,
  instagram_url text,
  facebook_url text,
  city text,
  postal_code text,
  country_code text,
  creator_types text[] not null default '{}',
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  accepts_bookings boolean not null default false,
  accepts_marketplace_orders boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creators_creator_types_check check (
    creator_types <@ array[
      'maker',
      'workshopgever',
      'supplier',
      'content_creator',
      'organizer'
    ]::text[]
  )
);

create index if not exists idx_creators_user_id on public.creators(user_id);
create index if not exists idx_creators_city on public.creators(city);
create index if not exists idx_creators_featured on public.creators(is_featured);

create trigger trg_creators_updated_at
before update on public.creators
for each row execute function public.set_updated_at();

-- =========================================================
-- CREATOR_DOMAINS
-- Many-to-many between creators and domains
-- =========================================================

create table if not exists public.creator_domains (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (creator_id, domain_id)
);

create index if not exists idx_creator_domains_creator_id on public.creator_domains(creator_id);
create index if not exists idx_creator_domains_domain_id on public.creator_domains(domain_id);

-- =========================================================
-- PRODUCT CATEGORIES
-- Per domain
-- =========================================================

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete set null,
  parent_id uuid references public.product_categories(id) on delete set null,
  slug text not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain_id, slug)
);

create index if not exists idx_product_categories_domain_id on public.product_categories(domain_id);
create index if not exists idx_product_categories_parent_id on public.product_categories(parent_id);

create trigger trg_product_categories_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

-- =========================================================
-- PRODUCTS
-- Platform owns: display/discovery metadata.
-- Medusa owns: price, inventory, variants, SKU, weight, shipping.
-- Linked via medusa_product_id.
-- Types: supply | handmade | event_listing | event_ticket | workshop_ticket | workshop_kit
-- =========================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  medusa_product_id text unique,
  creator_id uuid not null references public.creators(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  category_id uuid references public.product_categories(id) on delete set null,
  slug text not null unique,
  title text not null,
  short_description text,
  description text,
  product_type text not null,
  status text not null default 'draft',
  condition_type text,
  personalization_available boolean not null default false,
  estimated_dispatch_days integer,
  featured_image_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_product_type_check check (
    product_type in ('supply','handmade','event_listing','event_ticket','workshop_ticket','workshop_kit')
  ),
  constraint products_status_check check (
    status in ('draft','active','archived')
  ),
  constraint products_condition_type_check check (
    condition_type is null or
    condition_type in ('new','handmade','made_to_order','used')
  )
);

create index if not exists idx_products_medusa_product_id on public.products(medusa_product_id);
create index if not exists idx_products_creator_id on public.products(creator_id);
create index if not exists idx_products_domain_id on public.products(domain_id);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_product_type on public.products(product_type);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_is_featured on public.products(is_featured);
create index if not exists idx_products_is_active on public.products(is_active);

create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- =========================================================
-- PRODUCT IMAGES
-- =========================================================

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_images_product_id on public.product_images(product_id);

-- =========================================================
-- PRODUCT ATTRIBUTES
-- Flexible metadata
-- =========================================================

create table if not exists public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_key text not null,
  attribute_value text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_attributes_product_id on public.product_attributes(product_id);
create index if not exists idx_product_attributes_key on public.product_attributes(attribute_key);

-- =========================================================
-- WORKSHOPS
-- =========================================================

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  slug text not null unique,
  title text not null,
  short_description text,
  description text,
  format_type text not null default 'physical',
  difficulty_level text not null default 'beginner',
  price_cents integer not null default 0,
  currency_code text not null default 'EUR',
  duration_minutes integer,
  capacity integer,
  min_participants integer,
  featured_image_url text,
  booking_mode text not null default 'request',
  booking_url text,
  location_name text,
  address_line_1 text,
  city text,
  postal_code text,
  country_code text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshops_format_type_check check (
    format_type in ('physical','online','hybrid')
  ),
  constraint workshops_difficulty_level_check check (
    difficulty_level in ('beginner','intermediate','advanced')
  ),
  constraint workshops_booking_mode_check check (
    booking_mode in ('request','external_link','internal_booking')
  )
);

create index if not exists idx_workshops_creator_id on public.workshops(creator_id);
create index if not exists idx_workshops_domain_id on public.workshops(domain_id);
create index if not exists idx_workshops_city on public.workshops(city);
create index if not exists idx_workshops_is_featured on public.workshops(is_featured);
create index if not exists idx_workshops_is_active on public.workshops(is_active);

create trigger trg_workshops_updated_at
before update on public.workshops
for each row execute function public.set_updated_at();

-- =========================================================
-- WORKSHOP SESSIONS
-- =========================================================

create table if not exists public.workshop_sessions (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer,
  remaining_spots integer,
  is_cancelled boolean not null default false,
  booking_status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_sessions_booking_status_check check (
    booking_status in ('open','sold_out','closed')
  )
);

create index if not exists idx_workshop_sessions_workshop_id on public.workshop_sessions(workshop_id);
create index if not exists idx_workshop_sessions_starts_at on public.workshop_sessions(starts_at);

create trigger trg_workshop_sessions_updated_at
before update on public.workshop_sessions
for each row execute function public.set_updated_at();

-- =========================================================
-- WORKSHOP REQUIRED PRODUCTS
-- Links workshop to products / kits
-- =========================================================

create table if not exists public.workshop_required_products (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  is_required boolean not null default false,
  is_bundle_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workshop_id, product_id)
);

create index if not exists idx_workshop_required_products_workshop_id on public.workshop_required_products(workshop_id);
create index if not exists idx_workshop_required_products_product_id on public.workshop_required_products(product_id);

-- =========================================================
-- EVENTS
-- Handmade markets, fairs, popups, workshop days
-- =========================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text,
  description text,
  event_type text not null,
  organizer_creator_id uuid references public.creators(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_name text,
  address_line_1 text,
  city text,
  postal_code text,
  country_code text,
  latitude numeric,
  longitude numeric,
  ticketing_mode text not null default 'none',
  ticket_url text,
  ticket_price_cents integer,
  currency_code text default 'EUR',
  featured_image_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_event_type_check check (
    event_type in ('handmade_market','hobby_fair','pop_up','open_atelier','workshop_day')
  ),
  constraint events_ticketing_mode_check check (
    ticketing_mode in ('none','external_link','internal_ticket')
  )
);

create index if not exists idx_events_organizer_creator_id on public.events(organizer_creator_id);
create index if not exists idx_events_city on public.events(city);
create index if not exists idx_events_starts_at on public.events(starts_at);
create index if not exists idx_events_is_featured on public.events(is_featured);
create index if not exists idx_events_is_active on public.events(is_active);

create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- =========================================================
-- EVENT DOMAINS
-- =========================================================

create table if not exists public.event_domains (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, domain_id)
);

create index if not exists idx_event_domains_event_id on public.event_domains(event_id);
create index if not exists idx_event_domains_domain_id on public.event_domains(domain_id);

-- =========================================================
-- EVENT CREATORS
-- Vendors / workshop hosts / speakers / organizers
-- =========================================================

create table if not exists public.event_creators (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  role text not null default 'vendor',
  created_at timestamptz not null default now(),
  constraint event_creators_role_check check (
    role in ('vendor','workshop_host','speaker','organizer')
  ),
  unique (event_id, creator_id, role)
);

create index if not exists idx_event_creators_event_id on public.event_creators(event_id);
create index if not exists idx_event_creators_creator_id on public.event_creators(creator_id);

-- =========================================================
-- EVENT WORKSHOPS
-- =========================================================

create table if not exists public.event_workshops (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, workshop_id)
);

create index if not exists idx_event_workshops_event_id on public.event_workshops(event_id);
create index if not exists idx_event_workshops_workshop_id on public.event_workshops(workshop_id);

-- =========================================================
-- ARTICLES
-- Tutorials / guides / inspiration / interviews / patterns
-- =========================================================

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_creator_id uuid references public.creators(id) on delete set null,
  domain_id uuid references public.domains(id) on delete set null,
  slug text not null unique,
  title text not null,
  excerpt text,
  body_markdown text,
  featured_image_url text,
  article_type text not null default 'tutorial',
  reading_time_minutes integer,
  published_at timestamptz,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_article_type_check check (
    article_type in ('tutorial','guide','inspiration','interview','pattern')
  )
);

create index if not exists idx_articles_author_creator_id on public.articles(author_creator_id);
create index if not exists idx_articles_domain_id on public.articles(domain_id);
create index if not exists idx_articles_published_at on public.articles(published_at);
create index if not exists idx_articles_is_published on public.articles(is_published);
create index if not exists idx_articles_is_featured on public.articles(is_featured);

create trigger trg_articles_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

-- =========================================================
-- ARTICLE DOMAINS
-- Optional many-to-many
-- =========================================================

create table if not exists public.article_domains (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (article_id, domain_id)
);

create index if not exists idx_article_domains_article_id on public.article_domains(article_id);
create index if not exists idx_article_domains_domain_id on public.article_domains(domain_id);

-- =========================================================
-- ENTITY LINKS
-- Core graph table
-- =========================================================

create table if not exists public.entity_links (
  id uuid primary key default gen_random_uuid(),
  source_entity_type text not null,
  source_entity_id uuid not null,
  target_entity_type text not null,
  target_entity_id uuid not null,
  relation_type text not null,
  weight integer not null default 1,
  sort_order integer,
  created_at timestamptz not null default now(),
  constraint entity_links_source_entity_type_check check (
    source_entity_type in ('domain','creator','product','workshop','event','article')
  ),
  constraint entity_links_target_entity_type_check check (
    target_entity_type in ('domain','creator','product','workshop','event','article')
  )
);

create index if not exists idx_entity_links_source on public.entity_links(source_entity_type, source_entity_id);
create index if not exists idx_entity_links_target on public.entity_links(target_entity_type, target_entity_id);
create index if not exists idx_entity_links_relation_type on public.entity_links(relation_type);

-- =========================================================
-- FAVORITES
-- =========================================================

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  constraint favorites_entity_type_check check (
    entity_type in ('domain','creator','product','workshop','event','article')
  ),
  unique (user_id, entity_type, entity_id)
);

create index if not exists idx_favorites_user_id on public.favorites(user_id);

-- =========================================================
-- REVIEWS
-- One review can point to one target type
-- =========================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  creator_id uuid references public.creators(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  workshop_id uuid references public.workshops(id) on delete cascade,
  rating integer not null,
  title text,
  body text,
  created_at timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_single_target_check check (
    ((creator_id is not null)::int +
     (product_id is not null)::int +
     (workshop_id is not null)::int) = 1
  )
);

create index if not exists idx_reviews_creator_id on public.reviews(creator_id);
create index if not exists idx_reviews_product_id on public.reviews(product_id);
create index if not exists idx_reviews_workshop_id on public.reviews(workshop_id);

-- =========================================================
-- SUBSCRIBERS
-- Marketing / legacy mailing list / segmentation
-- =========================================================

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  source text not null default 'legacy_import',
  status text not null default 'active',
  preferred_domains text[] not null default '{}',
  interested_in_workshops boolean not null default false,
  interested_in_handmade boolean not null default false,
  interested_in_supplies boolean not null default false,
  preferred_city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscribers_status_check check (
    status in ('active','unsubscribed','bounced')
  )
);

create index if not exists idx_subscribers_status on public.subscribers(status);
create index if not exists idx_subscribers_preferred_city on public.subscribers(preferred_city);

create trigger trg_subscribers_updated_at
before update on public.subscribers
for each row execute function public.set_updated_at();

-- =========================================================
-- SURVEY SEGMENTS
-- Fine-grained interest scores from legacy survey / forms
-- =========================================================

create table if not exists public.survey_segments (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  interest_type text not null,
  score integer not null default 1,
  created_at timestamptz not null default now(),
  constraint survey_segments_interest_type_check check (
    interest_type in ('workshop','supply','handmade','event','article')
  )
);

create index if not exists idx_survey_segments_subscriber_id on public.survey_segments(subscriber_id);
create index if not exists idx_survey_segments_domain_id on public.survey_segments(domain_id);
create index if not exists idx_survey_segments_interest_type on public.survey_segments(interest_type);

-- =========================================================
-- OPTIONAL: LIGHTWEIGHT INTERNAL BOOKING REQUESTS
-- Useful before full booking engine
-- =========================================================

create table if not exists public.workshop_booking_requests (
  id uuid primary key default gen_random_uuid(),
  workshop_session_id uuid references public.workshop_sessions(id) on delete set null,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_booking_requests_status_check check (
    status in ('new','contacted','confirmed','cancelled')
  )
);

create index if not exists idx_workshop_booking_requests_workshop_id on public.workshop_booking_requests(workshop_id);
create index if not exists idx_workshop_booking_requests_creator_id on public.workshop_booking_requests(creator_id);
create index if not exists idx_workshop_booking_requests_status on public.workshop_booking_requests(status);

create trigger trg_workshop_booking_requests_updated_at
before update on public.workshop_booking_requests
for each row execute function public.set_updated_at();