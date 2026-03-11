export type Domain = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  icon_url: string | null;
  hero_image_url: string | null;
  is_active: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type Creator = {
  id: string;
  slug: string;
  display_name: string;
  business_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  city: string | null;
  country_code: string | null;
  creator_types: string[];
  is_verified: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  medusa_product_id: string | null;
  creator_id: string;
  domain_id: string | null;
  category_id: string | null;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  product_type: string;
  status: string;
  condition_type: string | null;
  personalization_available: boolean;
  estimated_dispatch_days: number | null;
  featured_image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  event_type: string;
  organizer_creator_id: string | null;
  starts_at: string;
  ends_at: string;
  location_name: string | null;
  address_line_1: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  ticketing_mode: string;
  ticket_url: string | null;
  ticket_price_cents: number | null;
  currency_code: string | null;
  featured_image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type Workshop = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  format_type: string;
  difficulty_level: string;
  price_cents: number;
  currency_code: string;
  duration_minutes: number | null;
  capacity: number | null;
  featured_image_url: string | null;
  booking_mode: string;
  booking_url: string | null;
  location_name: string | null;
  city: string | null;
  country_code: string | null;
  creator_id: string;
  domain_id: string | null;
  is_featured: boolean;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_markdown: string | null;
  featured_image_url: string | null;
  article_type: string;
  reading_time_minutes: number | null;
  published_at: string | null;
  is_published: boolean;
  is_featured: boolean;
  author_creator_id: string | null;
  domain_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type EntityLink = {
  id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  relation_type: string;
  weight: number;
  sort_order: number | null;
};

export type EntityType =
  | "domain"
  | "creator"
  | "product"
  | "workshop"
  | "event"
  | "article";
