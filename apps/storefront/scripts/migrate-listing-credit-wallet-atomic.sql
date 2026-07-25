-- Atomic listing credit wallet mutations
-- Fixes a read-then-write race in listing-credits.ts: two concurrent
-- consumeCredits/addCredits calls could read the same balance and
-- overwrite each other's update, letting balance go negative or
-- silently drop credits.
-- Run via: psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-listing-credit-wallet-atomic.sql

create or replace function public.apply_listing_credit_delta(
  p_creator_id uuid,
  p_delta integer,
  p_reason text,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_balance integer;
begin
  insert into public.listing_credit_wallets (creator_id, balance)
  values (p_creator_id, 0)
  on conflict (creator_id) do nothing;

  update public.listing_credit_wallets
  set balance = balance + p_delta,
      updated_at = now()
  where creator_id = p_creator_id
    and balance + p_delta >= 0
  returning balance into v_balance;

  if v_balance is null then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into public.listing_credit_transactions (
    creator_id, amount, reason, related_entity_type, related_entity_id, metadata
  ) values (
    p_creator_id, p_delta, p_reason, p_related_entity_type, p_related_entity_id, p_metadata
  );

  return v_balance;
end;
$$;
