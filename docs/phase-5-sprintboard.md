# Phase 5 Sprintboard (Implementation-Ready)

Last updated: March 11, 2026  
Owner: Product + Engineering  
Scope: Hobbysalon connected all-round hobby experience

## 1) Operating model

- Cadence: 2-week sprints
- Estimation: Fibonacci story points (`3, 5, 8, 13`)
- Team capacity assumption: `~30 SP` per sprint
- Priorities:
- `P0`: ship first, directly tied to core loop and revenue
- `P1`: retention and creator ecosystem
- `P2`: growth and differentiation
- Definition of done for every ticket:
- AC met
- Tests added/updated
- Analytics events fired
- Lint/build green for touched app(s)

## 2) Sprint calendar

- Sprint 5.1: March 16, 2026 -> March 27, 2026
- Sprint 5.2: March 30, 2026 -> April 10, 2026
- Sprint 5.3: April 13, 2026 -> April 24, 2026
- Sprint 5.4: April 27, 2026 -> May 8, 2026
- Sprint 5.5: May 11, 2026 -> May 22, 2026
- Sprint 5.6: May 25, 2026 -> June 5, 2026

## 3) Board overview

| Ticket | Priority | SP | Target sprint | Depends on |
|---|---:|---:|---|---|
| F5-P0-01 Project Graph v1 | P0 | 8 | 5.1 | - |
| F5-P0-02 Project Detail Page | P0 | 8 | 5.1 | F5-P0-01 |
| F5-P0-03 Bundle Cart Flow | P0 | 8 | 5.2 | F5-P0-01 |
| F5-P0-04 Bundle Checkout + Order metadata | P0 | 8 | 5.2 | F5-P0-03 |
| F5-P0-05 Recommendation Engine v1 | P0 | 8 | 5.2 | F5-P0-01 |
| F5-P0-06 Funnel Analytics + Dashboard | P0 | 5 | 5.1 | - |
| F5-P1-01 Hobbypaspoort | P1 | 8 | 5.3 | F5-P0-05 |
| F5-P1-02 Learning Paths | P1 | 8 | 5.3 | F5-P0-01 |
| F5-P1-03 Weekplanner + Reminders | P1 | 8 | 5.4 | F5-P1-01 |
| F5-P1-04 Creator Hub Enhancements | P1 | 8 | 5.4 | F5-P0-01 |
| F5-P1-05 Trust Layer | P1 | 5 | 5.5 | F5-P1-04 |
| F5-P1-06 Local Discovery | P1 | 5 | 5.5 | F5-P0-05 |
| F5-P2-01 Community Challenges | P2 | 8 | 5.5 | F5-P1-01 |
| F5-P2-02 Hobby Buddy Matching | P2 | 8 | 5.6 | F5-P1-06 |
| F5-P2-03 Membership / Loyalty | P2 | 8 | 5.6 | F5-P0-04 |
| F5-P2-04 Live Sessions + Replay | P2 | 5 | 5.6 | F5-P1-04 |
| F5-P2-05 Gamification Layer | P2 | 5 | 5.6 | F5-P1-01, F5-P2-01 |

## 4) Ticket details

### F5-P0-01 Project Graph v1

- Priority: `P0`
- Estimate: `8 SP`
- Goal: add `project` as first-class entity linking products, workshops, events, articles, creators.
- Repo map subtasks:
- `docs/SQL.md`: add tables `projects`, `project_domains`, `project_steps`, and indexes.
- `apps/storefront/scripts/seed-platform.sql`: seed at least 3 projects and linked entities.
- `apps/storefront/src/lib/platform/queries/*`: add `projects.ts` and project relation queries.
- `apps/storefront/src/lib/services/*`: add service composition for project detail blocks.
- Acceptance criteria:
- project has mandatory title, slug, difficulty, estimated duration
- project detail query returns at least products + workshops + one extra type
- no N+1 query regressions on project retrieval

### F5-P0-02 Project Detail Page

- Priority: `P0`
- Estimate: `8 SP`
- Depends on: `F5-P0-01`
- Goal: ship unified project page with buy/book/discover flow.
- Repo map subtasks:
- `apps/storefront/src/app/(public)/project/[slug]/page.tsx`: new route with metadata + structured data.
- `apps/storefront/src/components/shared/*`: project sections (`materials`, `workshops`, `events`, `inspiration`).
- `apps/storefront/src/lib/seo.ts`: metadata helper support for project content type.
- Acceptance criteria:
- page includes clear linear steps and CTA blocks
- page passes senior-friendly checks (font size, tap targets, contrast)
- page includes JSON-LD (HowTo or CreativeWork fallback)

### F5-P0-03 Bundle Cart Flow

- Priority: `P0`
- Estimate: `8 SP`
- Depends on: `F5-P0-01`
- Goal: add a bundle to cart in one action from project/workshop context.
- Repo map subtasks:
- `apps/storefront/src/app/actions/cart.ts`: add `addBundleToCartAction`.
- `apps/storefront/src/components/cart/*`: bundle selector and quantity controls.
- `apps/storefront/src/lib/commerce/medusa/cart.ts`: support grouped add-lines with metadata.
- Acceptance criteria:
- one click adds all chosen bundle items
- cart lines tagged with common `bundle_id`
- partial failure handling shows recoverable error state

