# Hobbysalon Architecture

## Purpose

This document defines the technical architecture of Hobbysalon.

Hobbysalon is a connected creative hobby platform, not a simple webshop.
It combines:
- handmade marketplace
- supplies marketplace
- workshops
- events / market fair calendar
- articles / inspiration
- creator profiles
- domain hub pages

The architecture must support deep interlinking between all modules.

---

# 1. Architectural Principles

## 1.1 Platform-first, not shop-first
Hobbysalon is a platform with multiple entity types:
- domains
- creators
- products
- workshops
- events
- articles

Commerce is only one part of the system.

## 1.2 Content + Commerce + Discovery
The system must support:
- content discovery
- creator discovery
- product discovery
- workshop booking
- event discovery
- cross-linking between all of them

## 1.3 Graph-oriented model
The architecture must preserve the platform graph.
Relationships between entities are not hardcoded into page logic.
They are stored in the database via `entity_links`.

## 1.4 Senior-friendly frontend
The public UI must remain:
- clear
- fast
- readable
- low-friction
- SEO-friendly

---

# 2. High-Level System Overview

Hobbysalon consists of four main layers:

1. **Frontend**
2. **Platform Database Layer**
3. **Commerce Layer**
4. **Content / Recommendation Layer**

```text
Next.js frontend
↓
Application services / query layer
↓
Postgres platform schema + Mercur/Medusa commerce engine
↓
External services (auth, storage, payments, email)
```

⸻

3. Frontend Layer

Technology
	•	Next.js App Router
	•	TypeScript
	•	Tailwind CSS
	•	shadcn/ui

Responsibilities

The frontend is responsible for:
	•	public pages
	•	SEO pages
	•	domain hub pages
	•	creator profiles
	•	product pages
	•	workshop pages
	•	event calendar pages
	•	article pages
	•	dashboard pages

Rules
	•	Use server components for public data pages whenever possible
	•	Use client components only when interactivity requires it
	•	Keep public pages indexable and metadata-rich
	•	Do not build the frontend as a generic dashboard-first SaaS shell

### 3.1 Two seller dashboards

Hobbysalon deliberately splits seller tooling across two surfaces:

| Surface | Host | Stack | Purpose |
|---------|------|-------|---------|
| Creator dashboard | `www.hobbysalon.be/dashboard` | Next.js + Supabase | Profile, workshops, events, materials import, platform product discovery |
| Verkopersportaal | `verkoper.hobbysalon.be` | Mercur vendor-panel (Vite SPA) | Shipping, inventory, promotions, returns, Stripe Connect, team members |

Auth flow:

1. User logs in on the storefront via Supabase.
2. Storefront `/dashboard/verkoper` calls `POST /store/platform/seller-auth/exchange` with the Supabase access token.
3. Backend validates `user_seller_links`, ensures a Medusa seller `auth_identity`, returns a seller JWT.
4. Storefront redirects to `verkoper.hobbysalon.be/login/callback?token=...`.
5. Vendor panel stores the JWT and opens seller commerce views.

Platform discovery stays in Supabase; transactional seller depth stays in Medusa vendor APIs.

⸻

4. Platform Database Layer

Technology
	•	Postgres / Supabase

Responsibilities

This is the source of truth for platform entities:
	•	domains
	•	creators
	•	workshops
	•	workshop_sessions
	•	events
	•	articles
	•	entity_links
	•	subscribers
	•	survey_segments
	•	favorites
	•	reviews

Why this exists

Mercur / Medusa is not enough to model the Hobbysalon platform graph.
The platform database layer is needed to support:
	•	SEO content
	•	creator system
	•	events
	•	workshops
	•	interlinking
	•	segmentation

⸻

5. Commerce Layer

Technology
	•	Mercur / Medusa

Responsibilities

The commerce layer is responsible for:
	•	catalog commerce mechanics
	•	carts
	•	orders
	•	checkout
	•	seller/vendor workflows
	•	product-level transaction logic
	•	payment flow integration

Products handled
	•	supplies
	•	handmade products
	•	event listings
	•	event tickets
	•	workshop tickets
	•	workshop kits

See docs/billing-commission-matrix.md for fee model and commission rules.

Important boundary

Mercur / Medusa should not become the full platform model.
It is the commerce engine, not the whole application.

Product dual-ownership

Products are split across two systems:
- **Platform DB (Supabase)**: discovery, display, SEO — slug, title, description, product_type, creator_id, domain_id, featured_image_url, is_featured, is_active, seo_title, seo_description. Linked via `products.medusa_product_id`.
- **Medusa**: transactional truth — price, variants, inventory, SKU, weight, shipping, carts, checkout.

The platform products table stores indicative `price_cents` / `currency_code` for maker contact listings. Merchant/supply transactional price, inventory, variants, SKU, weight, and shipping still live in Medusa when `medusa_product_id` is set.

⸻

6. Graph Linking Layer

Core table
	•	entity_links

Purpose

This layer enables flexible many-to-many relations between:
	•	articles
	•	workshops
	•	products
	•	events
	•	creators
	•	domains

Examples
	•	article → related workshop
	•	workshop → recommended supply
	•	event → featured creator
	•	creator → related article
	•	product → relevant event

Why it matters

