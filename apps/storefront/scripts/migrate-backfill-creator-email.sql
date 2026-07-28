-- Backfill creators.email from the linked auth.users account.
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-backfill-creator-email.sql
--
-- product_inquiries notifications are gated on `creator.email` being set
-- (see sendProductInquiryCreatorEmail in product-inquiry.ts). Every creator
-- row had a null email because saveCreatorProfileAction never wrote the
-- column, so no maker ever received an inquiry notification. The app code
-- now writes this on every profile save and falls back to the linked auth
-- user at send time, but existing rows still need a one-time backfill.
--
-- Only touches creators with a null/blank email and a linked auth user;
-- creators without a user_id (imported/seed rows) are left untouched, same
-- as the runtime fallback.

update public.creators c
set email = u.email
from auth.users u
where c.user_id = u.id
  and (c.email is null or trim(c.email) = '')
  and u.email is not null;
