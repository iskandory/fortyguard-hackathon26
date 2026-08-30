import { riskTierColor, RISK_TIER_SYMBOLS } from '../lib/colorScale';

const TIERS: Array<{ tier: 'safe' | 'watch' | 'critical' | 'unknown'; label: string }> = [
  { tier: 'safe', label: 'Safe — normal cooling headroom' },
  { tier: 'watch', label: 'Watch — headroom narrowing' },
  { tier: 'critical', label: 'Critical — near/at cooling limit' },
  { tier: 'unknown', label: 'No data — not yet measured' },
];

export function Legend() {
  return (
    <div className="legend" role="group" aria-label="Risk tier legend">
      {TIERS.map(({ tier, label }) => (
        <div key={tier} className="legend__row">
          <span
            className="legend__swatch"
            style={{ backgroundColor: riskTierColor(tier) }}
            aria-hidden="true"
          >
            {RISK_TIER_SYMBOLS[tier]}
          </span>
          <span className="legend__label">{label}</span>
        </div>
      ))}
    </div>
  );
}
