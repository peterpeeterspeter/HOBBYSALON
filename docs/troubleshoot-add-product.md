# Troubleshooting: Can't Add Product

## Clarify which flow fails

1. **Storefront – add to cart** – Clicking "In winkelwagen" on a product page
2. **Vendor panel – create product** – Creating a new product in the seller dashboard
3. **Admin – create product** – Creating a product in the admin panel

---

## Storefront: Add to cart

The storefront loads products from the **platform** (Supabase) and uses **Medusa** for prices, variants, and cart.

### Cause: product not linked to Medusa

If the platform product has `medusa_product_id = null`, there are no variants and add-to-cart is hidden or disabled.

### Fix: link platform products to Medusa

Run the link script to connect platform products to Medusa by matching `handle`/`slug`:

```bash
cd apps/storefront && npx tsx scripts/link-medusa-products.ts
```

Ensure:
- Platform `products` table has rows with correct `slug` (e.g. `handmade-crochet-scarf`)
- Medusa has products with matching `handle`
- Script updates `medusa_product_id` on platform products

### Verify

1. Platform: `SELECT id, slug, medusa_product_id FROM products WHERE slug = 'handmade-crochet-scarf';`
2. If `medusa_product_id` is not null, the product page should show variants and the add-to-cart button.

---

## Vendor panel: Create product

If product creation fails in the vendor dashboard:

1. Check backend logs for the error on `POST /vendor/products`
2. Confirm you’re logged in as a vendor (`seller@mercurjs.com` etc.)
3. Ensure `categories` has at most one category (`max(1)` in the validator)

---

## Platform product_type constraint

The platform `products` table has a `product_type` check. Valid values:

```
supply, handmade, event_listing, event_ticket, workshop_ticket, workshop_kit
```

If you previously used `digital_pattern` and ran a migration that changed this constraint, update existing rows:

```sql
UPDATE products SET product_type = 'supply' WHERE product_type = 'digital_pattern';
```

Then apply the new constraint (see `docs/SQL.md`).
