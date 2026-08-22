# Materials listing QA

Trust on `/materials` depends more on images, titles, and prices than on filter polish.

## Checklist

- [ ] Remove or rename **`testproduct`** and other placeholder titles
- [ ] Every active catalog product has a real **featured image** (or intentional calm fallback)
- [ ] **Price** shows on the card when known (Medusa for webshop; `price_cents` for maker/destash without Medusa)
- [ ] Offer badge matches reality (Webshop / Maker / Tweedehands / Workshoppakket)
- [ ] CTA matches interaction mode (checkout vs “Vraag de maker” vs “Bekijk advertentie”)
- [ ] Destash/handmade without Medusa are not implied to be one-click checkout

## Where to fix

- Creator/merchant dashboards product forms
- Platform `products` rows: `title`, `featured_image_url`, `price_cents`, `product_type`, `medusa_product_id`

## Done when

Spot-check of the first materials grid shows no test titles, no empty image majority, and consistent offer badges/CTAs.
