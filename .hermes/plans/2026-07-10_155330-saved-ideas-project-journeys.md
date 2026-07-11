# Saved Ideas to Project Journey Implementation Plan

> **For Hermes:** Execute this plan as a vertical slice. Use the existing `user_activity_log` and `user_badges` tables. Do not introduce an undeployable database migration.

**Goal:** Turn saved articles, patterns, projects, workshops and materials into a visual profile feed. Let a member start a saved article, pattern or project, see the required materials and steps, track a checklist, and receive a badge when the project is completed.

**Design read:** Trust-first, senior-friendly hobby progress space. Preserve Hobbysalon’s existing warm visual system. Dials: variance 3, motion 2, density 5. Use high-contrast labels, large touch targets, image-led cards and no decorative animation.

**Architecture:** Favorites remain the source of intent. `user_activity_log` records `project_started`, `project_item_completed`, `project_item_reopened` and `project_completed`, with a `source_key` in metadata. Project state is reconstructed from those activities, so it survives sessions without a schema migration. Existing project steps, linked products, sought materials and article graph edges become checklist items.

**Constraints discovered:** Hosted Supabase schema migrations cannot be applied from this environment because `SUPABASE_DB_PASSWORD` is unavailable. The activity-log approach is intentionally migration-free and deployable now.

---

### Task 1: Build pure project-run state helpers with TDD

**Files:**
- Create: `apps/storefront/src/lib/profile/project-run-state.ts`
- Create: `apps/storefront/src/lib/profile/project-run-state.test.ts`

**Steps:**
1. Write failing tests for active vs completed state and checklist percent.
2. Implement the minimal deterministic functions.
3. Run the Node test suite.

### Task 2: Add a resolved favorite-feed query

**Files:**
- Modify: `apps/storefront/src/lib/platform/queries/favorites.ts`
- Create: `apps/storefront/src/lib/profile/favorite-feed.ts`
- Create: `apps/storefront/src/lib/profile/favorite-feed.test.ts`

**Steps:**
1. Test the pure visual labels and startable content rule: only `article` and `project` can become a guided project in this slice.
2. Resolve titles, image URLs, links, labels and dates for product, workshop, event, article, project and creator favorites.
3. Retain saved-date order and gracefully omit removed entities.

### Task 3: Add project-run actions and source resolution

**Files:**
- Create: `apps/storefront/src/lib/profile/saved-project-source.ts`
- Create: `apps/storefront/src/app/actions/saved-projects.ts`

**Steps:**
1. Resolve an article/pattern into graph-linked product, workshop and event requirements; resolve a public project into its own steps, products and sought materials.
2. Create idempotent start, checklist toggle and completion actions that verify both login and favorite ownership.
3. Log activity events with namespaced metadata and revalidate profile and run pages.
4. Add a `Project voltooid` badge rule to the existing Hobbypaspoort logic.

### Task 4: Build senior-friendly profile feed and project-run UI

**Files:**
- Create: `apps/storefront/src/components/profile/SavedFeedCard.tsx`
- Create: `apps/storefront/src/components/profile/StartSavedProjectButton.tsx`
- Create: `apps/storefront/src/components/profile/ProjectRunChecklist.tsx`
- Create: `apps/storefront/src/app/(public)/profile/start/[entityType]/[entityId]/page.tsx`
- Modify: `apps/storefront/src/app/(public)/profile/page.tsx`
- Modify: `apps/storefront/src/app/(public)/favorites/page.tsx`

**Steps:**
1. Replace the favorites text-list with image-led cards grouped by practical type.
2. Add a profile section, `Verder met je bewaarde ideeën`, showing the most-recent saved objects with a direct start action for articles, patterns and projects.
3. Add a calm project-run page with source image, materials/steps checklist, progress percentage, reopen action and finish action.
4. Keep the current creator-owned project publishing flow separate and intact.

### Task 5: Validate and push

**Commands:**
```bash
node --experimental-strip-types --test src/lib/profile/*.test.ts
./node_modules/.bin/tsc -p apps/storefront/tsconfig.json --noEmit
yarn --cwd apps/storefront lint ...
yarn --cwd apps/storefront build
git diff --check
git commit -m "feat: turn favorites into project journeys"
git push
```
