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
  hours_exceeded_season: number; // exceedance analytic
  longest_run_hours: number; // persistence analytic
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
