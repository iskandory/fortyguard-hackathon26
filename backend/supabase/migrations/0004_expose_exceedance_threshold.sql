-- The UI labelled hours_exceeded_season as "Hours over threshold this
-- season" in a product whose stated thesis is wet-bulb. It is not wet-bulb.
-- /v1/heatmap is a temperature product: its `exceedance` analytic counts
-- hours of AIR TEMPERATURE past `threshold` (API_REFERENCE.md, analytic_type
-- table). Wet-bulb only ever comes from /v1/env_params, which is per-point
-- and has no area-analytic form -- so the seasonal figure is, and can only
-- be, an air-temperature exceedance.
--
-- 855 h above 26 C air temp across a Virginia June-August is credible; the
-- same figure read as wet-bulb is not, and the panel sat directly above a
-- "-0% derating" readout computed from wet-bulb against the same constant.
-- Two different physical quantities, one threshold number, one screen.
--
-- Fix: surface the threshold the number was actually computed against, so
-- the UI can label it honestly and adapt if THRESHOLD_C is retuned, rather
-- than hardcoding "26" in a React component.
create or replace view facility_summary as
with latest_reading as (
  select distinct on (facility_id) facility_id, ts, air_temp_c, wet_bulb_c, heat_index_c
  from facility_readings
  order by facility_id, ts desc
),
current_exceedance as (
  select distinct on (facility_id)
    facility_id, hours_exceeded, longest_run_hours, threshold_c, period_start, period_end
  from facility_exceedance
  order by facility_id, period_end desc
),
peak_forecast as (
  select facility_id, max(predicted_derating_pct) as peak_derating_next_12h_pct
  from facility_forecast
  group by facility_id
),
latest_nws as (
  select distinct on (facility_id) facility_id, nws_temp_f, fortyguard_temp_f, delta_f
  from nws_comparison
  order by facility_id, ts desc
)
select
  f.id, f.name, f.lat, f.lon, f.state, f.county,
  lr.air_temp_c as current_air_temp_c,
  lr.wet_bulb_c as current_wet_bulb_c,
  coalesce(ce.hours_exceeded, 0) as hours_exceeded_season,
  coalesce(ce.longest_run_hours, 0) as longest_run_hours,
  case
    when ce.hours_exceeded is null then 'safe'
    when ce.hours_exceeded >= 850 then 'critical'
    when ce.hours_exceeded >= 825 then 'watch'
    else 'safe'
  end as risk_tier,
  case
    when ce.hours_exceeded is null then 100
    else greatest(0, least(100, round(
      (100 * (1 - (ce.hours_exceeded / nullif((ce.period_end - ce.period_start) * 24.0, 0))))::numeric, 1
    )::double precision))
  end as headroom_score,
  coalesce(pf.peak_derating_next_12h_pct, 0) as peak_derating_next_12h_pct,
  ln.nws_temp_f as nws_grid_temp_f,
  ln.fortyguard_temp_f as fortyguard_local_temp_f,
  ln.delta_f,
  -- appended last: create-or-replace view may only ADD columns at the end
  ce.threshold_c as exceedance_threshold_c
from facilities f
left join latest_reading lr on lr.facility_id = f.id
left join current_exceedance ce on ce.facility_id = f.id
left join peak_forecast pf on pf.facility_id = f.id
left join latest_nws ln on ln.facility_id = f.id;

-- create-or-replace does not reliably carry reloptions across, and 0003's
-- security_invoker is a security control -- re-assert it rather than trust
-- that it survived.
alter view facility_summary set (security_invoker = true);

grant select on facility_summary to anon, authenticated;
