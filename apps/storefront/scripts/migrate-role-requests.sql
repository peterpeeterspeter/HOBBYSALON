-- Role approval queue for privileged platform roles (merchant, workshop_host, organizer).

create table if not exists public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  reviewer_user_id uuid,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_requests_role_check check (
    role in ('merchant', 'workshop_host', 'organizer')
  ),
  constraint role_requests_status_check check (
    status in ('pending', 'approved', 'rejected', 'withdrawn')
  )
);

create unique index if not exists idx_role_requests_one_pending_per_user_role
  on public.role_requests(user_id, role)
  where status = 'pending';

create index if not exists idx_role_requests_status_created
  on public.role_requests(status, created_at asc);

create index if not exists idx_role_requests_user_id
  on public.role_requests(user_id);

create trigger trg_role_requests_updated_at
before update on public.role_requests
for each row execute function public.set_updated_at();

alter table public.role_requests enable row level security;

drop policy if exists role_request_owner_select on public.role_requests;
create policy role_request_owner_select
  on public.role_requests
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists role_request_owner_insert on public.role_requests;
create policy role_request_owner_insert
  on public.role_requests
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
  );

-- Privileged roles require admin approval; users may only self-assign user/creator.
drop policy if exists account_role_owner_insert on public.user_account_roles;
create policy account_role_owner_insert
  on public.user_account_roles
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role in ('user', 'creator')
  );

drop policy if exists account_role_owner_update on public.user_account_roles;
create policy account_role_owner_update
  on public.user_account_roles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and role in ('user', 'creator')
  );
