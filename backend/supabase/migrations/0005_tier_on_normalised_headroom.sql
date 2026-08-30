-- risk_tier keyed off RAW hours_exceeded (>=850 critical, >=825 watch).
-- Raw hours grow monotonically as the season lengthens, so the tier of a
-- facility whose climate has not changed drifts upward on its own. Observed
-- live: Equinix DC22 moved watch -> critical purely because its measurement
-- window went from 84 to 90 days; its headroom_score was unchanged at 57.3.
--
-- The ETL re-runs daily and judging runs to 15 September, so on the old
-- rule every facility reaches 'critical' long before judging ends and the
-- classification becomes meaningless exactly when it is being assessed.
--
-- headroom_score is already period-normalised -- 100 * (1 - hours/period
-- hours) -- so it is stable as the window grows. Tier off that instead.
--
-- Cutoffs (57.3 / 58.5) are the same corridor tertiles 0002 chose, restated
-- on the normalised axis: they reproduce that migration's intended
-- 4 critical / 3 watch / 3 safe split on the current data. They are
-- calibrated to this corridor's observed spread, not an external standard --
-- there is no published threshold for "fraction of a season above 79 F air
-- temperature", and pretending otherwise would be worse than saying so.
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
),
scored as (
  select
    f.id, f.name, f.lat, f.lon, f.state, f.county,
    lr.air_temp_c as current_air_temp_c,
    lr.wet_bulb_c as current_wet_bulb_c,
    coalesce(ce.hours_exceeded, 0) as hours_exceeded_season,
    coalesce(ce.longest_run_hours, 0) as longest_run_hours,
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
    ce.threshold_c as exceedance_threshold_c,
    ce.hours_exceeded as raw_hours
  from facilities f
  left join latest_reading lr on lr.facility_id = f.id
  left join current_exceedance ce on ce.facility_id = f.id
  left join peak_forecast pf on pf.facility_id = f.id
  left join latest_nws ln on ln.facility_id = f.id
)
-- Column order and names must match the existing view exactly:
-- create-or-replace may only append columns, never reorder or rename.
select
  id, name, lat, lon, state, county,
  current_air_temp_c,
  current_wet_bulb_c,
  hours_exceeded_season,
  longest_run_hours,
  case
    when raw_hours is null then 'safe'
    when headroom_score < 57.3 then 'critical'
    when headroom_score < 58.5 then 'watch'
    else 'safe'
  end as risk_tier,
  headroom_score,
  peak_derating_next_12h_pct,
  nws_grid_temp_f,
  fortyguard_local_temp_f,
  delta_f,
  exceedance_threshold_c
from scored;

alter view facility_summary set (security_invoker = true);
grant select on facility_summary to anon, authenticated;
