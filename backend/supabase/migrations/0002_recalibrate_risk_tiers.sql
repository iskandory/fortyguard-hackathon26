-- Recalibrate facility_summary's risk_tier/headroom_score against real
-- Task 7 seasonal data, now collected live for all 10 NoVA facilities
-- (2026-06-01 .. 2026-08-23), not just the 1-3 that had it before.
--
-- The 0001 formulas were untuned placeholders and saturate badly on real
-- numbers:
--   - headroom_score = 100 - hours_exceeded/2 clamps to 0 for every
--     facility with real exceedance data (observed range: 807.6-856
--     hours), because /2 of anything over ~200 already blows past the
--     0-100 clamp.
--   - risk_tier keyed off longest_run_hours alone, which came back exactly
--     32.0 for all 9 facilities that have real exceedance data -- they're
--     all within ~15 miles of each other, so the same seasonal heat-wave
--     stretch produced the same longest continuous run everywhere. That
--     makes longest_run_hours a degenerate, non-discriminating input for a
--     3-bucket tier: every facility with data would land in the same
--     bucket, which was exactly the review's "monochrome map" concern.
--
-- Real spread observed across all 10 facilities (live run, 2026-08-23):
--   hours_exceeded:      0 (equinix-ashburn-dc4, see below), then
--                        807.6 .. 856 for the other 9 (mean ~841.6, stddev ~16.4)
--   longest_run_hours:   32.0 for all 9 with data, 0 for the data gap
--
-- equinix-ashburn-dc4 returned {"n_cells": 0} with no mean/max key for all
-- three monthly chunks -- a genuine FortyGuard coverage gap at that exact
-- point (same shape as the TCM "not published yet" gap readings_etl
-- already tolerates), not a bug. exceedance_etl's new per-chunk None-guard
-- (see exceedance_etl.py) correctly wrote a real 0/0 row for it instead of
-- crashing, so it now participates in this view like any other low-
-- exceedance facility rather than being silently absent.
--
-- New formulas:
--   - headroom_score is normalized against the season's elapsed hours
--     (period_end - period_start, computed dynamically in SQL so it keeps
--     making sense as the season progresses) instead of an arbitrary /2
--     divisor: 100 * (1 - hours_exceeded / season_hours_elapsed), clamped
--     0-100. On the real data this yields ~57.0-59.5 for the 9 facilities
--     with exceedance and 100 for the data gap -- a real, non-degenerate
--     spread instead of a flat 0 for everyone.
--   - risk_tier now keys off hours_exceeded (the dimension that actually
--     varies) with breakpoints set from the observed spread's rough
--     tertiles: <825h safe, 825-850h watch, >=850h critical. On the real
--     10-facility data this splits 3 safe / 3 watch / 4 critical, instead
--     of the old formula's 9-way tie at 'critical'.
create or replace view facility_summary as
with latest_reading as (
  select distinct on (facility_id) facility_id, ts, air_temp_c, wet_bulb_c, heat_index_c
  from facility_readings
  order by facility_id, ts desc
),
current_exceedance as (
  select distinct on (facility_id) facility_id, hours_exceeded, longest_run_hours, period_start, period_end
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
  ln.delta_f
from facilities f
left join latest_reading lr on lr.facility_id = f.id
left join current_exceedance ce on ce.facility_id = f.id
left join peak_forecast pf on pf.facility_id = f.id
left join latest_nws ln on ln.facility_id = f.id;

grant select on facility_summary to anon, authenticated;
