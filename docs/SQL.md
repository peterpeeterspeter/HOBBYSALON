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
  price_cents integer,
  currency_code text,
  stock_mode text,
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
  ),
  constraint products_stock_mode_check check (
    stock_mode is null or
    stock_mode in ('made_to_order','in_stock','contact')
  ),
  constraint products_currency_code_check check (
    currency_code is null or char_length(currency_code) = 3
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
  difficulty_level text,
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
-- PROJECTS
-- Connected hobby projects combining content, commerce and bookings
-- =========================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  created_by_user_id uuid,
  title text not null,
  short_description text,
  description text,
  difficulty_level text not null default 'beginner',
  estimated_duration_minutes integer,
  budget_min_cents integer,
  budget_max_cents integer,
  currency_code text not null default 'EUR',
  featured_image_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_difficulty_level_check check (
    difficulty_level in ('beginner','intermediate','advanced')
  ),
  constraint projects_budget_range_check check (
    budget_min_cents is null or
    budget_max_cents is null or
    budget_min_cents <= budget_max_cents
  )
);

create index if not exists idx_projects_is_featured on public.projects(is_featured);
create index if not exists idx_projects_is_active on public.projects(is_active);
create index if not exists idx_projects_difficulty_level on public.projects(difficulty_level);
create index if not exists idx_projects_created_by_user on public.projects(created_by_user_id);

create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- =========================================================
-- PROJECT DOMAINS
-- Many-to-many relation between projects and domains
-- =========================================================

create table if not exists public.project_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, domain_id)
);

create index if not exists idx_project_domains_project_id on public.project_domains(project_id);
create index if not exists idx_project_domains_domain_id on public.project_domains(domain_id);

-- =========================================================
-- PROJECT STEPS
-- Ordered project guidance with optional linked entities
-- =========================================================

create table if not exists public.project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step_order integer not null,
  title text not null,
  instruction text not null,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_steps_related_entity_type_check check (
    related_entity_type is null or
    related_entity_type in ('creator','product','workshop','event','article')
  ),
  unique (project_id, step_order)
);

create index if not exists idx_project_steps_project_id on public.project_steps(project_id);
create index if not exists idx_project_steps_related_entity on public.project_steps(related_entity_type, related_entity_id);

create trigger trg_project_steps_updated_at
before update on public.project_steps
for each row execute function public.set_updated_at();

-- =========================================================
-- PROJECT GALLERY IMAGES
-- Finished creation photos per project
-- =========================================================

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

-- =========================================================
-- PROJECT PRODUCT LINKS
-- Materials used for a project
-- =========================================================

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

-- =========================================================
-- PROJECT SOUGHT MATERIALS
-- Materials users want but not in product catalog (producten gezocht)
-- =========================================================

create table if not exists public.project_sought_materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, title)
);

create index if not exists idx_project_sought_materials_project_id
  on public.project_sought_materials(project_id);

-- =========================================================
-- LEARNING PATHS
-- Beginner -> advanced trajectories per domain
-- =========================================================

create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  slug text not null,
  title text not null,
  short_description text,
  difficulty_level text not null default 'beginner',
  estimated_duration_minutes integer,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_paths_difficulty_level_check check (
    difficulty_level in ('beginner','intermediate','advanced')
  ),
  unique (domain_id, slug)
);

create index if not exists idx_learning_paths_domain_id on public.learning_paths(domain_id);
create index if not exists idx_learning_paths_featured on public.learning_paths(is_featured);
create index if not exists idx_learning_paths_is_active on public.learning_paths(is_active);

create trigger trg_learning_paths_updated_at
before update on public.learning_paths
for each row execute function public.set_updated_at();

create table if not exists public.learning_path_steps (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths(id) on delete cascade,
  step_order integer not null,
  title text not null,
  instruction text,
  related_entity_type text not null,
  related_entity_id uuid not null,
  estimated_minutes integer,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_path_steps_related_entity_type_check check (
    related_entity_type in ('article','workshop','product','project')
  ),
  unique (learning_path_id, step_order)
);

create index if not exists idx_learning_path_steps_learning_path_id on public.learning_path_steps(learning_path_id);
create index if not exists idx_learning_path_steps_related_entity on public.learning_path_steps(related_entity_type, related_entity_id);

create trigger trg_learning_path_steps_updated_at
before update on public.learning_path_steps
for each row execute function public.set_updated_at();

create or replace function public.validate_learning_path_step_entity()
returns trigger
language plpgsql
as $$
declare
  has_target boolean;
begin
  if new.related_entity_type = 'article' then
    select exists(select 1 from public.articles a where a.id = new.related_entity_id and a.is_published = true)
      into has_target;
  elsif new.related_entity_type = 'workshop' then
    select exists(select 1 from public.workshops w where w.id = new.related_entity_id and w.is_active = true)
      into has_target;
  elsif new.related_entity_type = 'product' then
    select exists(select 1 from public.products p where p.id = new.related_entity_id and p.is_active = true and p.status = 'active')
      into has_target;
  elsif new.related_entity_type = 'project' then
    select exists(select 1 from public.projects pr where pr.id = new.related_entity_id and pr.is_active = true)
      into has_target;
  else
    has_target := false;
  end if;

  if not has_target then
    raise exception 'Learning path step verwijst naar onbestaande %: %', new.related_entity_type, new.related_entity_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_learning_path_step_entity on public.learning_path_steps;
create trigger trg_validate_learning_path_step_entity
before insert or update on public.learning_path_steps
for each row execute function public.validate_learning_path_step_entity();

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
    source_entity_type in ('domain','creator','product','workshop','event','article','project')
  ),
  constraint entity_links_target_entity_type_check check (
    target_entity_type in ('domain','creator','product','workshop','event','article','project')
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
    entity_type in ('domain','creator','product','workshop','event','article','project')
  ),
  unique (user_id, entity_type, entity_id)
);

