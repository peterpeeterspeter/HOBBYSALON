-- LOCAL, DISPOSABLE database only. Never point this fixture at Supabase/live DB.
-- Example from repository root (fresh postgres:16-alpine container):
-- docker exec listing-payment-atomicity-local createdb -U postgres listing_payment_atomicity_test
-- docker cp . listing-payment-atomicity-local:/fixture
-- docker exec listing-payment-atomicity-local psql -U postgres -d listing_payment_atomicity_test -v ON_ERROR_STOP=1 -f /fixture/supabase/tests/listing_checkout_atomicity.sql
-- Prefer copying just this file, the migration and the two referenced scripts.
-- Leaves synthetic rows for the optional parallel psql checks described below.
\set ON_ERROR_STOP on

do $$ begin
  if current_database() <> 'listing_payment_atomicity_test' then
    raise exception 'Refusing fixture outside listing_payment_atomicity_test';
  end if;
end $$;

create role anon;
create role authenticated;
create role service_role;
-- Minimal relevant schema from docs/SQL.md. No network services or SDKs.
create table public.creators (id uuid primary key);
create table public.commercial_plans (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  segment text not null, billing_period text not null
    check (billing_period in ('monthly', 'yearly', 'one_time'))
);
create table public.creator_plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id),
  plan_id uuid not null references public.commercial_plans(id),
  status text not null check (status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
  starts_at timestamptz not null default now(), ends_at timestamptz,
  external_payment_id text
);
create table public.listing_credit_wallets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators(id),
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table public.listing_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id), amount integer not null,
  reason text not null check (reason in ('purchase','listing_create','listing_bump','spotlight','refund','manual_adjustment')),
  related_entity_type text, related_entity_id uuid,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.workshops (
  id uuid primary key, creator_id uuid not null references public.creators(id),
  listing_fee_status text not null default 'unpaid', listing_expires_at timestamptz,
  is_active boolean not null default false, updated_at timestamptz not null default now()
);
\ir ../../apps/storefront/scripts/migrate-listing-checkout.sql
\ir ../../apps/storefront/scripts/migrate-listing-credit-wallet-atomic.sql

insert into public.creators values
 ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into public.stripe_checkout_events(session_id, kind, creator_id) values
 ('cs_legacy_unknown', 'credit_pack', '00000000-0000-4000-8000-000000000001');

\ir ../migrations/20260909120000_atomic_listing_checkout.sql

create function pg_temp.fail_write() returns trigger language plpgsql as $$
begin
  if current_setting('listing_fixture.fail_at', true) = TG_TABLE_NAME || ':' || TG_OP then
    raise exception 'injected_failure' using errcode = 'ZX001';
  end if;
  return new;
end $$;
create trigger fixture_fail before insert on public.listing_credit_transactions
  for each row execute function pg_temp.fail_write();
create trigger fixture_fail before insert or update on public.creator_plan_subscriptions
  for each row execute function pg_temp.fail_write();
create trigger fixture_fail before update on public.stripe_checkout_events
  for each row execute function pg_temp.fail_write();

begin;
set local plpgsql.check_asserts = on;

do $$
declare
  c constant uuid := '00000000-0000-4000-8000-000000000001';
  other_c constant uuid := '00000000-0000-4000-8000-000000000002';
  meta constant jsonb := '{"credits":"10","pack_code":"starter"}';
  result text;
  bad text;
  before_balance integer;
  plan_old uuid;
  plan_new uuid;
  plan_other uuid;
  workshop constant uuid := '00000000-0000-4000-8000-000000000003';
  expiry timestamptz;
  fresh_session bigint := ceil(extract(epoch from clock_timestamp()))::bigint + 1;
