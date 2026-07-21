-- Platform moderators: community showcase + role request approval queues.

create table if not exists public.platform_moderators (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

comment on table public.platform_moderators is
  'Users allowed to moderate community submissions and approve privileged role requests.';

alter table public.platform_moderators enable row level security;

drop policy if exists platform_moderators_service_only on public.platform_moderators;
create policy platform_moderators_service_only
  on public.platform_moderators
  for all
  to authenticated
  using (false)
  with check (false);

insert into public.platform_moderators (user_id)
select id
from auth.users
where lower(email) = lower('peterpeeterspeter@gmail.com')
on conflict (user_id) do nothing;