### F5-P0-04 Bundle Checkout + Order metadata

- Priority: `P0`
- Estimate: `8 SP`
- Depends on: `F5-P0-03`
- Goal: preserve bundle context through checkout and order completion.
- Repo map subtasks:
- `apps/storefront/src/app/(public)/checkout/*`: show grouped bundle summary.
- `apps/storefront/src/app/actions/checkout.ts`: forward bundle metadata.
- `packages/modules/b2c-core/src/api/store/carts/*`: expose line metadata safely to checkout payload.
- Acceptance criteria:
- checkout shows grouped bundle totals
- order success preserves and can render bundle context
- analytics event includes `bundle_id` and `bundle_value`

### F5-P0-05 Recommendation Engine v1

- Priority: `P0`
- Estimate: `8 SP`
- Depends on: `F5-P0-01`
- Goal: “for you” ranking using favorites + domain behavior + recent interactions.
- Repo map subtasks:
- `apps/storefront/src/lib/platform/queries/*`: scoring query (recent favorites/views/purchases).
- `apps/storefront/src/lib/services/home-page.ts`: inject personalized sections.
- `apps/storefront/src/app/(public)/page.tsx`: render recommendations with fallback.
- Acceptance criteria:
- logged-in users get personalized cards
- cold-start users get domain-popularity fallback
- ranking latency stays within acceptable page budget

### F5-P0-06 Funnel Analytics + Dashboard

- Priority: `P0`
- Estimate: `5 SP`
- Goal: complete tracking for discovery -> cart -> checkout -> purchase.
- Repo map subtasks:
- `apps/storefront/src/lib/analytics/track.ts`: normalize schema and include session/user identifiers.
- `apps/storefront/src/components/analytics/*`: add reusable tracking components.
- `docs/readme.md`: analytics event dictionary and validation checklist.
- Acceptance criteria:
- required events: `project_view`, `bundle_add`, `checkout_started`, `checkout_completed`
- every event includes timestamp + source + entity identifiers
- QA checklist executed on staging

### F5-P1-01 Hobbypaspoort

- Priority: `P1`
- Estimate: `8 SP`
- Depends on: `F5-P0-05`
- Goal: show profile progress, completions, favorites, and badges.
- Repo map subtasks:
- `docs/SQL.md`: add tables `user_hobby_profiles`, `user_badges`, `user_activity_log`.
- `apps/storefront/src/app/(public)/profile/*`: new pages/components.
- `apps/storefront/src/lib/platform/queries/favorites.ts`: extend with profile summaries.
- Acceptance criteria:
- profile shows progress per domain and completed activities
- badge state updates from tracked actions
- anonymous users are redirected to login

### F5-P1-02 Learning Paths

- Priority: `P1`
- Estimate: `8 SP`
- Depends on: `F5-P0-01`
- Goal: define beginner->advanced paths by domain.
- Repo map subtasks:
- `docs/SQL.md`: add `learning_paths`, `learning_path_steps`.
- `apps/storefront/src/app/(public)/[domain]/learning-paths/*`: list/detail routes.
- `apps/storefront/src/lib/services/domain-page.ts`: include path teasers.
- Acceptance criteria:
- each path has ordered steps with completion state
- every step links to one existing entity (article/workshop/product/project)
- admin seed includes at least one path per top domain

### F5-P1-03 Weekplanner + Reminders

- Priority: `P1`
- Estimate: `8 SP`
- Depends on: `F5-P1-01`
- Goal: show personal schedule and send reminder notifications.
- Repo map subtasks:
- `docs/SQL.md`: add `user_planner_items`, `user_reminder_preferences`.
- `apps/storefront/src/app/(public)/planner/*`: planner UI and filters.
- `packages/modules/resend/src/*`: reminder email job integration.
- Acceptance criteria:
- users can add workshop/event/planned project tasks
- reminders configurable per item or globally
- reminder emails include direct deep link back to platform item

### F5-P1-04 Creator Hub Enhancements

- Priority: `P1`
- Estimate: `8 SP`
- Depends on: `F5-P0-01`
- Goal: give creators tools for publishing connected content faster.
- Repo map subtasks:
- `apps/storefront/src/app/(dashboard)/dashboard/*`: creator content linking UI.
- `apps/storefront/src/app/actions/dashboard.ts`: save links and publication state.
- `packages/modules/b2c-core/src/api/vendor/*`: expose endpoints for graph linking.
- Acceptance criteria:
- creator can link workshop/product/article/event to a project
- draft/published states clearly visible
- validation prevents broken or circular self-links

### F5-P1-05 Trust Layer

