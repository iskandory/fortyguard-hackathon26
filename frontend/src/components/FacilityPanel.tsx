import type { FacilitySummary, ForecastPoint } from '../types/facility';
import { formatTempF, formatHours } from '../lib/format';
import { riskTierColor, RISK_TIER_SYMBOLS, headroomColor } from '../lib/colorScale';

interface FacilityPanelProps {
  facility: FacilitySummary | null;
  forecast: ForecastPoint[];
}

/**
 * Selected-facility instrument readout: wet-bulb now, the season's
 * exceedance/persistence analytics, and the forward derating signal.
 */
export function FacilityPanel({ facility, forecast }: FacilityPanelProps) {
  if (!facility) {
    return (
      <div className="facility-panel facility-panel--empty">
        Select a facility on the map or in the ranking list.
      </div>
    );
  }

  const peakForecast = forecast.reduce<ForecastPoint | null>(
    (peak, p) => (!peak || p.predicted_derating_pct > peak.predicted_derating_pct ? p : peak),
    null,
  );

  return (
    <div className="facility-panel">
      <header className="facility-panel__header">
        <h2>{facility.name}</h2>
        <span
          className={`risk-chip risk-chip--${facility.risk_tier}`}
          style={{ borderColor: riskTierColor(facility.risk_tier) }}
        >
          <span aria-hidden="true">{RISK_TIER_SYMBOLS[facility.risk_tier]}</span>
          {facility.risk_tier}
        </span>
      </header>
      <p className="facility-panel__location">
        {facility.county} County, {facility.state} · {facility.lat.toFixed(4)},{' '}
        {facility.lon.toFixed(4)}
      </p>

      <dl className="facility-panel__stats">
        <div>
          <dt>Current air temp</dt>
          <dd>{formatTempF(facility.current_air_temp_c)}</dd>
        </div>
        <div>
          <dt>Current wet-bulb</dt>
          <dd>{formatTempF(facility.current_wet_bulb_c)}</dd>
        </div>
        <div>
          <dt>Hours over threshold this season</dt>
          <dd>{formatHours(facility.hours_exceeded_season)}</dd>
        </div>
        <div>
          <dt>Longest continuous run</dt>
          <dd>{formatHours(facility.longest_run_hours)}</dd>
        </div>
      </dl>

      <div
        className="headroom-meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={facility.headroom_score}
        aria-label="Cooling headroom score"
      >
        <div className="headroom-meter__top">
          <span>Cooling headroom</span>
          <span className="headroom-meter__value">
            {facility.headroom_score} / 100
          </span>
        </div>
        <div className="headroom-meter__track">
          <div
            className="headroom-meter__fill"
            style={{
              width: `${facility.headroom_score}%`,
              backgroundColor: headroomColor(facility.headroom_score),
            }}
          />
        </div>
      </div>

      <div className="derating-signal" data-testid="derating-signal">
        <span className="derating-signal__label">Peak derating · next 12h</span>
        <span className="derating-signal__value">
          −{facility.peak_derating_next_12h_pct}% thermal capacity
        </span>
        {peakForecast && (
          <span className="derating-signal__when">
            worst at +{peakForecast.forecast_hour}h
          </span>
        )}
      </div>
    </div>
  );
}
