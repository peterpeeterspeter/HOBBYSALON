-- Update platform products with Pexels-seeded image URLs.
-- Run after: npm run seed:product-images (downloads images to public/landing/products/)
-- Run: psql "$DATABASE_URL" -f scripts/update-product-image-urls.sql
-- Or paste in Supabase SQL Editor.

UPDATE public.products SET featured_image_url = '/landing/products/handmade-crochet-scarf.jpg' WHERE id = '44444444-4444-4444-4444-444444444401';
UPDATE public.products SET featured_image_url = '/landing/products/supply-yarn-bundle.jpg' WHERE id = '44444444-4444-4444-4444-444444444402';
UPDATE public.products SET featured_image_url = '/landing/products/handmade-knitted-hat.jpg' WHERE id = '44444444-4444-4444-4444-444444444403';
UPDATE public.products SET featured_image_url = '/landing/products/supply-pattern-pdf.jpg' WHERE id = '44444444-4444-4444-4444-444444444404';
UPDATE public.products SET featured_image_url = '/landing/products/handmade-pottery-mug.jpg' WHERE id = '44444444-4444-4444-4444-444444444405';
UPDATE public.products SET featured_image_url = '/landing/products/supply-bead-kit.jpg' WHERE id = '44444444-4444-4444-4444-444444444406';
