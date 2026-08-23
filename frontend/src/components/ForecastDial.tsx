import type { CSSProperties } from 'react';

interface ForecastDialProps {
  hour: number;
  onChange: (hour: number) => void;
}

const TICKS = Array.from({ length: 12 }, (_, i) => i);

/**
 * The signature element: a gauge-styled sweep over the 12-hour forecast.
 * Stays a real <input type="range"> underneath — that keeps it
 * keyboard-operable and screen-reader-labeled; the gauge look is pure CSS.
 */
export function ForecastDial({ hour, onChange }: ForecastDialProps) {
  return (
    <div className="forecast-dial">
      <div className="forecast-dial__heading">
        <span className="forecast-dial__title">12-hour forecast scrubber</span>
        <span className="forecast-dial__readout" aria-live="polite">
          {hour === 0 ? 'Now' : `+${hour}h`}
        </span>
      </div>
      <div className="forecast-dial__ticks" aria-hidden="true">
        {TICKS.map((t) => (
          <span
            key={t}
            className={
              t <= hour
                ? 'forecast-dial__tick forecast-dial__tick--lit'
                : 'forecast-dial__tick'
            }
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={11}
        step={1}
        value={hour}
        onChange={(e) => onChange(Number(e.target.value))}
        className="forecast-dial__input"
        style={{ '--fill': `${(hour / 11) * 100}%` } as CSSProperties}
        aria-label="Forecast hour"
        aria-valuemin={0}
        aria-valuemax={11}
        aria-valuenow={hour}
        aria-valuetext={hour === 0 ? 'now' : `${hour} hours from now`}
      />
      <div className="forecast-dial__ends" aria-hidden="true">
        <span>Now</span>
        <span>+12h</span>
      </div>
    </div>
  );
}
