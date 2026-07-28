# Homepage QA

The homepage is a **router**: recognize intent, show conditional live content, hand off to listing pages. Empty or failed blocks stay hidden.

## Page order

1. Full-bleed hero (brand + H1 + lead + search + three routes + craft photo)  
2. Compact resume banner (logged-in only)  
3. Hobby strip (`domainsWithLiveContent`, scroll-snap)  
4. Samen eropuit (agenda editorial list)  
5. Concrete journey split (or hidden)  
6. Workshops asymmetric and/or make-at-home list  
7. Makers face strip  
8. Providers full-bleed band  
9. Footer newsletter (only signup surface)

## Checklist

- [ ] Listing redesigns for `/agenda`, `/workshops`, `/creators` are deployed with or before this homepage
- [ ] No large homepage newsletter form; footer form remains
- [ ] Hero routes: weekend → `/agenda?when=weekend`, workshops → `/workshops`, make → `/artikelen`
- [ ] Agenda teaser uses upcoming/ongoing events; far featured does not displace near events
- [ ] Event maker faces only when `event_creators` rows exist and public RLS returns profile fields (no service-role)
- [ ] Journey section hidden unless a candidate has ≥2 of materials / workshop / maker via `getEntityConnections`
- [ ] Test/demo titles (`TEST…`, `testproduct`, …) do not appear in teasers
- [ ] One failed block does not empty the whole homepage
- [ ] Logged-in “Verder met je project” only when a resumable project exists

## Visual (Taste phase 1)

- [ ] First viewport: edge-to-edge craft photo with scrim; **Hobbysalon** reads as brand without relying on the nav alone
- [ ] Hero has no inset media card and no badge overlays on the photo
- [ ] Hero stack stays short: brand, headline, one lead (≤20 words), search + route CTAs
- [ ] Scrim keeps white/near-white text and accent CTAs at readable contrast
- [ ] Touch targets stay `min-h-11` / `min-h-12`
- [ ] Section layout families differ (hobby strip ≠ agenda list ≠ journey split ≠ workshop asymmetric ≠ make list ≠ makers strip ≠ providers band)
- [ ] No twin equal 3-column card grids for workshops and make
- [ ] Soft reveal / hover motion respects `prefers-reduced-motion`
- [ ] Brand accent stays amber (`--accent`); no purple or new palette

## Analytics (router)

- `home_search_submitted`
- `home_route_clicked`
- `home_event_clicked`
- `home_journey_clicked`
- `home_provider_clicked`

## Done when

First viewport reads as an image-led platform router; below the fold only live sections appear with distinct layouts; CTAs land on the keuzehulp listing pages.