Without this layer:
	•	domain pages become rigid
	•	recommendations become hardcoded
	•	discovery becomes weak
	•	the platform loses its core advantage

⸻

7. Application Query Layer

Location

Suggested:
	•	lib/db/queries/*
	•	lib/services/*

Responsibilities

This layer fetches and assembles data for page rendering.

Examples:
	•	domain hub query
	•	creator page query
	•	product detail query
	•	workshop detail query
	•	event detail query
	•	related entity query

Rule

Page components should not directly contain complex SQL logic.
Use a query/service layer to keep the system maintainable.

⸻

8. Routing Model

Public routes

/[domain]
/[domain]/workshops
/[domain]/handmade
/[domain]/supplies
/[domain]/artikels

/creator/[slug]
/product/[slug]
/workshop/[slug]
/event/[slug]
/artikel/[slug]

/agenda
/agenda/[slug]

Dashboard routes

/dashboard
/dashboard/creator
/dashboard/products
/dashboard/workshops
/dashboard/events

Routing principle

Routes should remain:
	•	clean
	•	readable
	•	SEO-friendly
	•	flat enough to avoid complexity

⸻

9. Public Page Composition

Domain page

Must combine:
	•	domain content
	•	featured creators
	•	handmade products
	•	supplies
	•	workshops
	•	events
	•	articles

Creator page

Must combine:
	•	creator profile
	•	products
	•	workshops
	•	events
	•	articles

Product page

Must combine:
	•	product data
	•	creator
	•	related workshops
	•	related articles
	•	related events

Workshop page

Must combine:
	•	workshop data
	•	sessions
	•	creator
	•	required products
	•	related articles
	•	related events

Event page

Must combine:
	•	event info
	•	participating creators
	•	related workshops
	•	related products
	•	related articles

Article page

Must combine:
	•	article content
	•	related products
	•	related workshops
	•	related creators
	•	related events

⸻

10. Authentication Model

Technology
	•	Supabase Auth or equivalent auth provider

Auth users

Auth users can become:
	•	creators
	•	buyers
	•	dashboard users

Creator relation

creators.user_id should link to auth.users.id where possible.

MVP rule

Authentication is required for:
	•	favorites
	•	creator dashboard
	•	listing management
	•	workshop management
	•	event management
	•	booking requests if needed later

Public browsing should remain open.

⸻

11. Storage Layer

Technology
	•	Supabase Storage or S3-compatible storage

Used for
	•	product images
	•	creator avatars
	•	creator banners
	•	workshop images
	•	event images
	•	article featured images

Rule

Store file metadata in the database, but keep binary assets in object storage.

⸻

12. Payments

Technology
	•	Stripe
	•	Stripe Connect later for marketplace payouts

Commerce direction

Short term:
	•	support product purchases and workshop-related products

Mid term:
	•	support marketplace payouts
	•	support event tickets
	•	support creator payouts

⸻

13. Email / CRM Layer

Current asset
	•	44k mailing list
	•	Acumbamail as downstream ESP (webhook sync after consent)
	•	Resend for transactional / confirmation / lead-magnet delivery

Responsibilities

The platform should support:
	•	newsletter signup
	•	subscriber segmentation
	•	source tracking
	•	interest tagging
	•	city tagging
	•	campaign landing pages

Data model

This is represented via:
	•	subscribers (incl. `acumbamail_synced_at`)
	•	survey_segments
	•	newsletter_lead_magnets / newsletter_opt_in_events

See `docs/acumbamail-newsletter.md` for env and field mapping.

⸻

14. Build Strategy

The system should be built in vertical slices.

Recommended order

Slice 1
	•	domain page
	•	creator page
	•	product page

Slice 2
	•	workshops
	•	workshop sessions
	•	booking requests

Slice 3
	•	event calendar
	•	event page
	•	event-to-creator/workshop relations

Slice 4
	•	article pages
	•	recommendation blocks

Slice 5
	•	creator dashboard
	•	product management
	•	workshop management
	•	event management

Rule

Do not attempt to build the full platform in one pass.

⸻

15. Recommended Folder Structure

app/
  (public)/
  (dashboard)/
  api/

components/
  domain/
  creator/
  product/
  workshop/
  event/
  article/
  shared/

lib/
  db/
    queries/
  services/
  utils/

types/

docs/
  PRD.md
  schema.md
  architecture.md


⸻

16. Boundaries and Non-Goals

Do not
	•	turn Hobbysalon into a plain webshop
	•	force all content logic into Medusa
	•	hardcode recommendations in UI components
	•	over-engineer state management
	•	build everything as client-side components
	•	let marketplace logic erase the content/event/workshop layers

Keep
	•	platform graph
	•	entity interlinking
	•	domain-driven discovery
	•	creator-centered architecture

⸻

17. Final Summary

Hobbysalon uses a layered architecture:
	•	Next.js for the user experience
	•	Postgres / Supabase for the platform graph
	•	Mercur / Medusa for commerce logic
	•	entity_links for interconnection
	•	object storage for media
	•	email/CRM layer for reactivation and segmentation

This architecture supports the real product vision:
a connected creative hobby platform where discovery, commerce, workshops, events, and inspiration reinforce each other.

## Aanbevolen docs-map

```text
docs/
  PRD.md
  schema.md
  architecture.md
```
