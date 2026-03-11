# Hobbysalon PRD

## Project
Hobbysalon

## Version
1.3

## Owner
Peter Peeters

## Status
Working product requirements document for platform build

---

# 1. Product Vision

Hobbysalon is a **creative hobby platform** for a predominantly female 55+ audience, combining:

- handmade marketplace
- hobby supplies marketplace
- workshops
- event and market fair calendar
- inspiration articles
- creator profiles

Hobbysalon is **not** a simple webshop and **not** only a marketplace. It is a **connected platform** where content, creators, commerce, workshops, and events reinforce each other.

Example:

- a pottery article links to a pottery workshop
- that workshop links to pottery supplies
- that workshop also links to handmade pottery items by makers
- the same creator can appear in the event calendar
- the pottery domain page aggregates all of these

The product model is therefore:

**Creators + Handmade + Supplies + Workshops + Events + Articles**

---

# 2. Strategic Context

Hobbysalon already has two major strategic assets:

- an existing mailing list of approximately **44,000 contacts**
- survey results from approximately **4,000 respondents**

These inputs validate both audience demand and product direction.

---

# 3. Survey Findings and Product Implications

## Demographics
- 60% is aged 55–74
- more than 97% is female
- median annual hobby material spend is €150–200

### Product implication
The platform must be **senior-friendly**:
- large font sizes
- high contrast
- simple navigation
- maximum 3 clicks to checkout
- clear buttons and forms

## Event spending
- 47% spends €50–150 per fair visit

### Product implication
Bundles and upsells should be positioned in the **€50–150 range**.

## Main attractions
1. Large assortment
2. Inspiration and new techniques

### Product implication
The platform must combine:
- broad product offering
- tutorial/article layer
- workshop layer
- event layer

## Acquisition channels
Top channels: Facebook, hobby stores, Pinterest, Google, fairs.

### Product implication
The platform must support:
- strong SEO pages
- content-rich hobby hubs
- event and workshop landing pages
- newsletter activation

---

# 4. Core Product Thesis

People do not only want to buy products.

They want to:
- discover hobbies
- get inspired
- book workshops
- buy supplies
- buy handmade products
- discover makers
- visit fairs and creative events

Therefore Hobbysalon must function as a **graph-based discovery platform**, not a siloed commerce app.

---

# 5. Product Scope

## In Scope
- domain pages
- creator profiles
- handmade marketplace
- hobby supplies marketplace
- workshop pages
- event calendar and event pages
- inspiration articles
- deep interlinking between all entities
- newsletter activation and segmentation foundation

## Out of Scope for MVP
- advanced community/forum
- complex booking engine with seat maps
- full marketplace messaging/chat
- subscriptions and memberships
- advanced vendor analytics
- mobile app

---

# 6. Entity Model

Core entity types:

- **domains** — creative verticals (crochet, knitting, pottery, etc.)
- **creators** — makers, suppliers, workshop hosts, organizers, content creators
- **products** — supplies, handmade, workshop kits, event tickets
- **workshops** — bookable or request-based classes
- **events** — handmade markets, hobby fairs, pop-ups
- **articles** — tutorials, guides, inspiration

These are connected through **entity_links** for flexible graph-based discovery.

---

# 7. Product Types

| Type | Description | Commission |
|------|-------------|------------|
| supply | Marketplace materials / supplies | 10% |
| handmade | Handmade marketplace | 6% |
| event_listing | Event listing promotion | Flat TBD |
| event_ticket | Event tickets | Flat TBD |
| workshop_ticket | Workshop bookings | Flat TBD |
| workshop_kit | Workshop kits / materials | Commerce only |

See `docs/billing-commission-matrix.md` for details.

---

# 8. UX Requirements

Because the audience skews older, UX must be senior-friendly:

- large typography
- strong readability
- minimal clutter
- simple navigation
- obvious CTAs
- wide buttons
- clear labels
- short forms

## Checkout principles
- maximum 3 clicks to checkout where possible
- straightforward cart
- transparent price breakdown
- clear shipping and pickup info

---

# 9. Technical Direction

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Postgres / Supabase (platform schema)
- Mercur / Medusa (commerce)
- Stripe (payments)

## Principle
Mercur/Medusa handles commerce workflows, but the **platform graph** remains a custom application layer in Postgres.

---

# 10. Build Strategy

Build in vertical slices:

1. Domain hub page
2. Creator profile page
3. Handmade / product page
4. Workshop pages
5. Event calendar and event pages
6. Seller/creator dashboard
7. Booking and commerce refinement

---

# 11. Summary

Hobbysalon is a **connected creative platform** for a highly validated audience.

It combines handmade marketplace, supplies, workshops, events, inspiration, and creators.

The central differentiator is not any one module, but the **interconnected experience** between all modules.
