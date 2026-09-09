-- Prerequisites: listing tables, apply_listing_credit_delta, and workshop fee
-- columns from apps/storefront/scripts/migrate-listing-*.sql,
-- migrate-commercial-plans.sql and migrate-workshop-listing-fee.sql.
-- DEPLOYMENT: pause/drain the OLD webhook before applying this migration and
-- switching to the new route. Do not allow old/new handlers to overlap: the old
-- handler can delete a marker after a committed grant. Resume Stripe retries
-- only after the new route is live. Do not roll back to the old route.
--
-- LEGACY RECONCILIATION (manual, audited, service-role/admin only):
-- fulfilled_at IS NULL means UNKNOWN, not unfulfilled. processed_at historically
-- recorded the attempt, not delivery. Never bulk mark fulfilled or delete these
-- rows, and never infer failure solely from a current wallet balance or status.
-- 1. Pause delivery for the session and verify the paid Stripe session, creator,
--    kind and original metadata against payment records. Lock its marker FOR
--    UPDATE in a transaction. Inspect purchase ledger metadata.stripe_session_id,
--    subscription external_payment_id, and workshop/audit history, including
--    expired/cancelled/deleted grants, refunds and any previous manual fixes.
-- 2. If delivery is positively proven, store the verified original metadata in
--    fulfillment_metadata and set fulfilled_at to the verified completion time;
--    do NOT grant anything. Retain the external reconciliation audit evidence.
-- 3. Only if non-delivery is positively proven, delete that ONE locked marker
--    and invoke fulfill_listing_checkout with verified metadata in the SAME
--    transaction; commit only if it returns 'applied'. Otherwise ROLLBACK.
--    EXCEPTION: workshops created before the migration boundary (or missing a
--    trusted session.created) stay blocked. For proven non-delivery, perform the
--    verified workshop grant AND mark that session fulfilled in ONE audited
--    transaction. Never change the global boundary to bypass reconciliation.
--    A ledger/subscription without a marker is also conservatively blocked by
--    the RPC; reconcile its evidence, never remove it just to force a retry.
-- 4. If evidence is missing, inconsistent or ambiguous, leave the marker NULL
--    and escalate for manual resolution. Retries return legacy_blocked / 503.

begin;

alter table public.stripe_checkout_events
  add column if not exists fulfilled_at timestamptz,
  add column if not exists fulfillment_metadata jsonb;

alter table public.stripe_checkout_events
  drop constraint if exists stripe_checkout_events_kind_check;
alter table public.stripe_checkout_events
  add constraint stripe_checkout_events_kind_check
  check (kind in ('credit_pack', 'plan', 'workshop_listing'));

comment on column public.stripe_checkout_events.fulfilled_at is
  'NULL = legacy/ambiguous, blocked for manual reconciliation. Non-NULL = atomic fulfillment or audited reconciliation; never backfill from processed_at.';

-- Durable boundary for sessions that could have been handled by the old route.
-- A workshop grant had no immutable per-session ledger in the legacy flow.
create table if not exists public.listing_checkout_migration_boundary (
  singleton boolean primary key default true check (singleton),
  activated_at timestamptz not null default clock_timestamp()
);
insert into public.listing_checkout_migration_boundary(singleton) values (true)
  on conflict do nothing;
alter table public.listing_checkout_migration_boundary enable row level security;
revoke all on public.listing_checkout_migration_boundary from public, anon, authenticated;

-- The old policy's name did not restrict its roles. Block direct client writes
-- that could bypass payment enforcement, while preserving other read policies.
drop policy if exists creator_plan_subscriptions_service_all on public.creator_plan_subscriptions;
create policy creator_plan_subscriptions_service_all on public.creator_plan_subscriptions
  for all to service_role using (true) with check (true);
revoke insert, update, delete, truncate, references, trigger
  on public.creator_plan_subscriptions from public, anon, authenticated;

