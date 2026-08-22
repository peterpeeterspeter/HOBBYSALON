# Creators listing QA

Trust on `/creators` (nav: Makers) depends on real profile photos and clear offer copy more than on filter polish.

## Checklist

- [ ] Prefer **`banner_url`** on listing cards; fall back to **`avatar_url`**; empty photo is a temporary calm placeholder only
- [ ] Studio name uses **`business_name`** when set, else **`display_name`**
- [ ] Specialty line comes from real **domain** links (or a short bio snippet)—never invented categories
- [ ] Offer is **one sentence** (max ~2 intents), not a badge stack
- [ ] City shows only when **`city`** is filled; place filter stays hidden until ≥30% of the filtered set has city data
- [ ] Intent chips match reality: workshops / handmade / materials / markets

## Where to fix

- Creator dashboard profile: banner, avatar, city, creator types, domains
- Platform `creators` + `creator_domains` rows

## Done when

Spot-check of the first makers grid shows mostly real photos, human offer lines, and no letter-circle IA or duplicate search fields.