begin
  assert not has_function_privilege('anon', 'public.fulfill_listing_checkout(text,uuid,text,jsonb,bigint)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.fulfill_listing_checkout(text,uuid,text,jsonb,bigint)', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.fulfill_listing_checkout(text,uuid,text,jsonb,bigint)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.apply_listing_credit_delta(uuid,integer,text,text,uuid,jsonb)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.apply_listing_credit_delta(uuid,integer,text,text,uuid,jsonb)', 'EXECUTE');
  execute 'set local role anon';
  begin
    perform public.fulfill_listing_checkout('cs_unauthorized', c, 'credit_pack', meta);
    raise exception 'anon unexpectedly granted credits';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  execute 'set local role authenticated';
  begin
    perform public.fulfill_listing_checkout('cs_unauthorized', c, 'credit_pack', meta);
    raise exception 'authenticated unexpectedly granted credits';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  assert (select fulfilled_at is null from public.stripe_checkout_events where session_id = 'cs_legacy_unknown');
  assert public.fulfill_listing_checkout('cs_legacy_unknown', c, 'credit_pack', meta) = 'legacy_blocked';
  assert not exists (select 1 from public.listing_credit_wallets);

  -- An exception after wallet mutation must roll back wallet AND marker.
  perform set_config('listing_fixture.fail_at', 'listing_credit_transactions:INSERT', true);
  begin
    perform public.fulfill_listing_checkout('cs_credit', c, 'credit_pack', meta);
    raise exception 'expected ledger failure';
  exception when sqlstate 'ZX001' then null;
  end;
  assert not exists (select 1 from public.stripe_checkout_events where session_id = 'cs_credit');
  assert not exists (select 1 from public.listing_credit_wallets);
  assert not exists (select 1 from public.listing_credit_transactions);
  perform set_config('listing_fixture.fail_at', '', true);

  execute 'set local role service_role';
  result := public.fulfill_listing_checkout('cs_credit', c, 'credit_pack', meta);
  execute 'reset role';
  assert result = 'applied';
  assert public.fulfill_listing_checkout('cs_credit', c, 'credit_pack', meta) = 'duplicate';
  assert (select balance = 10 from public.listing_credit_wallets where creator_id = c);
  assert (select count(*) = 1 from public.listing_credit_transactions);
  assert (select fulfilled_at is not null from public.stripe_checkout_events where session_id = 'cs_credit');
  begin
    perform public.fulfill_listing_checkout('cs_credit', c, 'credit_pack', '{"credits":"20"}');
    raise exception 'expected metadata mismatch' using errcode = 'ZX002';
  exception when raise_exception then
    assert SQLERRM = 'listing_checkout_payload_mismatch';
  end;
  begin
    perform public.fulfill_listing_checkout('cs_credit', other_c, 'credit_pack', meta);
    raise exception 'expected creator mismatch' using errcode = 'ZX002';
  exception when raise_exception then
    assert SQLERRM = 'listing_checkout_payload_mismatch';
  end;

  -- Failure at the final marker update rolls back a fully-written grant too.
  perform set_config('listing_fixture.fail_at', 'stripe_checkout_events:UPDATE', true);
  begin
    perform public.fulfill_listing_checkout('cs_final_fail', c, 'credit_pack', meta);
    raise exception 'expected completion failure';
  exception when sqlstate 'ZX001' then null;
  end;
  assert (select balance = 10 from public.listing_credit_wallets where creator_id = c);
  assert not exists (select 1 from public.stripe_checkout_events where session_id = 'cs_final_fail');
  assert (select count(*) = 1 from public.listing_credit_transactions);
  perform set_config('listing_fixture.fail_at', '', true);

  foreach bad in array array['0', '-1', '1.5', '10junk', '2147483648', ''] loop
    begin
      perform public.fulfill_listing_checkout('cs_bad_credit', c, 'credit_pack', jsonb_build_object('credits', bad));
      raise exception 'expected invalid credits' using errcode = 'ZX002';
    exception when raise_exception or numeric_value_out_of_range then null;
    end;
    assert not exists (select 1 from public.stripe_checkout_events where session_id = 'cs_bad_credit');
  end loop;

  insert into public.commercial_plans(code, segment, billing_period) values
    ('old', 'maker', 'monthly') returning id into plan_old;
  insert into public.commercial_plans(code, segment, billing_period) values
    ('new', 'maker', 'yearly') returning id into plan_new;
  insert into public.commercial_plans(code, segment, billing_period) values
    ('other', 'supplier', 'monthly') returning id into plan_other;
  insert into public.creator_plan_subscriptions(creator_id, plan_id, status, external_payment_id) values
    (c, plan_old, 'active', 'cs_old'), (c, plan_other, 'active', 'cs_other');

  -- Test both expiration failure and new subscription failure after expiration.
  foreach bad in array array['creator_plan_subscriptions:UPDATE', 'creator_plan_subscriptions:INSERT'] loop
    perform set_config('listing_fixture.fail_at', bad, true);
    begin
      perform public.fulfill_listing_checkout('cs_plan', c, 'plan', '{"plan_code":"new"}');
      raise exception 'expected plan failure';
    exception when sqlstate 'ZX001' then null;
    end;
    assert (select status = 'active' and ends_at is null from public.creator_plan_subscriptions where external_payment_id = 'cs_old');
    assert not exists (select 1 from public.creator_plan_subscriptions where external_payment_id = 'cs_plan');
    assert not exists (select 1 from public.stripe_checkout_events where session_id = 'cs_plan');
  end loop;
  perform set_config('listing_fixture.fail_at', '', true);
  assert public.fulfill_listing_checkout('cs_plan', c, 'plan', '{"plan_code":"new"}') = 'applied';
  assert public.fulfill_listing_checkout('cs_plan', c, 'plan', '{"plan_code":"new"}') = 'duplicate';
  assert (select status = 'expired' from public.creator_plan_subscriptions where external_payment_id = 'cs_old');
  assert (select status = 'active' from public.creator_plan_subscriptions where external_payment_id = 'cs_other');
  assert (select count(*) = 1 from public.creator_plan_subscriptions where external_payment_id = 'cs_plan');
  assert (select ends_at > starts_at + interval '364 days' from public.creator_plan_subscriptions where external_payment_id = 'cs_plan');
  begin
    perform public.fulfill_listing_checkout('cs_missing_plan', c, 'plan', '{"plan_code":"missing"}');
    raise exception 'expected missing plan failure' using errcode = 'ZX002';
  exception when raise_exception then assert SQLERRM = 'listing_plan_not_found';
  end;
  assert not exists (select 1 from public.stripe_checkout_events where session_id = 'cs_missing_plan');

  insert into public.workshops(id, creator_id) values (workshop, c);
  -- A historical workshop grant has no per-session ledger after old cleanup.
  -- Missing trusted creation time must therefore fail closed, not reactivate it.
  assert public.fulfill_listing_checkout('cs_orphan_workshop', c, 'workshop_listing', jsonb_build_object('workshop_id', workshop)) = 'legacy_blocked';
  assert (select not is_active from public.workshops where id = workshop);
  begin
    perform public.fulfill_listing_checkout('cs_wrong_owner', other_c, 'workshop_listing', jsonb_build_object('workshop_id', workshop), fresh_session);
    raise exception 'expected owner failure' using errcode = 'ZX002';
  exception when raise_exception then assert SQLERRM = 'workshop_listing_not_found_for_creator';
  end;
  assert not exists (select 1 from public.stripe_checkout_events where session_id = 'cs_wrong_owner');
  perform set_config('listing_fixture.fail_at', 'stripe_checkout_events:UPDATE', true);
  begin
    perform public.fulfill_listing_checkout('cs_workshop', c, 'workshop_listing', jsonb_build_object('workshop_id', workshop), fresh_session);
    raise exception 'expected workshop completion failure';
  exception when sqlstate 'ZX001' then null;
  end;
  assert (select not is_active and listing_fee_status = 'unpaid' and listing_expires_at is null from public.workshops where id = workshop);
  assert not exists (select 1 from public.stripe_checkout_events where session_id = 'cs_workshop');
  perform set_config('listing_fixture.fail_at', '', true);
  assert public.fulfill_listing_checkout('cs_workshop', c, 'workshop_listing', jsonb_build_object('workshop_id', workshop), fresh_session) = 'applied';
  select listing_expires_at into expiry from public.workshops where id = workshop;
  assert expiry > now() + interval '58 days';
  assert public.fulfill_listing_checkout('cs_workshop', c, 'workshop_listing', jsonb_build_object('workshop_id', workshop), fresh_session) = 'duplicate';
  assert (select listing_expires_at = expiry and is_active and listing_fee_status = 'paid' from public.workshops where id = workshop);

  -- Orphaned old grants (cleanup lost markers) must not be granted again.
  assert public.fulfill_listing_checkout('cs_historical_workshop', c, 'workshop_listing', jsonb_build_object('workshop_id', workshop), 1) = 'legacy_blocked';
  assert (select listing_expires_at = expiry from public.workshops where id = workshop);
  assert not has_table_privilege('authenticated', 'public.creator_plan_subscriptions', 'INSERT');
  assert not has_table_privilege('anon', 'public.listing_checkout_migration_boundary', 'UPDATE');
  perform public.apply_listing_credit_delta(c, 10, 'purchase', null, null, '{"stripe_session_id":"cs_orphan_credit"}');
  select balance into before_balance from public.listing_credit_wallets where creator_id = c;
  assert public.fulfill_listing_checkout('cs_orphan_credit', c, 'credit_pack', meta) = 'legacy_blocked';
  assert (select balance = before_balance from public.listing_credit_wallets where creator_id = c);
  assert public.fulfill_listing_checkout('cs_old', c, 'plan', '{"plan_code":"old"}') = 'legacy_blocked';
  assert (select status = 'expired' from public.creator_plan_subscriptions where external_payment_id = 'cs_old');
  assert (select fulfilled_at is null from public.stripe_checkout_events where session_id = 'cs_orphan_credit');

  raise notice 'PASS: ACLs, service-role grant, legacy/orphans, credit rollback/retry/deduplication, validation, plan expiration rollback, workshop ownership/rollback/deduplication';
end $$;
commit;

-- Fault-injection triggers refer to a temporary function; remove before exit so
-- fresh sessions can run concurrent calls against these synthetic fixtures.
drop trigger fixture_fail on public.listing_credit_transactions;
drop trigger fixture_fail on public.creator_plan_subscriptions;
drop trigger fixture_fail on public.stripe_checkout_events;
-- Concurrency checks: in independent psql connections, BEGIN; invoke RPC;
-- hold the transaction open; invoke same session in another connection; COMMIT.
-- Assert one 'applied', remaining 'duplicate', one ledger increment. Also use
-- two different session IDs for plans 'old'/'new', then assert one active maker
-- subscription and no changed supplier subscription.
