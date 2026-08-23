import type { FacilitySummary } from '../types/facility';
import { deltaColor } from '../lib/colorScale';
import { formatDelta } from '../lib/format';

interface NwsDeltaCalloutProps {
  facility: FacilitySummary | null;
}

/**
 * The thesis callout: the official ~2.5 km NWS grid reading vs. the
 * street-scale FortyGuard reading for this exact site. Positive delta =
 * the facility sits on the hotter side of what the official grid resolves.
 */
export function NwsDeltaCallout({ facility }: NwsDeltaCalloutProps) {
  if (!facility) return null;

  if (facility.delta_f === null) {
    return (
      <div className="nws-delta nws-delta--empty">
        <p className="nws-delta__title">Official grid vs. this site</p>
        <p className="nws-delta__delta">No NWS comparison yet for this site.</p>
      </div>
    );
  }

  const color = deltaColor(facility.delta_f);

  return (
    <div className="nws-delta" style={{ borderColor: color }}>
      <p className="nws-delta__title">Official grid vs. this site</p>
      <dl className="nws-delta__rows">
        <div>
          <dt>NWS grid (~2.5 km)</dt>
          <dd>{facility.nws_grid_temp_f}°F</dd>
        </div>
        <div>
          <dt>FortyGuard (60–100 m)</dt>
          <dd>{facility.fortyguard_local_temp_f}°F</dd>
        </div>
      </dl>
      <p className="nws-delta__delta" style={{ color }}>
        {formatDelta(facility.delta_f)} vs. the official reading
      </p>
    </div>
  );
}
