-- Maker referrals: a maker invites a friend. When the friend confirms the
-- e-mail address, both get 3 extra free maker listings. Max 5 rewarded
-- referrals per referrer. The base of 3 free listings lives in app code.

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  invitee_user_id uuid not null unique references auth.users (id) on delete cascade,
  code text not null,
  status text not null check (status in ('rewarded', 'rejected')),
  reject_reason text check (reject_reason in ('self', 'cap_reached', 'unknown_code')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id, status);

create table if not exists public.free_listing_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null check (reason in ('referral_referrer', 'referral_invitee', 'manual')),
  referral_id uuid references public.referrals (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (referral_id, user_id)
);
create index if not exists free_listing_grants_user_idx on public.free_listing_grants (user_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.free_listing_grants enable row level security;

drop policy if exists referral_codes_own on public.referral_codes;
create policy referral_codes_own on public.referral_codes
  for select to authenticated using (user_id = auth.uid());
drop policy if exists referrals_own on public.referrals;
create policy referrals_own on public.referrals
  for select to authenticated using (referrer_user_id = auth.uid() or invitee_user_id = auth.uid());
drop policy if exists free_listing_grants_own on public.free_listing_grants;
create policy free_listing_grants_own on public.free_listing_grants
  for select to authenticated using (user_id = auth.uid());
-- No insert/update policies: only the definer functions below write.

-- Returns the user's code, creating one on first use.
create or replace function public.ensure_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  select code into v_code from referral_codes where user_id = p_user_id;
  if v_code is not null then return v_code; end if;
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into referral_codes (user_id, code) values (p_user_id, v_code);
      return v_code;
    exception when unique_violation then
      select code into v_code from referral_codes where user_id = p_user_id;
      if v_code is not null then return v_code; end if;
    end;
  end loop;
end;
$$;
revoke all on function public.ensure_referral_code(uuid) from public, anon, authenticated;

-- Fires once per user, when the e-mail address becomes confirmed.
create or replace function public.reward_referral_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  v_referrer uuid;
  v_rewarded int;
  v_referral uuid;
begin
  if new.email_confirmed_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return new; end if;
  if v_code = '' or v_code !~ '^[A-Z2-9]{8}$' then return new; end if;
  if exists (select 1 from referrals where invitee_user_id = new.id) then return new; end if;

  select user_id into v_referrer from referral_codes where code = v_code;
  if v_referrer is null then
    return new;
  end if;
  if v_referrer = new.id then
    insert into referrals (referrer_user_id, invitee_user_id, code, status, reject_reason)
    values (v_referrer, new.id, v_code, 'rejected', 'self') on conflict (invitee_user_id) do nothing;
    return new;
  end if;

  -- Serialize rewards per referrer so the cap holds under concurrency.
  perform pg_advisory_xact_lock(hashtext('referral:' || v_referrer::text));
  select count(*) into v_rewarded from referrals
  where referrer_user_id = v_referrer and status = 'rewarded';
  if v_rewarded >= 5 then
    insert into referrals (referrer_user_id, invitee_user_id, code, status, reject_reason)
    values (v_referrer, new.id, v_code, 'rejected', 'cap_reached') on conflict (invitee_user_id) do nothing;
    return new;
  end if;

  insert into referrals (referrer_user_id, invitee_user_id, code, status, rewarded_at)
  values (v_referrer, new.id, v_code, 'rewarded', now())
  on conflict (invitee_user_id) do nothing
  returning id into v_referral;
  if v_referral is null then return new; end if;

  insert into free_listing_grants (user_id, amount, reason, referral_id) values
    (v_referrer, 3, 'referral_referrer', v_referral),
    (new.id, 3, 'referral_invitee', v_referral);
  return new;
exception when others then
  -- A referral problem must never block sign up or confirmation.
  raise warning 'reward_referral_on_confirm failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;
revoke all on function public.reward_referral_on_confirm() from public, anon, authenticated;

drop trigger if exists reward_referral_on_confirm on auth.users;
create trigger reward_referral_on_confirm
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.reward_referral_on_confirm();

-- Extra free maker listings on top of the base allowance in app code.
create or replace function public.free_listing_bonus(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::int from free_listing_grants where user_id = p_user_id
$$;
revoke all on function public.free_listing_bonus(uuid) from public, anon, authenticated;

grant execute on function public.ensure_referral_code(uuid) to service_role;
grant execute on function public.free_listing_bonus(uuid) to service_role;
