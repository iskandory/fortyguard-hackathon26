import type { FacilitySummary } from '../types/facility';
import { riskTierColor, RISK_TIER_SYMBOLS } from '../lib/colorScale';
import { formatTempF } from '../lib/format';

interface RankingListProps {
  facilities: FacilitySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Facilities ranked worst-headroom-first. Each row pairs a colored tier
 * badge with a distinct glyph — state is never color alone.
 */
export function RankingList({
  facilities,
  selectedId,
  onSelect,
}: RankingListProps) {
  const sorted = [...facilities].sort((a, b) => a.headroom_score - b.headroom_score);

  return (
    <ul className="ranking-list" aria-label="Facilities ranked by remaining cooling headroom, worst first">
      {sorted.map((f, i) => (
        <li key={f.id}>
          <button
            type="button"
            className={
              f.id === selectedId ? 'ranking-item ranking-item--selected' : 'ranking-item'
            }
            onClick={() => onSelect(f.id)}
            aria-pressed={f.id === selectedId}
          >
            <span className="ranking-item__rank">{String(i + 1).padStart(2, '0')}</span>
            <span
              className="ranking-item__badge"
              style={{ backgroundColor: riskTierColor(f.risk_tier) }}
              aria-hidden="true"
            >
              {RISK_TIER_SYMBOLS[f.risk_tier]}
            </span>
            <span className="ranking-item__body">
              <span className="ranking-item__name">{f.name}</span>
              <span className={`ranking-item__tier ranking-item__tier--${f.risk_tier}`}>
                {f.risk_tier}
              </span>
            </span>
            <span className="ranking-item__temp">{formatTempF(f.current_wet_bulb_c)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
