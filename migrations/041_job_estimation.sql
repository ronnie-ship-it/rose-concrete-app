-- 041_job_estimation.sql
--
-- Job estimation intelligence. Adds the storage column + two SQL views
-- that roll up completed projects for the /dashboard/reports/job-estimation
-- page and the smart-estimate chip on the quote editor.
--
-- Rewritten 2026-04-20 — previous revision nested dollar-quoted strings
-- inside DO blocks, which tripped some SQL runners (unterminated
-- $-quote error). This version uses plain DDL only:
--
--   1. ALTER TABLE … ADD COLUMN IF NOT EXISTS  (idempotent)
--   2. DROP VIEW IF EXISTS + CREATE VIEW       (idempotent via drop)
--
-- No PL/pgSQL, no DO blocks, no dollar-quoting, no trigger. The
-- trigger-based auto-refresh of actual_hours_worked can land in a
-- later migration once the core views are in place; until then the
-- column is populated by the app when `completePhaseAction` runs.
--
-- PREREQUISITE: migration 038 (which creates public.project_phases)
-- must be applied first, or step 1 fails with "relation does not
-- exist". Check \dt public.project_phases in the SQL editor before
-- running this migration.

-- ========================================================================
-- 1. Add actual_hours_worked column
-- ========================================================================
alter table public.project_phases
  add column if not exists actual_hours_worked numeric(8, 2);

-- ========================================================================
-- 2. job_phase_durations — per (service_type, phase_kind, sqft bucket)
-- ========================================================================
-- Tenant isolation is enforced by RLS on the underlying tables, not
-- here. The view selects only the columns the estimation page + lib
-- consume, so a plain SELECT from it is safe under the same policies.
drop view if exists public.job_phase_durations;
create view public.job_phase_durations as
select
  p.service_type,
  pp.kind as phase_kind,
  case
    when coalesce(p.sqft, 0) < 500 then 'xs'
    when p.sqft < 1000 then 'sm'
    when p.sqft < 2000 then 'md'
    else 'lg'
  end as sqft_bucket,
  count(*)::int as sample_size,
  avg(pp.actual_hours_worked) as avg_hours,
  avg(
    case
      when pp.end_date is not null and pp.start_date is not null
      then (pp.end_date - pp.start_date) + 1
      else null
    end
  ) as avg_days,
  avg(p.sqft) as avg_sqft,
  avg(p.revenue_cached) as avg_revenue
from public.project_phases pp
join public.projects p on p.id = pp.project_id
where pp.status = 'done'
  and pp.actual_hours_worked is not null
  and p.service_type is not null
group by p.service_type, pp.kind, sqft_bucket;

-- ========================================================================
-- 3. job_total_estimates — per (service_type, sqft bucket)
-- ========================================================================
drop view if exists public.job_total_estimates;
create view public.job_total_estimates as
select
  p.service_type,
  case
    when coalesce(p.sqft, 0) < 500 then 'xs'
    when p.sqft < 1000 then 'sm'
    when p.sqft < 2000 then 'md'
    else 'lg'
  end as sqft_bucket,
  count(*)::int as sample_size,
  avg(p.sqft) as avg_sqft,
  avg(p.revenue_cached) as avg_revenue,
  min(p.revenue_cached) as min_revenue,
  max(p.revenue_cached) as max_revenue,
  percentile_cont(0.5) within group (order by p.revenue_cached) as median_revenue,
  avg(p.revenue_cached / nullif(p.sqft, 0)) as avg_price_per_sqft,
  avg(
    extract(day from (
      (select max(pp2.end_date)::timestamptz
       from public.project_phases pp2
       where pp2.project_id = p.id)
      -
      (select min(pp2.start_date)::timestamptz
       from public.project_phases pp2
       where pp2.project_id = p.id)
    ))
  ) as avg_total_days
from public.projects p
where p.status = 'done'
  and p.service_type is not null
  and p.sqft is not null
  and p.revenue_cached > 0
group by p.service_type, sqft_bucket;
