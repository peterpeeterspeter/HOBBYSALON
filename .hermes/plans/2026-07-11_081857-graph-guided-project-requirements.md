# Graph-Guided Project Requirements Plan

> **For Hermes:** Implement this plan incrementally with TDD. Preserve the uncommitted content-hub redesign in the working tree.

**Goal:** When a user starts a saved article, pattern or public project, turn graph-linked materials into an explicit “heb ik al” checklist and surface related workshops and events as actionable next steps.

**Architecture:** Resolve relationships through `getEntityConnections()` so inbound and outbound `entity_links` are both honored and editorial `sort_order`/`weight` remains authoritative. Persist confirmations in the existing `user_activity_log` through the current project-run event model. Do not create a separate recommendation engine or infer products from text.

**Graph boundary:** Current graph entity types include products, workshops and events. Tools are currently a static registry rather than UUID graph entities, so this slice will label graph-linked products as materials. A later tools-node migration is required before tools can be graph-backed requirements.

---

### Task 1: Test graph project item grouping

**Files:**
- Create: `apps/storefront/src/lib/profile/project-requirements.test.ts`
- Create: `apps/storefront/src/lib/profile/project-requirements.ts`

1. Write a failing test proving product connections become `materials`, workshop connections become `workshops`, and event connections become `events`.
2. Run the test and confirm the module is missing.
3. Add the smallest pure grouping helper.
4. Re-run the test.

### Task 2: Resolve article and pattern requirements via the bidirectional graph

**Files:**
- Modify: `apps/storefront/src/lib/profile/saved-project-source.ts`
- Modify: `apps/storefront/src/lib/profile/project-run-state.ts`

1. Replace direct outbound `entity_links` reads with `getEntityConnections("article", id)`.
2. Preserve source graph order and enrich product, workshop and event requirements with their public links.
3. Retain public project steps and product links as the non-graph authored-project path.
4. Keep project-item persistence keyed to stable entity IDs.

### Task 3: Redesign the started-project page around requirements

**Files:**
- Modify: `apps/storefront/src/app/(public)/profile/start/[entityType]/[entityId]/page.tsx`

1. Separate “Dit heb je nodig” from project steps.
2. Give every graph-linked material an “Heb ik al” confirmation plus a material-page link for discovery/upsell.
3. Render graph-linked workshops under “Leer dit in een workshop” and events under “Ontdek het in het echt”.
4. Retain the one-click completion and existing badge progression.
5. Show direct explanations when graph data is not yet available rather than empty generic cards.

### Task 4: Validate

Run:
```bash
node --experimental-strip-types --test src/lib/profile/project-requirements.test.ts src/lib/profile/project-run-state.test.ts
yarn --cwd apps/storefront lint ...
./node_modules/.bin/tsc -p apps/storefront/tsconfig.json --noEmit
yarn --cwd apps/storefront build
git diff --check
```

Manually inspect one graph-linked article and one graph-linked pattern after starting a project. Do not commit or push without a direct user request.
