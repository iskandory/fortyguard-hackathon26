import type { FacilitySummary, ForecastPoint } from '../types/facility';

/**
 * Cached demo dataset over real Northern Virginia data-centre corridor
 * locations (Ashburn/Sterling/Chantilly/Manassas/Leesburg/Reston).
 * This is what renders instantly on a cold load with zero network —
 * live Supabase swaps in automatically when env vars are set.
 * The fixture set deliberately spans all three risk tiers and both
 * positive/negative NWS deltas so every color path gets exercised.
 */
export const mockFacilities: FacilitySummary[] = [
  {
    id: 'ashburn-1',
    name: 'Ashburn Campus A',
    lat: 39.0438,
    lon: -77.4874,
    state: 'VA',
    county: 'Loudoun',
    current_air_temp_c: 34.2,
    current_wet_bulb_c: 24.8,
    hours_exceeded_season: 142,
    longest_run_hours: 9.5,
    risk_tier: 'critical',
    headroom_score: 18,
    peak_derating_next_12h_pct: 22,
    nws_grid_temp_f: 91,
    fortyguard_local_temp_f: 96.4,
    delta_f: 5.4,
  },
  {
    id: 'sterling-2',
    name: 'Sterling Facility 2',
    lat: 39.0062,
    lon: -77.4286,
    state: 'VA',
    county: 'Loudoun',
    current_air_temp_c: 31.5,
    current_wet_bulb_c: 22.1,
    hours_exceeded_season: 88,
    longest_run_hours: 5.0,
    risk_tier: 'watch',
    headroom_score: 46,
    peak_derating_next_12h_pct: 9,
    nws_grid_temp_f: 89,
    fortyguard_local_temp_f: 91.1,
    delta_f: 2.1,
  },
  {
    id: 'chantilly-3',
    name: 'Chantilly North',
    lat: 38.8904,
    lon: -77.4319,
    state: 'VA',
    county: 'Fairfax',
    current_air_temp_c: 29.8,
    current_wet_bulb_c: 20.9,
    hours_exceeded_season: 41,
    longest_run_hours: 2.5,
    risk_tier: 'safe',
    headroom_score: 71,
    peak_derating_next_12h_pct: 3,
    nws_grid_temp_f: 88,
    fortyguard_local_temp_f: 87.4,
    delta_f: -0.6,
  },
  {
    id: 'manassas-4',
    name: 'Manassas East',
    lat: 38.7509,
    lon: -77.4753,
    state: 'VA',
    county: 'Prince William',
    current_air_temp_c: 33.1,
    current_wet_bulb_c: 23.6,
    hours_exceeded_season: 119,
    longest_run_hours: 7.5,
    risk_tier: 'critical',
    headroom_score: 25,
    peak_derating_next_12h_pct: 18,
    nws_grid_temp_f: 90,
    fortyguard_local_temp_f: 94.8,
    delta_f: 4.8,
  },
  {
    id: 'leesburg-5',
    name: 'Leesburg Ridge',
    lat: 39.1157,
    lon: -77.5636,
    state: 'VA',
    county: 'Loudoun',
    current_air_temp_c: 28.4,
    current_wet_bulb_c: 19.7,
    hours_exceeded_season: 22,
    longest_run_hours: 1.5,
    risk_tier: 'safe',
    headroom_score: 82,
    peak_derating_next_12h_pct: 1,
    nws_grid_temp_f: 86,
    fortyguard_local_temp_f: 85.6,
    delta_f: -0.4,
  },
  {
    id: 'reston-6',
    name: 'Reston Gateway',
    lat: 38.9586,
    lon: -77.357,
    state: 'VA',
    county: 'Fairfax',
    current_air_temp_c: 32.0,
    current_wet_bulb_c: 22.8,
    hours_exceeded_season: 97,
    longest_run_hours: 6.0,
    risk_tier: 'watch',
    headroom_score: 39,
    peak_derating_next_12h_pct: 12,
    nws_grid_temp_f: 89,
    fortyguard_local_temp_f: 92.3,
    delta_f: 3.3,
  },
];

export const mockForecast: ForecastPoint[] = mockFacilities.flatMap((f) =>
  Array.from({ length: 12 }, (_, hour): ForecastPoint => {
    const drift = Math.sin((hour / 11) * Math.PI) * 3;
    return {
      facility_id: f.id,
      forecast_hour: hour,
      predicted_wet_bulb_c:
        Math.round((f.current_wet_bulb_c - 2 + drift) * 10) / 10,
      predicted_derating_pct: Math.max(
        0,
        Math.round(f.peak_derating_next_12h_pct * (hour / 11)),
      ),
    };
  }),
);
