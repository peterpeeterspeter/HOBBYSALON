-- Workshop sessions entered via the dashboard were parsed with
-- `new Date("YYYY-MM-DDTHH:mm")` on Vercel (UTC). That treated the creator's
-- Belgium wall clock as UTC, so 10:00 local became 10:00Z and displayed as
-- 11:00 (CET) / 12:00 (CEST) in Europe/Brussels.
--
-- Reinterpret the stored UTC clock face as Europe/Brussels wall time.
-- Skip seed rows (creators without email, or fractional-second timestamps).

update public.workshop_sessions as s
set
  starts_at = ((s.starts_at at time zone 'UTC')::timestamp at time zone 'Europe/Brussels'),
  ends_at = ((s.ends_at at time zone 'UTC')::timestamp at time zone 'Europe/Brussels'),
  updated_at = now()
from public.workshops as w
join public.creators as c on c.id = w.creator_id
where s.workshop_id = w.id
  and c.email is not null
  and extract(second from s.starts_at) = 0
  and extract(milliseconds from s.starts_at) = 0
  and extract(second from s.ends_at) = 0
  and extract(milliseconds from s.ends_at) = 0;