create or replace function public.fulfill_listing_checkout(
  p_session_id text,
  p_creator_id uuid,
  p_kind text,
  p_metadata jsonb,
  p_session_created_at bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_inserted text;
  v_event public.stripe_checkout_events%rowtype;
  v_plan public.commercial_plans%rowtype;
  v_credits integer;
  v_now timestamptz;
  v_ends_at timestamptz;
  v_workshop_id uuid;
begin
  if p_session_id is null or btrim(p_session_id) = '' or p_creator_id is null
     or p_kind is null or p_kind not in ('credit_pack', 'plan', 'workshop_listing')
     or p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'invalid_listing_checkout';
  end if;

  -- The unique key serializes same-session deliveries. A concurrent insert
  -- waits for commit/rollback, so it cannot observe an in-flight success marker.
  insert into public.stripe_checkout_events
    (session_id, creator_id, kind, fulfillment_metadata)
  values (p_session_id, p_creator_id, p_kind, p_metadata)
  on conflict (session_id) do nothing
  returning session_id into v_inserted;

  if v_inserted is null then
    select * into strict v_event from public.stripe_checkout_events
      where session_id = p_session_id for update;
    if v_event.fulfilled_at is null then
      return 'legacy_blocked';
    end if;
    if v_event.creator_id is distinct from p_creator_id
       or v_event.kind is distinct from p_kind
       or v_event.fulfillment_metadata is distinct from p_metadata then
      raise exception 'listing_checkout_payload_mismatch';
    end if;
    return 'duplicate';
  end if;

  -- Old cleanup could remove a marker AFTER a grant committed. Do not regrant
  -- such orphaned evidence, even if its subscription is no longer active.
  if exists (select 1 from public.listing_credit_transactions
             where metadata->>'stripe_session_id' = p_session_id)
     or exists (select 1 from public.creator_plan_subscriptions
                where external_payment_id = p_session_id) then
    return 'legacy_blocked';
  end if;

  if p_kind = 'workshop_listing' and (
      p_session_created_at is null or
      p_session_created_at <= coalesce((select ceil(extract(epoch from activated_at))
                                       from public.listing_checkout_migration_boundary where singleton),
                                      9223372036854775807)
  ) then
    return 'legacy_blocked';
  end if;

  if p_kind = 'credit_pack' then
    -- Reject partial integers (e.g. 10junk), fractions, zero and overflow.
    if coalesce(p_metadata->>'credits', '') !~ '^[1-9][0-9]*$' then
      raise exception 'invalid_listing_credits';
    end if;
    v_credits := (p_metadata->>'credits')::integer;
    perform public.apply_listing_credit_delta(
      p_creator_id, v_credits, 'purchase', null, null,
      jsonb_build_object('pack_code', coalesce(p_metadata->>'pack_code', 'unknown'),
                         'stripe_session_id', p_session_id)
    );
  elsif p_kind = 'plan' then
    -- Different paid sessions for the same creator must not both leave active
    -- subscriptions in one segment. Serialize before reading/updating plans.
    perform pg_advisory_xact_lock(hashtextextended('listing-plan:' || p_creator_id::text, 0));
    select * into v_plan from public.commercial_plans
      where code = p_metadata->>'plan_code' for share;
    if not found then
      raise exception 'listing_plan_not_found';
    end if;
    v_now := clock_timestamp();
    -- Preserve existing monthly / otherwise-one-year entitlement semantics and
    -- JavaScript calendar overflow behavior, evaluated in UTC.
    v_ends_at := date_trunc('month', v_now)
      + case when v_plan.billing_period = 'monthly' then interval '1 month'
             else interval '1 year' end
      + (v_now - date_trunc('month', v_now));
    update public.creator_plan_subscriptions s
      set status = 'expired', ends_at = v_now
      from public.commercial_plans p
      where s.creator_id = p_creator_id and s.status = 'active'
        and s.plan_id = p.id and p.segment = v_plan.segment;
    insert into public.creator_plan_subscriptions
      (creator_id, plan_id, status, starts_at, ends_at, external_payment_id)
    values (p_creator_id, v_plan.id, 'active', v_now, v_ends_at, p_session_id);
  else
    v_workshop_id := (p_metadata->>'workshop_id')::uuid;
    if v_workshop_id is null then
      raise exception 'missing_workshop_id';
    end if;
    v_now := clock_timestamp();
    -- Matches paidWorkshopListingExpiresAt: two UTC calendar months, with
    -- overflow rather than end-of-month clamping. Duplicate delivery never
    -- moves this expiration because it exits above.
    v_ends_at := date_trunc('month', v_now) + interval '2 months'
      + (v_now - date_trunc('month', v_now));
    update public.workshops
      set listing_fee_status = 'paid', listing_expires_at = v_ends_at,
          is_active = true, updated_at = v_now
      where id = v_workshop_id and creator_id = p_creator_id;
    if not found then
      raise exception 'workshop_listing_not_found_for_creator';
    end if;
  end if;

  update public.stripe_checkout_events set fulfilled_at = clock_timestamp()
    where session_id = p_session_id;
  return 'applied';
  -- No exception handler: ALL writes, including expiration/wallet/ledger and
  -- marker, roll back on any failure. Network-ambiguous retries are safe.
end;
$$;

revoke all on function public.fulfill_listing_checkout(text, uuid, text, jsonb, bigint)
  from public, anon, authenticated;
grant execute on function public.fulfill_listing_checkout(text, uuid, text, jsonb, bigint)
  to service_role;
-- The existing wallet mutation must not remain a public bypass to grants.
revoke all on function public.apply_listing_credit_delta(uuid, integer, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_listing_credit_delta(uuid, integer, text, text, uuid, jsonb)
  to service_role;
revoke all on public.stripe_checkout_events from public, anon, authenticated;

commit;
