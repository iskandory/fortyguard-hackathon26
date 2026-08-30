-- A facility the ETL has no exceedance data for was rendering as the
-- HEALTHIEST site in the corridor: headroom_score 100, tier 'safe', green
-- check badge, sorted last (= best) in a list ranked worst-first. Equinix
-- Ashburn DC4 has never received data, and the console was presenting that
-- absence as a perfect score.
--
-- Missing data is its own state. Say so instead of defaulting it to good.
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
select
  id, name, lat, lon, state, county,
  current_air_temp_c,
  current_wet_bulb_c,
  hours_exceeded_season,
  longest_run_hours,
  case
    -- was 'safe'; a facility with no measurements is not a safe facility
    when raw_hours is null then 'unknown'
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