- Priority: `P1`
- Estimate: `5 SP`
- Depends on: `F5-P1-04`
- Goal: add verification and policy clarity.
- Repo map subtasks:
- `docs/SQL.md`: add creator verification evidence fields and moderation notes.
- `apps/storefront/src/components/shared/*`: verified badges + policy chips.
- `apps/storefront/src/app/(public)/checkout/*`: cancellation/refund policy summary blocks.
- Acceptance criteria:
- verified creator badge appears on creator/product/workshop/event pages
- policy snippet visible before booking/purchase confirmation
- moderation fields are admin-only and not exposed publicly

### F5-P1-06 Local Discovery

- Priority: `P1`
- Estimate: `5 SP`
- Depends on: `F5-P0-05`
- Goal: boost nearby relevance for events/workshops/creators.
- Repo map subtasks:
- `apps/storefront/src/lib/platform/queries/events.ts` and `workshops.ts`: add city/region ranking.
- `apps/storefront/src/app/(public)/agenda/page.tsx`: local filter chips.
- `apps/storefront/src/components/shared/Header.tsx`: location selector entry point.
- Acceptance criteria:
- users can set preferred city/region
- listings reorder based on locality preference
- fallback works when no local content is available

### F5-P2-01 Community Challenges

- Priority: `P2`
- Estimate: `8 SP`
- Depends on: `F5-P1-01`
- Goal: monthly domain challenges with submissions and voting.
- Repo map subtasks:
- `docs/SQL.md`: add `challenges`, `challenge_submissions`, `challenge_votes`.
- `apps/storefront/src/app/(public)/challenges/*`: challenge pages.
- `apps/storefront/src/app/actions/*`: create submission and vote actions.
- Acceptance criteria:
- challenge lifecycle supports draft, active, closed
- users can submit and vote once per challenge rules
- moderation toggle exists for hidden submissions

### F5-P2-02 Hobby Buddy Matching

- Priority: `P2`
- Estimate: `8 SP`
- Depends on: `F5-P1-06`
- Goal: suggest peer hobbyists with similar interests and location.
- Repo map subtasks:
- `docs/SQL.md`: add `hobby_buddy_profiles`, `hobby_buddy_matches`.
- `apps/storefront/src/app/(public)/profile/*`: opt-in and preference controls.
- `apps/storefront/src/lib/platform/queries/*`: matching query with safety filters.
- Acceptance criteria:
- opt-in required by default
- match score uses interests + level + location
- users can hide profile or unmatch

### F5-P2-03 Membership / Loyalty

- Priority: `P2`
- Estimate: `8 SP`
- Depends on: `F5-P0-04`
- Goal: reward repeat activity with benefits and points.
- Repo map subtasks:
- `docs/SQL.md`: add `memberships`, `loyalty_points_ledger`, `membership_benefits`.
- `packages/modules/b2c-core/src/workflows/order/*`: point accrual workflow step.
- `apps/storefront/src/app/(public)/profile/*`: membership and points UI.
- Acceptance criteria:
- points accrue on qualifying actions
- points ledger is append-only
- membership perks exposed at checkout and profile

### F5-P2-04 Live Sessions + Replay

- Priority: `P2`
- Estimate: `5 SP`
- Depends on: `F5-P1-04`
- Goal: allow creators to host and archive live sessions.
- Repo map subtasks:
- `docs/SQL.md`: add `live_sessions`, `live_session_replays`.
- `apps/storefront/src/app/(public)/workshop/[slug]/page.tsx`: live/replay block.
- `apps/storefront/src/app/(dashboard)/dashboard/workshops/*`: host controls.
- Acceptance criteria:
- session can be scheduled with link and replay asset
- attendees see clear start time and timezone
- replay access follows visibility rules

### F5-P2-05 Gamification Layer

- Priority: `P2`
- Estimate: `5 SP`
- Depends on: `F5-P1-01`, `F5-P2-01`
- Goal: increase engagement via streaks, milestones, and badges.
- Repo map subtasks:
- `docs/SQL.md`: add `user_streaks`, `achievement_rules`, `user_achievements`.
- `apps/storefront/src/components/shared/*`: streak/badge components.
- `apps/storefront/src/lib/analytics/*`: milestone trigger tracking.
- Acceptance criteria:
- streak updates daily based on valid actions
- users see earned and next achievements
- anti-abuse rule prevents repeated same-action farming

## 5) Release gates per priority

- P0 release gate:
- project pages live
- bundle checkout live
- recommendation blocks live
- end-to-end funnel analytics validated
- P1 release gate:
- hobbypaspoort + learning paths + planner released together
- creator hub edits stable without data integrity issues
- P2 release gate:
- community and loyalty features behind feature flags, then gradual rollout

## 6) Suggested immediate start order

1. Start now with `F5-P0-01` and `F5-P0-06` in parallel.
2. Start `F5-P0-02` after first schema/query slice of `F5-P0-01` is merged.
3. Start `F5-P0-03` only when project-product linking is stable.
4. Keep `F5-P0-04` and `F5-P0-05` in Sprint 5.2 for integration focus.
