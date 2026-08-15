# Hobbysalon Schema

## Purpose

This document defines the platform data model for **Hobbysalon**.

Hobbysalon is **not** a simple webshop. It is a connected creative hobby platform built around:

- domains
- creators
- products
- workshops
- events
- articles
- entity links

Commerce flows can run through **Mercur / Medusa**, while the platform graph and content model live in **Postgres**. The frontend is built in **Next.js**.

---

# 1. Core Principle

Everything on Hobbysalon is an **entity** that can be linked to other entities.

Core entity types:

- domains
- creators
- products
- workshops
- events
- articles

The central abstraction is:

- `entity_links`

This allows the platform to connect content, commerce, learning, and events.

### Example

- article: “Getting Started with Pottery”
- workshop: “Pottery Introduction Antwerp”
- product: “Clay Starter Kit”
- handmade listing: “Handmade Ceramic Bowl”
- event: “Handmade Market Mechelen”
- creator: “Studio Clay & Co”

All of these can be connected through `entity_links`.

---

# 2. Architectural Split

## Mercur / Medusa handles

- products
- carts
- orders
- checkout
- vendors / sellers
- payment flows

## Postgres platform schema handles

- domains
- creators
- workshops
- workshop sessions
- events
- articles
- graph linking
- newsletter segmentation
- favorites / reviews / community signals

## Next.js handles

- unified public frontend
- SEO pages
- domain hubs
- creator pages
- event pages
- related content rendering

---

# 3. Entity Overview

Main tables:

- `domains`
- `creators`
- `creator_domains`
- `product_categories`
- `products`
- `product_images`
- `product_attributes`
- `workshops`
- `workshop_sessions`
- `workshop_required_products`
- `events`
- `event_domains`
- `event_creators`
- `event_workshops`
- `articles`
- `article_domains`
- `entity_links`
- `favorites`
- `reviews`
- `subscribers`
- `survey_segments`
- `workshop_booking_requests`
- `product_inquiries`
- `survey_responses`

---

# 4. Domains

Domains are the creative verticals of the platform.

Examples:

- crochet
- knitting
- card making
- pottery
- jewelry making
- scrapbooking
- sewing
- DIY

## Table: `domains`

Fields:

- `id` (uuid, pk)
- `slug` (text, unique)
- `name` (text)
- `short_description` (text)
- `long_description` (text)
- `icon_url` (text)
- `hero_image_url` (text)
- `is_active` (boolean)
- `sort_order` (int)
- `seo_title` (text)
- `seo_description` (text)
- `created_at`
- `updated_at`

---

# 5. Creators

A creator is any maker, supplier, workshop host, organizer, or content creator.

A creator can have multiple roles.

Examples:

- handmade seller
- yarn shop
- crochet teacher
- event organizer
- tutorial author

## Table: `creators`

Fields:

