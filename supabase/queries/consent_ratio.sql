-- Consented/total pageviews per day, host and consent.
--
-- Run this alongside any GA4 traffic report. GA4 only knows about granted
-- visitors, so the GA4 number is the numerator and this table supplies the
-- denominator that GA4 cannot see.
--
-- Usage: replace the interval with the reporting window.

-- 1) Daily ratio, all hosts combined.
select
  day,
  sum(views) filter (where consent = 'granted') as granted_views,
  sum(views) filter (where consent = 'denied')  as denied_views,
  sum(views)                                    as total_views,
  round(100.0 * sum(views) filter (where consent = 'granted')
        / nullif(sum(views), 0), 1)             as granted_pct
from public.analytics_pageview_daily
where day >= current_date - interval '28 days'
group by day
order by day desc;

-- 2) Per host, the ratio that belongs next to the traffic numbers.
select
  host,
  sum(views) filter (where consent = 'granted') as granted_views,
  sum(views) filter (where consent = 'denied')  as denied_views,
  round(100.0 * sum(views) filter (where consent = 'granted')
        / nullif(sum(views), 0), 1)             as granted_pct
from public.analytics_pageview_daily
where day >= current_date - interval '28 days'
group by host
order by granted_views desc;

-- 3) Top routes with the ratio. A route whose granted share is far below the
--    site average is a page where the consent banner is costing visibility.
select
  route,
  sum(views)                                    as total_views,
  round(100.0 * sum(views) filter (where consent = 'granted')
        / nullif(sum(views), 0), 1)             as granted_pct
from public.analytics_pageview_daily
where day >= current_date - interval '28 days'
group by route
having sum(views) >= 20
order by total_views desc
limit 25;
