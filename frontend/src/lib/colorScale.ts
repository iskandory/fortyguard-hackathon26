type RiskTierName = 'safe' | 'watch' | 'critical';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('')
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateHex(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  return rgbToHex([lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t)]);
}

// Sequential, single-hue amber/copper ramp for magnitude (headroom loss).
// score is 0-100 where 100 = full headroom; we invert so the ramp reads
// dark = hottest / least headroom. One hue, light→dark — never a rainbow ramp.
const HEADROOM_RAMP = ['#fdebc8', '#f2b85b', '#e8a33d', '#b5641a', '#7a3c0a'];

export function headroomColor(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const inverted = 100 - clamped;
  const stops = HEADROOM_RAMP.length - 1;
  const pos = (inverted / 100) * stops;
  const i = Math.min(Math.floor(pos), stops - 1);
  return interpolateHex(HEADROOM_RAMP[i], HEADROOM_RAMP[i + 1], pos - i);
}

// Reserved status palette — never reused for any other series.
export const RISK_TIER_COLORS: Record<RiskTierName, string> = {
  safe: '#4c9a6a',
  watch: '#d9a441',
  critical: '#c6493d',
};

// Distinct glyph per tier — state is never encoded by color alone.
export const RISK_TIER_SYMBOLS: Record<RiskTierName, string> = {
  safe: '✓',
  watch: '!',
  critical: '✕',
};

export type { RiskTierName };

export function riskTierColor(tier: RiskTierName): string {
  return RISK_TIER_COLORS[tier];
}

// Diverging: two hues + neutral gray midpoint, for the signed
// NWS-vs-FortyGuard delta. Never used as a sequential ramp.
const DELTA_COOL = '#3e7cb1';
const DELTA_NEUTRAL = '#8b93a1';
const DELTA_WARM = '#c6493d';

export function deltaColor(deltaF: number): string {
  const clamped = Math.max(-10, Math.min(10, deltaF));
  if (clamped === 0) return DELTA_NEUTRAL;
  const t = Math.abs(clamped) / 10;
  return interpolateHex(DELTA_NEUTRAL, clamped > 0 ? DELTA_WARM : DELTA_COOL, t);
}
