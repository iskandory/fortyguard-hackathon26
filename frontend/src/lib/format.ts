export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function formatTempF(c: number): string {
  return `${Math.round(celsiusToFahrenheit(c))}°F`;
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)} hrs`;
}

export function formatDelta(deltaF: number): string {
  const rounded = Math.round(deltaF * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}°F`;
}