create index if not exists idx_favorites_user_id on public.favorites(user_id);

-- =========================================================
-- HOBBY PASSPORT
-- User profile progress, badges, and activity stream
-- =========================================================

create table if not exists public.user_hobby_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  points_total integer not null default 0,
  completed_activity_count integer not null default 0,
  favorite_count integer not null default 0,
  preferred_domain_ids uuid[] not null default '{}',
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_hobby_profiles_user_id on public.user_hobby_profiles(user_id);
create index if not exists idx_user_hobby_profiles_last_activity_at on public.user_hobby_profiles(last_activity_at);

create trigger trg_user_hobby_profiles_updated_at
before update on public.user_hobby_profiles
for each row execute function public.set_updated_at();

-- =========================================================
-- USER REGISTRATION PROFILE
-- Interests, locality, and role activation metadata
-- =========================================================

create table if not exists public.user_preferences (
  user_id uuid primary key,
  postal_code text,
  city text,
  country_code text not null default 'BE',
  radius_km integer not null default 25,
  preferred_domain_ids uuid[] not null default '{}',
  interest_types text[] not null default '{}',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_radius_km_check check (
    radius_km between 5 and 200
  ),
  constraint user_preferences_interest_types_check check (
    interest_types <@ array['workshop','supply','handmade','event','article']::text[]
  )
);

create index if not exists idx_user_preferences_country_code on public.user_preferences(country_code);
create index if not exists idx_user_preferences_postal_code on public.user_preferences(postal_code);

create trigger trg_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create table if not exists public.user_account_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  created_at timestamptz not null default now(),
  constraint user_account_roles_role_check check (
    role in ('user','creator','merchant','workshop_host','organizer')
  ),
  unique (user_id, role)
);

create index if not exists idx_user_account_roles_user_id on public.user_account_roles(user_id);
create index if not exists idx_user_account_roles_role on public.user_account_roles(role);

create table if not exists public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  reviewer_user_id uuid,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_requests_role_check check (
    role in ('merchant','workshop_host','organizer')
  ),
  constraint role_requests_status_check check (
    status in ('pending','approved','rejected','withdrawn')
  )
);

create unique index if not exists idx_role_requests_one_pending_per_user_role
  on public.role_requests(user_id, role)
  where status = 'pending';

create index if not exists idx_role_requests_status_created
  on public.role_requests(status, created_at asc);

create table if not exists public.user_seller_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  seller_id text not null,
  seller_type text not null,
  created_at timestamptz not null default now(),
  constraint user_seller_links_seller_type_check check (
    seller_type in ('creator','merchant')
  ),
  unique (user_id, seller_type),
  unique (seller_id)
);

create index if not exists idx_user_seller_links_user_id on public.user_seller_links(user_id);
create index if not exists idx_user_seller_links_seller_id on public.user_seller_links(seller_id);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  badge_key text not null,
  badge_name text not null,
  badge_description text,
  level integer not null default 1,
  progress_value integer not null default 0,
  progress_target integer not null default 1,
  unlocked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index if not exists idx_user_badges_user_id on public.user_badges(user_id);
create index if not exists idx_user_badges_badge_key on public.user_badges(badge_key);
create index if not exists idx_user_badges_unlocked_at on public.user_badges(unlocked_at);

create trigger trg_user_badges_updated_at
before update on public.user_badges
for each row execute function public.set_updated_at();

create table if not exists public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_name text not null,
  source text not null default 'storefront',
  path text,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_activity_log_user_id on public.user_activity_log(user_id);
create index if not exists idx_user_activity_log_event_name on public.user_activity_log(event_name);
create index if not exists idx_user_activity_log_occurred_at on public.user_activity_log(occurred_at);

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

-- =========================================================
-- COMMERCIAL PLANS
-- Subscription tiers per segment (workshop, maker, supplier, organizer)
-- =========================================================

create table if not exists public.commercial_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  segment text not null,
  name text not null,
  price_cents integer not null default 0,
  currency_code text not null default 'EUR',
  billing_period text not null,
  listing_limit integer,
  product_limit integer,
  external_links_allowed boolean not null default false,
  featured_allowed boolean not null default false,
  video_allowed boolean not null default false,
  analytics_allowed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_plans_segment_check check (
    segment in ('workshop', 'maker', 'supplier', 'organizer')
  ),
  constraint commercial_plans_billing_period_check check (
    billing_period in ('monthly', 'yearly', 'one_time')
  )
);

create table if not exists public.creator_plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  plan_id uuid not null references public.commercial_plans(id) on delete restrict,
  status text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  external_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_plan_subscriptions_status_check check (
    status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')
  )
);

create table if not exists public.event_plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  plan_id uuid not null references public.commercial_plans(id) on delete restrict,
  status text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  external_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_plan_subscriptions_status_check check (
    status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')
  )
);

-- =========================================================
-- LISTING CREDITS (makers)
-- =========================================================

create table if not exists public.listing_credit_wallets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators(id) on delete cascade,
  balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_credit_wallets_balance_check check (balance >= 0)
);

create table if not exists public.listing_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  amount integer not null,
  reason text not null,
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.listing_credit_products (
  id uuid primary key default gen_random_uuid(),
  pack_code text not null unique,
  name text not null,
  credits integer not null,
  price_cents integer not null,
  currency_code text not null default 'EUR',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================
-- VISIBILITY BOOSTS
-- =========================================================

create table if not exists public.visibility_boosts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  boost_type text not null,
  source text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  boost_score integer not null default 100,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- =========================================================
-- EVENT VENDOR INQUIRIES
-- =========================================================

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
  updated_at timestamptz not null default now()
);
