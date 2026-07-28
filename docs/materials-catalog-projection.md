# Materials catalog projection (follow-up)

Unlocks honest **price filter/sort** and **availability** on `/materials`.

## Problem

Today the listing paginates platform `products` first, then batch-enriches Medusa prices for the page. Price filters, price sorts, and priced `totalCount` cannot be correct in that order.

## Target

Platform-side catalog projection (or indexed columns) with at least:

- `display_price_cents`
- `availability` (synced)
- `interaction_mode` (optional denormalized from `resolveMaterialsOffer`)

Fed from Medusa events for webshop rows; P2P rows keep platform `price_cents` / stock fields when trustworthy.

## Then enable in UI

- Prijs min/max filter
- Sorteer: Prijs laag–hoog
- Beschikbaarheid filter
- `totalCount` that respects priced filters

Until this ships, `/materials` must not expose those filters (launch MVP option 2).
