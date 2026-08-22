# Provider QA — workshop listing metadata

Use after the `/workshops` keuzehulp redesign ships. Wrong metadata is now highly visible on cards (next session, place, level, image, summary).

## Checklist per published workshop

- [ ] **Niveau** matches the offer (e.g. no “voor gevorderden” title with Beginner badge)
- [ ] **Volgende sessie** exists, is not cancelled, and is the session shown on the listing
- [ ] **Plaats / Online** is accurate (`city` / `location_name` for physical/hybrid; `format_type = online` for online)
- [ ] **Beeld** is workshop-specific or a calm fallback (no unrelated stock doubles)
- [ ] **Korte beschrijving** is a human summary (not placeholder / system copy)

## Where to fix

- Creator dashboard: `/dashboard/workshops`
- Platform fields: `difficulty_level`, `format_type`, `city`, `location_name`, `featured_image_url`, `short_description`, `workshop_sessions`

## Done when

Spot-check of active workshops with upcoming sessions shows consistent niveau, place, image, and description on `/workshops` cards.
