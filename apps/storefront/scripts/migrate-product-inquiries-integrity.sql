-- Tighten product_inquiries insert policy with a referential integrity check.
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-product-inquiries-integrity.sql
--
-- The previous policy validated only full_name/email/status, so anyone
-- holding the public anon key could POST straight to /rest/v1/product_inquiries
-- with an arbitrary creator_id and flood any maker's inbox with inquiries
-- for products that aren't theirs. The server action already validated
-- this, but the REST endpoint bypasses the server action entirely.
--
-- Note the explicit `product_inquiries.` qualification below: writing
-- `p.creator_id = creator_id` resolves the bare column to the subquery's
-- own table (p), producing the tautology `p.creator_id = p.creator_id`
-- which silently permits everything. Verified against a local Postgres:
-- legitimate inserts pass, cross-creator spoofing and unknown product ids
-- are rejected.

drop policy if exists product_inquiries_anon_insert on public.product_inquiries;

create policy product_inquiries_anon_insert on public.product_inquiries
  for insert
  to anon, authenticated
  with check (
    full_name is not null
    and length(trim(full_name)) > 0
    and email is not null
    and length(trim(email)) > 0
    and status = 'new'
    and exists (
      select 1
      from public.products p
      where p.id = product_inquiries.product_id
        and p.creator_id = product_inquiries.creator_id
    )
  );
