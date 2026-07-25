import type { DifficultyLevel } from "@/lib/content/difficulty";

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

export type CommercialSegment = "workshop" | "maker" | "supplier" | "organizer";

export type CommercialPlan = {
  id: string;
  code: string;
  segment: CommercialSegment;
  name: string;
  price_cents: number;
  currency_code: string;
  billing_period: "monthly" | "yearly" | "one_time";
  listing_limit: number | null;
  product_limit: number | null;
  external_links_allowed: boolean;
  featured_allowed: boolean;
  video_allowed: boolean;
  analytics_allowed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreatorPlanSubscription = {
  id: string;
  creator_id: string;
  plan_id: string;
  status: "active" | "trialing" | "past_due" | "cancelled" | "expired";
  starts_at: string;
  ends_at: string | null;
  external_payment_id: string | null;
  created_at: string;
  updated_at: string;
  plan?: CommercialPlan;
};

export type EventPlanSubscription = {
  id: string;
  event_id: string;
  plan_id: string;
  status: "active" | "trialing" | "past_due" | "cancelled" | "expired";
  starts_at: string;
  ends_at: string | null;
  external_payment_id: string | null;
  created_at: string;
  updated_at: string;
  plan?: CommercialPlan;
};

export type ListingCreditWallet = {
  id: string;
  creator_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
};

export type ListingCreditProduct = {
  id: string;
  pack_code: string;
  name: string;
  credits: number;
  price_cents: number;
  currency_code: string;
  is_active: boolean;
  created_at: string;
};

export type VisibilityBoost = {
  id: string;
  entity_type: "creator" | "product" | "workshop" | "event" | "article";
  entity_id: string;
  boost_type:
    | "spotlight"
    | "category_top"
    | "homepage"
    | "newsletter"
    | "sponsored"
    | "manual";
  source: "plan" | "credits" | "manual" | "sponsored";
  starts_at: string;
  ends_at: string | null;
  boost_score: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type EventVendorInquiry = {
  id: string;
  event_id: string;
  organizer_creator_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  message: string | null;
  status: "new" | "contacted" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
};

export type Creator = {
  id: string;
  user_id?: string | null;
  slug: string;
  display_name: string;
  business_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  email?: string | null;
  phone?: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  city: string | null;
  country_code: string | null;
  creator_types: string[];
  is_verified: boolean;
  is_featured: boolean;
  accepts_bookings?: boolean;
  accepts_marketplace_orders?: boolean;
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
  /** Indicative listing price for contact/listings (makers). Commerce price stays in Medusa when linked. */
  price_cents: number | null;
  currency_code: string | null;
  stock_mode: "made_to_order" | "in_stock" | "contact" | null;
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
  difficulty_level: DifficultyLevel | null;
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

export type Project = {
  id: string;
  slug: string;
  created_by_user_id?: string | null;
  title: string;
  short_description: string | null;
  description: string | null;
  difficulty_level: string;
  estimated_duration_minutes: number | null;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  currency_code: string;
  featured_image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectStep = {
  id: string;
  project_id: string;
  step_order: number;
  title: string;
  instruction: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectGalleryImage = {
  id: string;
  project_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
};

export type ProjectProductLink = {
  id: string;
  project_id: string;
  product_id: string;
  link_type: string;
  sort_order: number;
  created_at: string;
};

export type ProjectSoughtMaterial = {
  id: string;
  project_id: string;
  title: string;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type LearningPath = {
  id: string;
  domain_id: string;
  slug: string;
  title: string;
  short_description: string | null;
  difficulty_level: string;
  estimated_duration_minutes: number | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LearningPathStepEntityType =
  | "article"
  | "workshop"
  | "product"
  | "project";

export type LearningPathStep = {
  id: string;
  learning_path_id: string;
  step_order: number;
  title: string;
  instruction: string | null;
  related_entity_type: LearningPathStepEntityType;
  related_entity_id: string;
  estimated_minutes: number | null;
  is_required: boolean;
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
  | "article"
  | "project";
