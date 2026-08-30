import { describe, it, expect } from 'vitest';
import { headroomColor, riskTierColor, RISK_TIER_SYMBOLS } from '../src/lib/colorScale';

describe('headroomColor', () => {
  it('returns the palest stop at full headroom (score 100)', () => {
    expect(headroomColor(100)).toBe('#fdebc8');
  });
  it('returns the darkest stop at zero headroom', () => {
    expect(headroomColor(0)).toBe('#7a3c0a');
  });
  it('clamps out-of-range scores', () => {
    expect(headroomColor(150)).toBe(headroomColor(100));
    expect(headroomColor(-10)).toBe(headroomColor(0));
  });
});

describe('riskTierColor', () => {
  it('maps each tier to a distinct reserved status color', () => {
    const colors = new Set([
      riskTierColor('safe'),
      riskTierColor('watch'),
      riskTierColor('critical'),
      riskTierColor('unknown'),
    ]);
    expect(colors.size).toBe(4);
  });

  it('gives "no data" its own colour and glyph, not a passing grade', () => {
    // Regression: a facility with no exceedance data used to render as
    // tier 'safe' with a 100 score - the healthiest site in the corridor.
    expect(riskTierColor('unknown')).not.toBe(riskTierColor('safe'));
    expect(RISK_TIER_SYMBOLS.unknown).not.toBe(RISK_TIER_SYMBOLS.safe);
    expect(RISK_TIER_SYMBOLS.unknown).toBe('?');
  });
});