- `id` (uuid, pk)
- `user_id` (uuid, nullable)
- `slug` (text, unique)
- `display_name` (text)
- `business_name` (text, nullable)
- `bio` (text)
- `avatar_url` (text)
- `banner_url` (text)
- `email` (text)
- `phone` (text)
- `website_url` (text)
- `instagram_url` (text)
- `facebook_url` (text)
- `city` (text)
- `postal_code` (text)
- `country_code` (text)
- `creator_types` (text[])
- `is_verified` (boolean)
- `is_featured` (boolean)
- `accepts_bookings` (boolean)
- `accepts_marketplace_orders` (boolean)
- `open_to_markets` (boolean)
- `specialty_tags` (text[], free-text hobby labels when fixed domains don't fit)
- `created_at`
- `updated_at`

Allowed `creator_types`:

- `maker`
- `workshopgever`
- `supplier`
- `content_creator`
- `organizer`

---

# 6. Creator Domains

Many-to-many relationship between creators and domains.

## Table: `creator_domains`

Fields:

- `id` (uuid, pk)
- `creator_id` (uuid, fk → creators)
- `domain_id` (uuid, fk → domains)
- `is_primary` (boolean)

This allows one creator to belong to multiple creative domains.

---

# 7. Product Categories

Products belong to categories within a domain.

Example under crochet:

- yarn
- hooks
- kits
- crochet decor
- crochet clothing

## Table: `product_categories`

Fields:

- `id` (uuid, pk)
- `domain_id` (uuid, fk → domains)
- `parent_id` (uuid, nullable)
- `slug` (text)
- `name` (text)
- `sort_order` (int)

---

# 8. Products

Hobbysalon uses one unified `products` table with a `product_type`.

This supports both marketplace and content-driven merchandising.

## Product types

- `supply` — merchant, Medusa-backed, 10% commission
- `handmade` — maker listing, platform-only, listing fee
- `destash` — maker listing, leftover/secondhand materials, platform-only, listing fee. Kept separate from `supply` so it doesn't fall under the merchant commission rule.
- `event_listing`
- `event_ticket`
- `workshop_ticket`
- `workshop_kit`

## Table: `products`

Platform owns display/discovery fields. For `supply` (merchant), Medusa owns transactional fields (price, inventory, variants, SKU, weight, shipping), linked via `medusa_product_id`. For `handmade`/`destash` (maker listings), `price_cents` is the source of truth — there is no Medusa product, and the price is an indicative asking price shown next to a contact/inquire action, not a checkout price.

Fields:

- `id` (uuid, pk)
- `medusa_product_id` (text, unique, nullable) — bridge to Medusa product; null for maker listings
- `creator_id` (uuid, fk → creators)
- `domain_id` (uuid, fk → domains)
- `category_id` (uuid, fk → product_categories)
- `slug` (text, unique)
- `title` (text)
- `short_description` (text)
- `description` (text)
- `product_type` (text)
- `status` (text)
- `condition_type` (text, nullable)
- `personalization_available` (boolean)
- `estimated_dispatch_days` (int, nullable)
- `price_cents` (int, nullable) — indicative price for maker listings; null/ignored for Medusa-backed `supply` products
- `currency_code` (text, nullable)
- `stock_mode` (text, nullable) — `made_to_order` | `in_stock` | `contact`
- `featured_image_url` (text)
- `is_featured` (boolean)
- `is_active` (boolean)
- `seo_title` (text)
- `seo_description` (text)
- `created_at`
- `updated_at`

Allowed `status` values:

- `draft`
- `active`
- `archived`

Allowed `condition_type` values:

- `new`
- `handmade`
- `made_to_order`
- `used`

### Product interpretation

#### `supply`
Marketplace materials / supplies. Professional craft materials and tools.

#### `handmade`
Maker listing for a finished, made-by-the-maker item. Platform-only (no Medusa product); buyer contacts the maker via an inquiry form, no cart/checkout. Monetized via listing credits/plans, not sale commission.

#### `destash`
Maker listing for leftover or secondhand craft materials. Same platform-only, contact-first flow as `handmade`. Kept as a distinct type so it is never matched by the `supply` commission rule.

#### `event_listing`
Event listings (promoted listings, featured placement). Fee model: flat.

#### `event_ticket`
Event tickets. Event admission products.

#### `workshop_ticket`
Workshop bookings. Fee model: flat per booking/ticket.

#### `workshop_kit`
Workshop kits. Treated as commerce products, specifically linked to workshops.

---

# 9. Product Images

## Table: `product_images`

Fields:

- `id` (uuid, pk)
- `product_id` (uuid, fk → products)
- `image_url` (text)
- `alt_text` (text)
- `sort_order` (int)

---

# 10. Product Attributes

Flexible key-value metadata for products.

## Table: `product_attributes`

Fields:

- `id` (uuid, pk)
- `product_id` (uuid, fk → products)
- `attribute_key` (text)
- `attribute_value` (text)

Examples:

- material = cotton
- difficulty = beginner
- color = beige
- handmade_technique = macramé

---

# 11. Workshops

Workshops are distinct entities because they involve:

- schedule/session logic
- booking logic
- location
- teacher/host
- related materials

## Table: `workshops`

Fields:

- `id` (uuid, pk)
- `creator_id` (uuid, fk → creators)
- `domain_id` (uuid, fk → domains)
- `category_id` (uuid, nullable, fk → workshop_categories) — optional subcategory under the domain
- `slug` (text, unique)
- `title` (text)
- `short_description` (text)
- `description` (text)
- `format_type` (text)
- `difficulty_level` (text)
- `offer_type` (text, nullable) — activity shape only: `open_workshop` | `private_group` | `ongoing_course`
- `audience_types` (text[]) — e.g. `kids`, `parent_child`, `adults`, `team`, `bachelorette`
- `age_groups` (text[]) — exclusive ranges: `kids_0_11`, `kids_12_15`, `teens_16_17`, `adults_18_plus`, `seniors_65_plus`
- `languages` (text[]) — `nl` | `en` | `fr`; empty means unknown (do not invent defaults for legacy rows)
- `price_cents` (int)
- `currency_code` (text)
- `duration_minutes` (int)
- `capacity` (int, nullable)
- `min_participants` (int, nullable)
- `featured_image_url` (text)
- `booking_mode` (text)
- `booking_url` (text, nullable)
- `location_name` (text, nullable)
- `address_line_1` (text, nullable)
- `city` (text, nullable)
- `postal_code` (text, nullable)
- `country_code` (text, nullable)
- `is_featured` (boolean)
- `is_active` (boolean)
- `listing_fee_status` (text, default `unpaid`) — `launch_free` | `paid` | `unpaid`
- `listing_expires_at` (timestamptz, nullable) — end of paid visibility; null for `launch_free`
- `seo_title` (text)
- `seo_description` (text)
- `created_at`
- `updated_at`

Allowed `format_type`:

- `physical`
- `online`
- `hybrid`

Allowed `difficulty_level`:

- `beginner`
- `intermediate`
- `advanced`

Allowed `booking_mode`:

- `request`
- `external_link`
- `internal_booking`

### Table: `workshop_categories`

Domain-scoped subcategories (not a second domain tree). `domain_id` remains the primary hobby context.

- `id` (uuid, pk)
- `domain_id` (uuid, fk → domains)
- `slug` (text)
- `name` (text)
- `sort_order` (int)
- `is_active` (boolean)

Unique `(domain_id, slug)`.

---

# 12. Workshop Sessions

A workshop can have multiple scheduled sessions.

## Table: `workshop_sessions`

Fields:

- `id` (uuid, pk)
- `workshop_id` (uuid, fk → workshops)
- `starts_at` (timestamp)
- `ends_at` (timestamp)
- `capacity` (int, nullable)
- `remaining_spots` (int, nullable)
- `is_cancelled` (boolean)
- `booking_status` (text)

Allowed `booking_status`:

- `open`
- `sold_out`
- `closed`

---

# 13. Workshop Required Products

Links workshops to relevant products or kits.

## Table: `workshop_required_products`

Fields:

- `id` (uuid, pk)
- `workshop_id` (uuid, fk → workshops)
- `product_id` (uuid, fk → products)
- `is_required` (boolean)
- `is_bundle_default` (boolean)
- `sort_order` (int)

This enables flows such as:

- “Book this crochet workshop”
- “Add the starter kit in one click”

Material linking is optional when creating a workshop.

## Table: `workshop_gallery_images`

Extra photos for a workshop page (beyond `workshops.featured_image_url`).

Fields:

- `id` (uuid, pk)
- `workshop_id` (uuid, fk → workshops)
- `image_url` (text)
- `alt_text` (text, nullable)
- `sort_order` (int)
- `created_at`

---

# 14. Events

Events include:

- handmade markets
- hobby fairs
- pop-ups
- open ateliers
- workshop days

## Table: `events`

Fields:

- `id` (uuid, pk)
- `slug` (text, unique)
- `title` (text)
- `short_description` (text)
- `description` (text)
- `event_type` (text)
- `organizer_creator_id` (uuid, nullable, fk → creators)
- `starts_at` (timestamp)
- `ends_at` (timestamp)
- `location_name` (text)
- `address_line_1` (text)
- `city` (text)
- `postal_code` (text)
- `country_code` (text)
- `latitude` (numeric, nullable)
- `longitude` (numeric, nullable)
- `ticketing_mode` (text)
- `ticket_url` (text, nullable)
- `ticket_price_cents` (int, nullable)
- `currency_code` (text, nullable)
- `featured_image_url` (text)
- `is_featured` (boolean)
- `is_active` (boolean)
- `seo_title` (text)
- `seo_description` (text)
- `created_at`
- `updated_at`

Allowed `event_type`:

- `handmade_market`
- `hobby_fair`
- `pop_up`
- `open_atelier`
- `workshop_day`

Allowed `ticketing_mode`:

- `none`
- `external_link`
- `internal_ticket`

## Table: `event_gallery_images`

Extra photos for an event page (beyond `events.featured_image_url`).

Fields:

- `id` (uuid, pk)
- `event_id` (uuid, fk → events)
- `image_url` (text)
- `alt_text` (text, nullable)
- `sort_order` (int)
- `created_at`

---

# 15. Event Domains

An event can be linked to multiple domains.

## Table: `event_domains`

Fields:

- `id` (uuid, pk)
- `event_id` (uuid, fk → events)
- `domain_id` (uuid, fk → domains)

Example:
A fair can include crochet, card making, and sewing.

---

# 16. Event Creators

Creators participating in events.

## Table: `event_creators`

Fields:

- `id` (uuid, pk)
- `event_id` (uuid, fk → events)
- `creator_id` (uuid, fk → creators)
- `role` (text)

Allowed roles:

- `vendor` — standhouder (set by authenticated maker/workshopgever RSVP)
- `workshop_host`
- `speaker`
- `organizer`

### Standhouder RSVP

Logged-in makers and workshopgevers confirm presence on the public event page.
That writes:

1. `event_creators` with `role = vendor`
2. `entity_links` creator → event with `relation_type = exhibits_at`

The event page shows confirmed standholders and **all their active products**
(`products.creator_id`, `is_active`, `status = active`). Creator profiles show
participating events with a “Standhouder” badge when `role = vendor`.

---

# 17. Event Workshops

Links workshops to events.

## Table: `event_workshops`

Fields:

- `id` (uuid, pk)
- `event_id` (uuid, fk → events)
- `workshop_id` (uuid, fk → workshops)

This allows events to showcase specific sessions or workshop programs.

---

# 18. Articles

Articles form the inspiration and SEO layer.

Article types include:

- tutorial
- guide
- inspiration
- interview
- pattern

## Table: `articles`

Fields:

- `id` (uuid, pk)
- `author_creator_id` (uuid, nullable, fk → creators)
- `domain_id` (uuid, fk → domains)
- `slug` (text, unique)
- `title` (text)
- `excerpt` (text)
- `body_markdown` (text)
- `featured_image_url` (text)
- `article_type` (text)
- `difficulty_level` (text, nullable: `beginner`, `intermediate`, `advanced`)
- `reading_time_minutes` (int)
- `published_at` (timestamp, nullable)
- `is_published` (boolean)
- `is_featured` (boolean)
- `seo_title` (text)
- `seo_description` (text)
- `created_at`
- `updated_at`

---

# 19. Article Domains

Optional many-to-many if an article spans multiple domains.

## Table: `article_domains`

Fields:

- `id` (uuid, pk)
- `article_id` (uuid, fk → articles)
- `domain_id` (uuid, fk → domains)

---

# 20. Entity Links

This is the central graph layer.

Instead of creating dozens of rigid many-to-many tables for every relationship, Hobbysalon uses one flexible linking table.

## Table: `entity_links`

Fields:

- `id` (uuid, pk)
- `source_entity_type` (text)
- `source_entity_id` (uuid)
- `target_entity_type` (text)
- `target_entity_id` (uuid)
- `relation_type` (text)
- `weight` (int, default 1)
- `sort_order` (int, nullable)
- `created_at`

Allowed entity types:

- `domain`
- `creator`
- `product`
- `workshop`
- `event`
- `article`

### Example `relation_type` values

- `related_workshop`
- `related_product`
- `recommended_supply`
- `featured_in_event`
- `created_by`
- `teaches`
- `inspired_by`
- `belongs_to_domain`
- `similar_to`
- `related_article`
- `featured_creator`

### Example records

- article “Getting Started with Pottery” → workshop “Pottery Introduction” → `related_workshop`
- workshop “Pottery Introduction” → product “Clay Starter Kit” → `recommended_supply`
- event “Handmade Market Mechelen” → creator “Studio Clay” → `featured_creator`

### Why this matters

Without `entity_links`, the platform would struggle to support:

- “show related handmade products on an article page”
- “show matching events on a workshop page”
- “show creators, products, and workshops on a domain hub”

With `entity_links`, the frontend can build rich, flexible recommendation blocks.

---

# 21. Favorites

Stores user favorites across multiple entity types.

## Table: `favorites`

Fields:

- `id` (uuid, pk)
- `user_id` (uuid)
- `entity_type` (text)
- `entity_id` (uuid)
- `created_at`

Supported entity types:

- product
- workshop
- event
- article
- creator
- domain

---

# 22. Reviews

Lightweight review model for products, creators, or workshops.

## Table: `reviews`

Fields:

- `id` (uuid, pk)
- `user_id` (uuid)
- `creator_id` (uuid, nullable)
- `product_id` (uuid, nullable)
- `workshop_id` (uuid, nullable)
- `rating` (int)
- `title` (text)
- `body` (text)
- `created_at`

A review must target exactly one of:
- creator
- product
- workshop

---

# 23. User Registration Profile

Registration keeps one account while enabling multiple profile capabilities.

## Table: `user_preferences`

Fields:

- `user_id` (uuid, pk)
- `postal_code` (text, nullable)
- `city` (text, nullable)
- `country_code` (text, default `BE`)
- `radius_km` (int, default 25)
- `preferred_domain_ids` (uuid[])
- `interest_types` (text[])
- `offer_roles` (text[], default `{}`) — self-declared aanbiedersrollen at registration
- `primary_offer_role` (text, nullable) — routing / copy / analytics primary
- `marketing_opt_in` (boolean, default false)
- `marketing_opted_in_at` (timestamptz, nullable)
- `marketing_opted_out_at` (timestamptz, nullable) — opt-out does not erase prior opt-in history
- `marketing_consent_source` (text, nullable) — e.g. `register`
- `onboarding_completed` (boolean)
- `created_at`
- `updated_at`

Allowed `interest_types`:

- `workshop`
- `supply`
- `handmade`
- `event`
- `article`

Allowed `offer_roles` / `primary_offer_role`:

- `workshopgever`
- `maker`
- `organizer`
- `merchant`

## Table: `user_account_roles`

Fields:

- `id` (uuid, pk)
- `user_id` (uuid)
- `role` (text)
- `created_at`

Allowed `role` values:

- `user`
- `creator`
- `merchant`
- `workshop_host`
- `organizer`

## Table: `role_requests`

Approval queue for privileged roles (`merchant`, `workshop_host`, `organizer`).

Fields:

- `id` (uuid, pk)
- `user_id` (uuid)
- `role` (text)
- `status` (text)
- `payload` (jsonb)
- `reviewer_user_id` (uuid, nullable)
- `reviewer_note` (text, nullable)
- `reviewed_at` (timestamptz, nullable)
- `created_at`
- `updated_at`

Allowed `role`:

- `merchant`
- `workshop_host`
- `organizer`

Allowed `status`:

- `pending`
- `approved`
- `rejected`
- `withdrawn`

## Table: `platform_moderators`

Platform moderators for community showcase and role-request queues.

Fields:

- `user_id` (uuid, pk) — Supabase auth user id
- `created_at`

## Table: `user_seller_links`

Fields:

- `id` (uuid, pk)
- `user_id` (uuid)
- `seller_id` (text, Medusa seller id)
- `seller_type` (text)
- `created_at`

Allowed `seller_type`:

- `creator`
- `merchant`

---

# 24. Subscribers

The platform builds on an existing mailing list of approximately 44k contacts.

The subscriber model supports future segmentation and CRM use.

## Table: `subscribers`

Fields:

- `id` (uuid, pk)
- `email` (text, unique)
- `first_name` (text, nullable)
- `source` (text)
- `status` (text)
- `preferred_domains` (text[])
- `interested_in_workshops` (boolean)
- `interested_in_handmade` (boolean)
- `interested_in_supplies` (boolean)
- `preferred_city` (text, nullable)
- `acumbamail_synced_at` (timestamptz, nullable) — set after successful Acumbamail ESP sync
- `created_at`
- `updated_at`

Allowed `source` examples:

- `legacy_import`
- `site_form`
- `event`
- `workshop`

Allowed `status`:

- `active`
- `unsubscribed`
- `bounced`

---

# 25. Survey Segments

Stores structured interest data from surveys or signup flows.

## Table: `survey_segments`

Fields:

- `id` (uuid, pk)
- `subscriber_id` (uuid, fk → subscribers)
- `domain_id` (uuid, nullable)
- `interest_type` (text)
- `score` (int, default 1)

Allowed `interest_type`:

- `workshop`
- `supply`
- `handmade`
- `event`
- `article`

Examples:
- workshop lovers
- textile-focused users
- handmade shoppers
- event-oriented visitors

---

# 26. Workshop Booking Requests

A lightweight booking request layer for the MVP.

This is useful before implementing a full booking engine.

## Table: `workshop_booking_requests`

Fields:

- `id` (uuid, pk)
- `workshop_session_id` (uuid, nullable, fk → workshop_sessions)
- `workshop_id` (uuid, fk → workshops)
- `creator_id` (uuid, fk → creators)
- `full_name` (text)
- `email` (text)
- `phone` (text)
- `message` (text)
- `status` (text)
- `created_at`
- `updated_at`

Allowed `status`:

- `new`
- `contacted`
- `confirmed`
- `cancelled`

---

# 27. Product Inquiries

Contact/inquiry inbox for maker listings (`handmade`/`destash`) that have no Medusa cart. Replaces checkout: a visitor submits an inquiry, the creator is notified by email and manages status from `/dashboard/products`. Public may only insert new inquiries (RLS); dashboard reads/updates go through the service-role client, same trust boundary as `listing_credit_wallets`/`listing_credit_transactions`.

## Table: `product_inquiries`

Fields:

- `id` (uuid, pk)
- `product_id` (uuid, fk → products)
- `creator_id` (uuid, fk → creators) — inbox owner
- `full_name` (text)
- `email` (text)
- `message` (text, nullable)
- `status` (text)
- `created_at`
- `updated_at`

Allowed `status`:

- `new`
- `contacted`
- `accepted`
- `declined`

---

# 27b. Survey Responses

Public multi-role enquête submissions (e.g. `/enquete`). One row per completed survey; flexible answers in `answers jsonb`. Public may only insert (RLS); reads via service-role client.

## Table: `survey_responses`

Fields:

- `id` (uuid, pk)
- `survey_key` (text) — e.g. `aanbod-verbeteren-2026`
- `activity_types` (text[]) — one or more of: `content`, `handmade`, `workshop`, `webshop`, `hobbybeurs`, `makers_market`
- `activity_status` (text) — shared Q2
- `outcomes` (text[]) — shared Q3 (max 2)
- `answers` (jsonb) — per-role answers keyed by activity type + `closing`
- `contact_ok` (boolean)
- `contact_name` (text, nullable)
- `contact_email` (text, nullable; required when `contact_ok`)
- `user_id` (uuid, nullable, fk → auth.users)
- `status` (text)
- `created_at`
- `updated_at`

Allowed `status`:

- `new`
- `reviewed`
- `archived`

---

# 28. Route Mapping

Recommended public routes:

- `/[domain]`
- `/[domain]/workshops`
- `/[domain]/handmade`
- `/[domain]/supplies`
- `/[domain]/artikels`

- `/creator/[slug]`
- `/product/[slug]`
- `/workshop/[slug]`
- `/event/[slug]`
- `/artikel/[slug]`

- `/agenda`
- `/agenda/[slug]`

Recommended dashboard routes:

- `/dashboard/creator`
- `/dashboard/products`
- `/dashboard/workshops`
- `/dashboard/events`

---

# 29. Homepage Query Model

The homepage is not a classic ecommerce homepage.

It must aggregate data across multiple tables.

Recommended homepage blocks:

- popular domains
- upcoming workshops
- featured handmade items
- featured supplies
- event calendar teaser
- inspiration articles
- creators of the month

---

# 30. Core Business Logic

## Workshop page should show

- workshop info
- sessions
- teacher / creator
- required products
- related articles
- related events

## Handmade product page should show

- maker
- related workshops by that maker
- relevant supplies
- related articles
- upcoming events with that maker

## Event page should show

- participating creators
- workshops at the event
- relevant handmade products
- relevant articles
- ticket and practical information

## Domain page should show

- products
- handmade items
- workshops
- events
- articles
- creators

---

# 31. MVP Schema Scope

## Must-have tables for v1

- `domains`
- `creators`
- `creator_domains`
- `product_categories`
- `products`
- `product_images`
- `workshops`
- `workshop_sessions`
- `workshop_required_products`
- `events`
- `event_domains`
- `event_creators`
- `event_workshops`
- `articles`
- `entity_links`
- `subscribers`

## Commercial plans (implemented)

- `commercial_plans` — plan catalog per segment (`workshop`, `maker`, `supplier`, `organizer`)
- `creator_plan_subscriptions` — active plan per creator per segment
- `event_plan_subscriptions` — per-event listing packages
- `listing_credit_wallets` / `listing_credit_transactions` / `listing_credit_products` — maker listing credits
- `visibility_boosts` — paid ranking and spotlight
- `event_vendor_inquiries` — standholder lead capture

Migrations: `apps/storefront/scripts/migrate-commercial-plans.sql`, `seed-commercial-plans.sql`, etc.

## Later additions

- `reviews`
- `favorites`
- `advanced segmentation`
- `digital patterns`
- more advanced booking logic

---

# 32. Recommended Technical Direction

Do **not** force all of Hobbysalon into Mercur / Medusa.

The correct architecture is:

- **Mercur / Medusa** for commerce
- **Custom Postgres schema** for platform entities
- **Next.js** for the unified user experience
- **entity_links** as the interconnection layer

This supports:

- Etsy-like handmade marketplace
- supplies commerce
- workshops
- event calendar
- SEO content
- deep interlinking

---

# 33. Final Schema Summary

Hobbysalon is a **platform graph** built around:

- creators
- products
- workshops
- events
- articles
- domains

The schema is intentionally designed to support:

- discovery
- learning
- commerce
- creator visibility
- event participation
- marketing segmentation

The defining feature is not any single module, but the **connected model between all modules**.
