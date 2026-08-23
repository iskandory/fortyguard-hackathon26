import { describe, it, expect } from 'vitest';
import {
  celsiusToFahrenheit,
  formatTempF,
  formatHours,
  formatDelta,
} from '../src/lib/format';

describe('celsiusToFahrenheit', () => {
  it('converts 0C to 32F', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });
  it('converts 100C to 212F', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });
});

describe('formatTempF', () => {
  it('rounds to the nearest degree with a unit suffix', () => {
    expect(formatTempF(24.8)).toBe('77°F');
  });
});

describe('formatHours', () => {
  it('shows minutes under one hour', () => {
    expect(formatHours(0.5)).toBe('30 min');
  });
  it('shows one decimal for an hour or more', () => {
    expect(formatHours(9.5)).toBe('9.5 hrs');
  });
});

describe('formatDelta', () => {
  it('signs positive deltas explicitly', () => {
    expect(formatDelta(5.4)).toBe('+5.4°F');
  });
  it('leaves negative deltas with their native sign', () => {
    expect(formatDelta(-0.6)).toBe('-0.6°F');
  });
});
