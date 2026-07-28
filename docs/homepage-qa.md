# Homepage QA

The homepage is a **router**: recognize intent, show conditional live content, hand off to listing pages. Empty or failed blocks stay hidden.

## Page order

1. Hero + search + three routes  
2. Hobby chips (`domainsWithLiveContent`)  
3. Samen eropuit (agenda teaser)  
4. Concrete journey (or hidden)  
5. Workshops and/or make-at-home (max two)  
6. Makers  
7. Providers CTA  
8. Footer newsletter (only signup surface)

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

## Analytics (router)

- `home_search_submitted`
- `home_route_clicked`
- `home_event_clicked`
- `home_journey_clicked`
- `home_provider_clicked`

## Done when

First viewport reads as a short router; below the fold only live sections appear; CTAs land on the keuzehulp listing pages.
