-- Track successful Acumbamail ESP sync for consented subscribers.
-- Apply through the established reviewed Supabase SQL workflow only.

alter table public.subscribers
  add column if not exists acumbamail_synced_at timestamptz;

comment on column public.subscribers.acumbamail_synced_at is
  'Set when the subscriber was successfully pushed to Acumbamail (downstream ESP).';
