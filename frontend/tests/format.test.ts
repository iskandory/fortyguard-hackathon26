import { describe, it, expect } from 'vitest';
import { celsiusToFahrenheit, formatTempF, formatHours } from '../src/lib/format';

describe('celsiusToFahrenheit', () => {
  it('converts 0C to 32F', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });
  it('converts 100C to 212F', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });
  it('does not coerce a missing reading to 0C', () => {
    expect(celsiusToFahrenheit(null)).toBe(null);
  });
});

describe('formatTempF', () => {
  it('rounds to the nearest degree with a unit suffix', () => {
    expect(formatTempF(24.8)).toBe('77°F');
  });
  it('renders a missing reading as a dash, not 32F', () => {
    expect(formatTempF(null)).toBe('—');
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
