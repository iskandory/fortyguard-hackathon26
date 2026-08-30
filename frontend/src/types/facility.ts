export type RiskTier = 'safe' | 'watch' | 'critical';

/**
 * One row per facility, already joined and pre-computed by the backend ETL
 * (Supabase view `facility_summary`). All temperatures arrive in Celsius —
 * convert to Fahrenheit only at display time via lib/format.ts.
 */
export interface FacilitySummary {
  id: string;
  name: string;
  lat: number;
  lon: number;
  state: string;
  county: string;
  current_air_temp_c: number | null; // null when no reading has landed yet
  current_wet_bulb_c: number | null; // null when no reading has landed yet
  // Exceedance/persistence are computed by /v1/heatmap's analytics, which
  // operate on AIR TEMPERATURE, not wet-bulb (wet-bulb has no area-analytic
  // form -- it only comes per-point from /v1/env_params). Label them as
  // air-temp figures in the UI; conflating them with the wet-bulb thesis is
  // what made the panel read as self-contradictory.
  hours_exceeded_season: number; // hours of air temp past exceedance_threshold_c
  longest_run_hours: number; // longest unbroken run of those hours
  exceedance_threshold_c: number | null; // the threshold the two above were computed against
  risk_tier: RiskTier;
  headroom_score: number; // 0–100, lower = less cooling headroom left
  peak_derating_next_12h_pct: number; // forward signal from the 12h forecast
  nws_grid_temp_f: number | null; // null when no NWS comparison exists yet
  fortyguard_local_temp_f: number | null;
  delta_f: number | null; // fortyguard - nws
}

/** Supabase view `facility_forecast` — one row per facility per hour. */
export interface ForecastPoint {
  facility_id: string;
  forecast_hour: number; // 0–11
  predicted_wet_bulb_c: number;
  predicted_derating_pct: number;
}
