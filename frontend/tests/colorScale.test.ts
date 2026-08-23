import { describe, it, expect } from 'vitest';
import { headroomColor, riskTierColor, deltaColor } from '../src/lib/colorScale';

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
    ]);
    expect(colors.size).toBe(3);
  });
});

describe('deltaColor', () => {
  it('returns neutral gray at zero delta', () => {
    expect(deltaColor(0)).toBe('#8b93a1');
  });
  it('warms toward the hot pole for positive delta', () => {
    expect(deltaColor(10)).toBe('#c6493d');
  });
  it('cools toward the cold pole for negative delta', () => {
    expect(deltaColor(-10)).toBe('#3e7cb1');
  });
});
