export function celsiusToFahrenheit(c: number | null): number | null {
  if (c === null) return null;
  return (c * 9) / 5 + 32;
}

export function formatTempF(c: number | null): string {
  const f = celsiusToFahrenheit(c);
  return f === null ? '—' : `${Math.round(f)}°F`;
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)} hrs`;
}

export function formatDelta(deltaF: number | null): string {
  if (deltaF === null) return '—';
  const rounded = Math.round(deltaF * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}°F`;
}
