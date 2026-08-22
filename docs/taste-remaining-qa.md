# Taste remaining QA (phases 3–7)

Brand Kit cream/amber, Quicksand/Lato, senior touch targets (`min-h-11` / `min-h-12`), no em-dashes in user-facing copy.

## Phase 3 (domain hubs)

- [ ] `/[domain]` uses `ListingHeroBand` + varied section families (not twin equal card grids)
- [ ] `/[domain]/workshops|artikels|supplies|handmade` use compact `DomainSubListingShell`
- [ ] `/[domain]/learning-paths` stays utility layout (Dutch “Leertrajecten”, no fake listing hero)
- [ ] Domain placeholder / hero images preserved; slug/IA/SEO unchanged

## Phase 4–5 (details / search / patterns / tools)

- [ ] Detail heroes are entity-specific (not `ListingHeroBand`)
- [ ] Related blocks prefer editorial strips over dense equal 3-col grids
- [ ] `/zoeken` search-first `ListingHeroBand`; result layouts vary by type
- [ ] `/patronen` and `/gratis-haakpatronen` use `ListingHeroBand`
- [ ] `/tools` compact utility hero; no gradient-card cliché
- [ ] Brand Kit tokens; craft imagery; `min-h-11` / `min-h-12`; Dutch copy

## Phase 6 (marketing)

- [ ] `MarketingHero` is full-bleed craft photo + scrim (not `ListingHeroBand`)
- [ ] Brand word **Hobbysalon** sits above the headline in white
- [ ] Primary CTA uses accent; CTAs are `min-h-12`
- [ ] Optional `imageSrc` defaults to `LANDING_IMAGES.community`
- [ ] `HowItWorksSection` with 3 steps uses asymmetric 1+2 (not equal 3-col)
- [ ] Partners / voor-* pages: no em-dashes in visible copy
- [ ] `/landing` left alone unless a trivial follow-up

## Phase 7 (auth + chrome)

- [ ] Login / register / creator / merchant: calm forms only (no photo hero)
- [ ] Soft `--section-alt` page background around auth `PageLayout`
- [ ] `CardShell` has clear border/shadow contrast on the alt background
- [ ] Auth inputs and submits meet `min-h-11` / `min-h-12`
- [ ] Header logo weight is clear; search and auth CTAs meet touch targets
- [ ] Header Inspiratie dropdown and nav breakpoints unchanged in behavior
- [ ] Footer section headings read clearly; newsletter still works; no em-dashes

## Shared done when

Marketing first viewport reads as craft photography + brand + CTAs. Auth pages read as quiet forms on a soft band. Global chrome stays senior-friendly without breaking responsive nav.
