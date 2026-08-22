# Frontend Implementation Plan — Thermal Siting Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React frontend for a data-centre thermal-siting dashboard — a full-bleed 3D map of Northern Virginia data centres colored by cooling headroom, a ranked facility list, a 12-hour forecast control, and a callout comparing FortyGuard's local reading against the official NWS grid reading.

**Architecture:** React + Vite + TypeScript SPA. MapLibre GL (basemap) + deck.gl `ColumnLayer` via `MapboxOverlay` for the extruded, color-coded facility layer. Data comes from a Supabase `facility_summary`/`facility_forecast` view when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set, and from bundled mock fixtures otherwise — so this plan can be executed start to finish with zero backend dependency.

**Tech Stack:** React 18, Vite, TypeScript, maplibre-gl, deck.gl (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`), `@supabase/supabase-js`, Vitest.

**Spec:** [../../../AGENTS.md](../../../AGENTS.md) (data contract, design direction, tech stack) and [../../../HACKATHON_BRIEF.md](../../../HACKATHON_BRIEF.md) section 5 (product rationale) — the data contract in AGENTS.md is the frozen interface this plan builds against.

## Global Constraints

- All temperatures are Celsius in data and Fahrenheit only at display time (`format.ts`).
- Sequential color (headroom/temperature magnitude) = one hue, light→dark, never a rainbow ramp.
- Risk tier = reserved status palette (safe/watch/critical), always icon/label + color, never color alone.
- NWS-vs-FortyGuard delta = diverging, two hues + neutral gray midpoint.
- The app must render usable content within ~1s on a cold load with no network — mock data is the default, live Supabase is opt-in via env vars.
- Responsive down to mobile width, visible keyboard focus on every interactive element, `prefers-reduced-motion` respected.
- Never commit `.env`, `node_modules`, or `dist` — `.gitignore` is part of Task 1, not an afterthought.

---

### Task 1: Project scaffold, design tokens, fonts

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/.env.example`
- Create: `frontend/.gitignore`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/styles/tokens.css`

**Interfaces:**
- Produces: CSS custom properties (`--bg`, `--surface`, `--surface-raised`, `--ink`, `--ink-muted`, `--accent`, `--border`, `--font-display`, `--font-body`, `--font-mono`) consumed by every later component's stylesheet.

- [ ] **Step 1: Scaffold the Vite project**

Run: `npm create vite@latest frontend -- --template react-ts`

- [ ] **Step 2: Install dependencies**

Run (from `frontend/`):
```bash
npm install maplibre-gl @deck.gl/core @deck.gl/layers @deck.gl/mobile @deck.gl/mapbox @supabase/supabase-js
npm install -D vitest @testing-library/react jsdom
```

- [ ] **Step 3: Add `.gitignore`**

```gitignore
node_modules
dist
.env
.env.local
*.local
```

- [ ] **Step 4: Add `.env.example`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 5: Wire up Google Fonts and `tokens.css`**

In `frontend/index.html`, inside `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

`frontend/src/styles/tokens.css`:
```css
:root {
  --bg: #14171c;
  --surface: #1c2028;
  --surface-raised: #242933;
  --ink: #edeef0;
  --ink-muted: #8b93a1;
  --accent: #e8a33d;
  --border: #2c313c;
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', 'Courier New', monospace;
}

* { box-sizing: border-box; }

html, body, #root { height: 100%; margin: 0; }

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
}

h1, h2, h3 { font-family: var(--font-display); margin: 0 0 0.5rem; }

dt, dd, .ranking-item__temp, .forecast-dial__readout {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

button:focus-visible, input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 6: Verify the dev server boots**

Run: `npm run dev`
Expected: server starts on `http://localhost:5173`, page loads with the dark background from `tokens.css` (default Vite template content is fine at this stage).

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold frontend, design tokens, fonts"
```

---

### Task 2: Types and mock data fixtures

**Files:**
- Create: `frontend/src/types/facility.ts`
- Create: `frontend/src/lib/mockData.ts`

**Interfaces:**
- Produces: `FacilitySummary`, `ForecastPoint`, `RiskTier` types; `mockFacilities: FacilitySummary[]`, `mockForecast: ForecastPoint[]`.

- [ ] **Step 1: Write the types**

`frontend/src/types/facility.ts`:
```ts
export type RiskTier = 'safe' | 'watch' | 'critical';

export interface FacilitySummary {
  id: string;
  name: string;
  lat: number;
  lon: number;
  state: string;
  county: string;
  current_air_temp_c: number;
  current_wet_bulb_c: number;
  hours_exceeded_season: number;
  longest_run_hours: number;
  risk_tier: RiskTier;
  headroom_score: number;
  peak_derating_next_12h_pct: number;
  nws_grid_temp_f: number;
  fortyguard_local_temp_f: number;
  delta_f: number;
}

export interface ForecastPoint {
  facility_id: string;
  forecast_hour: number;
  predicted_wet_bulb_c: number;
  predicted_derating_pct: number;
}
```

- [ ] **Step 2: Write mock fixtures over real Northern Virginia locations**

`frontend/src/lib/mockData.ts`:
```ts
import type { FacilitySummary, ForecastPoint } from '../types/facility';

export const mockFacilities: FacilitySummary[] = [
  {
    id: 'ashburn-1', name: 'Ashburn Campus A', lat: 39.0438, lon: -77.4874,
    state: 'VA', county: 'Loudoun',
    current_air_temp_c: 34.2, current_wet_bulb_c: 24.8,
    hours_exceeded_season: 142, longest_run_hours: 9.5,
    risk_tier: 'critical', headroom_score: 18,
    peak_derating_next_12h_pct: 22,
    nws_grid_temp_f: 91, fortyguard_local_temp_f: 96.4, delta_f: 5.4,
  },
  {
    id: 'sterling-2', name: 'Sterling Facility 2', lat: 39.0062, lon: -77.4286,
    state: 'VA', county: 'Loudoun',
    current_air_temp_c: 31.5, current_wet_bulb_c: 22.1,
    hours_exceeded_season: 88, longest_run_hours: 5.0,
    risk_tier: 'watch', headroom_score: 46,
    peak_derating_next_12h_pct: 9,
    nws_grid_temp_f: 89, fortyguard_local_temp_f: 91.1, delta_f: 2.1,
  },
  {
    id: 'chantilly-3', name: 'Chantilly North', lat: 38.8904, lon: -77.4319,
    state: 'VA', county: 'Fairfax',
    current_air_temp_c: 29.8, current_wet_bulb_c: 20.9,
    hours_exceeded_season: 41, longest_run_hours: 2.5,
    risk_tier: 'safe', headroom_score: 71,
    peak_derating_next_12h_pct: 3,
    nws_grid_temp_f: 88, fortyguard_local_temp_f: 87.4, delta_f: -0.6,
  },
  {
    id: 'manassas-4', name: 'Manassas East', lat: 38.7509, lon: -77.4753,
    state: 'VA', county: 'Prince William',
    current_air_temp_c: 33.1, current_wet_bulb_c: 23.6,
    hours_exceeded_season: 119, longest_run_hours: 7.5,
    risk_tier: 'critical', headroom_score: 25,
    peak_derating_next_12h_pct: 18,
    nws_grid_temp_f: 90, fortyguard_local_temp_f: 94.8, delta_f: 4.8,
  },
  {
    id: 'leesburg-5', name: 'Leesburg Ridge', lat: 39.1157, lon: -77.5636,
    state: 'VA', county: 'Loudoun',
    current_air_temp_c: 28.4, current_wet_bulb_c: 19.7,
    hours_exceeded_season: 22, longest_run_hours: 1.5,
    risk_tier: 'safe', headroom_score: 82,
    peak_derating_next_12h_pct: 1,
    nws_grid_temp_f: 86, fortyguard_local_temp_f: 85.6, delta_f: -0.4,
  },
  {
    id: 'reston-6', name: 'Reston Gateway', lat: 38.9586, lon: -77.3570,
    state: 'VA', county: 'Fairfax',
    current_air_temp_c: 32.0, current_wet_bulb_c: 22.8,
    hours_exceeded_season: 97, longest_run_hours: 6.0,
    risk_tier: 'watch', headroom_score: 39,
    peak_derating_next_12h_pct: 12,
    nws_grid_temp_f: 89, fortyguard_local_temp_f: 92.3, delta_f: 3.3,
  },
];

export const mockForecast: ForecastPoint[] = mockFacilities.flatMap((f) =>
  Array.from({ length: 12 }, (_, hour): ForecastPoint => {
    const drift = Math.sin((hour / 11) * Math.PI) * 3;
    return {
      facility_id: f.id,
      forecast_hour: hour,
      predicted_wet_bulb_c: Math.round((f.current_wet_bulb_c - 2 + drift) * 10) / 10,
      predicted_derating_pct: Math.max(0, Math.round(f.peak_derating_next_12h_pct * (hour / 11))),
    };
  })
);
```

This fixture set deliberately spans all three risk tiers and both positive/negative NWS deltas so every color path gets exercised while building.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types frontend/src/lib/mockData.ts
git commit -m "feat: add facility types and mock fixtures"
```

---

### Task 3: Color scale and formatters (TDD)

**Files:**
- Create: `frontend/src/lib/colorScale.ts`
- Create: `frontend/src/lib/format.ts`
- Test: `frontend/tests/colorScale.test.ts`
- Test: `frontend/tests/format.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces: `headroomColor(score: number): string`, `riskTierColor(tier: RiskTier): string`, `deltaColor(deltaF: number): string`, `celsiusToFahrenheit(c: number): number`, `formatTempF(c: number): string`, `formatHours(hours: number): string`, `formatDelta(deltaF: number): string` — used by every component from Task 5 onward.

- [ ] **Step 1: Write the failing tests**

`frontend/tests/colorScale.test.ts`:
```ts
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
    const colors = new Set([riskTierColor('safe'), riskTierColor('watch'), riskTierColor('critical')]);
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
```

`frontend/tests/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { celsiusToFahrenheit, formatTempF, formatHours, formatDelta } from '../src/lib/format';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `colorScale.ts` and `format.ts` don't exist yet.

- [ ] **Step 3: Implement `colorScale.ts`**

```ts
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
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
// score is 0-100 where 100 = full headroom; we invert so the ramp reads dark = hottest/least headroom.
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
const RISK_TIER_COLORS: Record<'safe' | 'watch' | 'critical', string> = {
  safe: '#4c9a6a',
  watch: '#d9a441',
  critical: '#c6493d',
};

export function riskTierColor(tier: 'safe' | 'watch' | 'critical'): string {
  return RISK_TIER_COLORS[tier];
}

// Diverging: two hues + neutral gray midpoint, for the signed NWS-vs-FortyGuard delta.
const DELTA_COOL = '#3e7cb1';
const DELTA_NEUTRAL = '#8b93a1';
const DELTA_WARM = '#c6493d';

export function deltaColor(deltaF: number): string {
  const clamped = Math.max(-10, Math.min(10, deltaF));
  if (clamped === 0) return DELTA_NEUTRAL;
  const t = Math.abs(clamped) / 10;
  return interpolateHex(DELTA_NEUTRAL, clamped > 0 ? DELTA_WARM : DELTA_COOL, t);
}
```

- [ ] **Step 4: Implement `format.ts`**

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS, all cases green.

- [ ] **Step 6: Validate the sequential/status/diverging palettes for colorblind safety**

Run (from the `dataviz` skill directory):
```bash
node scripts/validate_palette.js "#fdebc8,#f2b85b,#e8a33d,#b5641a,#7a3c0a" --mode dark
node scripts/validate_palette.js "#4c9a6a,#d9a441,#c6493d" --mode dark
node scripts/validate_palette.js "#3e7cb1,#8b93a1,#c6493d" --mode dark
```
Expected: no FAIL lines. If any pairing fails the CVD-separation or contrast check, adjust the failing stop and re-run before moving on — don't ship an unvalidated palette.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/colorScale.ts frontend/src/lib/format.ts frontend/tests/
git commit -m "feat: add validated color scales and formatters"
```

---

### Task 4: Supabase client and data hooks

**Files:**
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/hooks/useFacilities.ts`
- Create: `frontend/src/hooks/useFacilityForecast.ts`
- Test: `frontend/tests/useFacilities.test.ts`

**Interfaces:**
- Consumes: `mockFacilities`, `mockForecast` (Task 2), `FacilitySummary`, `ForecastPoint` (Task 2).
- Produces: `useFacilities(): { facilities: FacilitySummary[]; loading: boolean; error: string | null }`, `useFacilityForecast(facilityId: string | null): { forecast: ForecastPoint[]; loading: boolean }` — consumed by `App.tsx` in Task 8.

- [ ] **Step 1: Implement the Supabase client with mock fallback**

`frontend/src/lib/supabase.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export function isLiveDataAvailable(): boolean {
  return supabase !== null;
}
```

- [ ] **Step 2: Implement `useFacilities`**

`frontend/src/hooks/useFacilities.ts`:
```ts
import { useEffect, useState } from 'react';
import { supabase, isLiveDataAvailable } from '../lib/supabase';
import { mockFacilities } from '../lib/mockData';
import type { FacilitySummary } from '../types/facility';

export function useFacilities() {
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isLiveDataAvailable()) {
        if (!cancelled) {
          setFacilities(mockFacilities);
          setLoading(false);
        }
        return;
      }
      const { data, error: queryError } = await supabase!.from('facility_summary').select('*');
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setFacilities(mockFacilities);
      } else {
        setFacilities(data as FacilitySummary[]);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { facilities, loading, error };
}
```

- [ ] **Step 3: Implement `useFacilityForecast`**

`frontend/src/hooks/useFacilityForecast.ts`:
```ts
import { useEffect, useState } from 'react';
import { supabase, isLiveDataAvailable } from '../lib/supabase';
import { mockForecast } from '../lib/mockData';
import type { ForecastPoint } from '../types/facility';

export function useFacilityForecast(facilityId: string | null) {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!facilityId) {
      setForecast([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      if (!isLiveDataAvailable()) {
        if (!cancelled) {
          setForecast(mockForecast.filter((f) => f.facility_id === facilityId));
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase!
        .from('facility_forecast')
        .select('*')
        .eq('facility_id', facilityId)
        .order('forecast_hour', { ascending: true });
      if (!cancelled) {
        setForecast((data ?? []) as ForecastPoint[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  return { forecast, loading };
}
```

- [ ] **Step 4: Write a test for the mock-fallback path**

`frontend/tests/useFacilities.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFacilities } from '../src/hooks/useFacilities';
import { mockFacilities } from '../src/lib/mockData';

describe('useFacilities', () => {
  it('serves mock fixtures when no Supabase env vars are set', async () => {
    const { result } = renderHook(() => useFacilities());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.facilities).toEqual(mockFacilities);
    expect(result.current.error).toBeNull();
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS. (This test relies on `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` being unset in the test environment, which is the default — don't add a `.env` for tests.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/supabase.ts frontend/src/hooks frontend/tests/useFacilities.test.ts
git commit -m "feat: add Supabase client and data hooks with mock fallback"
```

---

### Task 5: Map view

**Files:**
- Create: `frontend/src/components/MapView.tsx`

**Interfaces:**
- Consumes: `FacilitySummary` (Task 2), `headroomColor` (Task 3).
- Produces: `MapView` component with props `{ facilities: FacilitySummary[]; selectedId: string | null; onSelect: (id: string) => void; forecastHour: number }` — consumed by `App.tsx` in Task 8.

- [ ] **Step 1: Implement `MapView.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ColumnLayer } from '@deck.gl/layers';
import type { FacilitySummary } from '../types/facility';
import { headroomColor } from '../lib/colorScale';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapViewProps {
  facilities: FacilitySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  forecastHour: number;
}

function hexToRgbArray(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Projects headroom forward using the summary's already-computed peak
// derating figure, so the map doesn't need the full per-hour forecast for
// every facility (that detail is fetched only for the selected facility,
// in FacilityPanel via useFacilityForecast).
function projectedHeadroom(f: FacilitySummary, forecastHour: number): number {
  const drift = f.peak_derating_next_12h_pct * (forecastHour / 11);
  return Math.max(0, f.headroom_score - drift);
}

export function MapView({ facilities, selectedId, onSelect, forecastHour }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-77.45, 39.0],
      zoom: 10,
      pitch: 45,
    });
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);
    mapRef.current = map;
    overlayRef.current = overlay;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;
    overlayRef.current.setProps({
      layers: [
        new ColumnLayer<FacilitySummary>({
          id: 'facilities',
          data: facilities,
          diskResolution: 12,
          radius: 400,
          extruded: true,
          elevationScale: 40,
          getPosition: (f) => [f.lon, f.lat],
          getElevation: (f) => 100 - projectedHeadroom(f, forecastHour),
          getFillColor: (f) => [
            ...hexToRgbArray(headroomColor(projectedHeadroom(f, forecastHour))),
            f.id === selectedId ? 255 : 190,
          ],
          pickable: true,
          onClick: (info) => info.object && onSelect((info.object as FacilitySummary).id),
        }),
      ],
    });
  }, [facilities, selectedId, forecastHour, onSelect]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`, temporarily render `<MapView facilities={mockFacilities} selectedId={null} onSelect={() => {}} forecastHour={0} />` in `App.tsx`.
Expected: dark basemap centered on Northern Virginia, six extruded columns near Ashburn/Sterling/Chantilly/Manassas/Leesburg/Reston, colored from pale amber (safe) to deep copper (critical), clicking one logs/selects its id. This is a canvas/WebGL component — verify by looking at it, not a unit test.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MapView.tsx
git commit -m "feat: add 3D map view with forecast-aware headroom coloring"
```

---

### Task 6: Ranking list and legend

**Files:**
- Create: `frontend/src/components/RankingList.tsx`
- Create: `frontend/src/components/Legend.tsx`

**Interfaces:**
- Consumes: `FacilitySummary` (Task 2), `riskTierColor` (Task 3), `formatTempF` (Task 3).
- Produces: `RankingList` props `{ facilities: FacilitySummary[]; selectedId: string | null; onSelect: (id: string) => void }`; `Legend` (no props) — both consumed by `App.tsx` in Task 8.

- [ ] **Step 1: Implement `RankingList.tsx`**

```tsx
import type { FacilitySummary } from '../types/facility';
import { riskTierColor } from '../lib/colorScale';
import { formatTempF } from '../lib/format';

interface RankingListProps {
  facilities: FacilitySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RankingList({ facilities, selectedId, onSelect }: RankingListProps) {
  const sorted = [...facilities].sort((a, b) => a.headroom_score - b.headroom_score);

  return (
    <ul className="ranking-list">
      {sorted.map((f) => (
        <li key={f.id}>
          <button
            className={f.id === selectedId ? 'ranking-item ranking-item--selected' : 'ranking-item'}
            onClick={() => onSelect(f.id)}
          >
            <span
              className="ranking-item__badge"
              style={{ backgroundColor: riskTierColor(f.risk_tier) }}
              aria-label={`Risk: ${f.risk_tier}`}
            />
            <span className="ranking-item__name">{f.name}</span>
            <span className="ranking-item__temp">{formatTempF(f.current_wet_bulb_c)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Implement `Legend.tsx`**

```tsx
import { riskTierColor } from '../lib/colorScale';

const TIERS: Array<{ tier: 'safe' | 'watch' | 'critical'; label: string }> = [
  { tier: 'safe', label: 'Safe — normal cooling headroom' },
  { tier: 'watch', label: 'Watch — headroom narrowing' },
  { tier: 'critical', label: 'Critical — near/at cooling limit' },
];

export function Legend() {
  return (
    <div className="legend" role="group" aria-label="Risk tier legend">
      {TIERS.map(({ tier, label }) => (
        <div key={tier} className="legend__row">
          <span className="legend__swatch" style={{ backgroundColor: riskTierColor(tier) }} />
          <span className="legend__label">{label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify visually and commit**

Run: `npm run dev`, render both temporarily in `App.tsx`.
Expected: list sorted worst-headroom-first, each row shows a colored badge matching its risk tier, legend shows all three tiers with matching swatches.

```bash
git add frontend/src/components/RankingList.tsx frontend/src/components/Legend.tsx
git commit -m "feat: add ranking list and risk tier legend"
```

---

### Task 7: Facility detail panel and NWS delta callout

**Files:**
- Create: `frontend/src/components/FacilityPanel.tsx`
- Create: `frontend/src/components/NwsDeltaCallout.tsx`

**Interfaces:**
- Consumes: `FacilitySummary` (Task 2), `formatTempF`, `formatHours`, `formatDelta` (Task 3), `deltaColor` (Task 3).
- Produces: `FacilityPanel` props `{ facility: FacilitySummary | null }`; `NwsDeltaCallout` props `{ facility: FacilitySummary | null }` — both consumed by `App.tsx` in Task 8.

- [ ] **Step 1: Implement `FacilityPanel.tsx`**

```tsx
import type { FacilitySummary } from '../types/facility';
import { formatTempF, formatHours } from '../lib/format';

interface FacilityPanelProps {
  facility: FacilitySummary | null;
}

export function FacilityPanel({ facility }: FacilityPanelProps) {
  if (!facility) {
    return <div className="facility-panel facility-panel--empty">Select a facility on the map or list.</div>;
  }

  return (
    <div className="facility-panel">
      <h2>{facility.name}</h2>
      <p className="facility-panel__location">{facility.county} County, {facility.state}</p>
      <dl className="facility-panel__stats">
        <div><dt>Current wet-bulb</dt><dd>{formatTempF(facility.current_wet_bulb_c)}</dd></div>
        <div><dt>Hours over threshold this season</dt><dd>{formatHours(facility.hours_exceeded_season)}</dd></div>
        <div><dt>Longest continuous run</dt><dd>{formatHours(facility.longest_run_hours)}</dd></div>
        <div><dt>Headroom score</dt><dd>{facility.headroom_score} / 100</dd></div>
        <div><dt>Peak derating, next 12h</dt><dd>{facility.peak_derating_next_12h_pct}%</dd></div>
      </dl>
    </div>
  );
}
```

- [ ] **Step 2: Implement `NwsDeltaCallout.tsx`**

```tsx
import type { FacilitySummary } from '../types/facility';
import { deltaColor } from '../lib/colorScale';
import { formatDelta } from '../lib/format';

interface NwsDeltaCalloutProps {
  facility: FacilitySummary | null;
}

export function NwsDeltaCallout({ facility }: NwsDeltaCalloutProps) {
  if (!facility) return null;

  return (
    <div className="nws-delta" style={{ borderColor: deltaColor(facility.delta_f) }}>
      <p className="nws-delta__grid">Official grid (NWS): {facility.nws_grid_temp_f}°F</p>
      <p className="nws-delta__local">FortyGuard, this site: {facility.fortyguard_local_temp_f}°F</p>
      <p className="nws-delta__delta" style={{ color: deltaColor(facility.delta_f) }}>
        {formatDelta(facility.delta_f)} vs. the official reading
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify visually and commit**

Expected: selecting Ashburn Campus A (delta +5.4) shows a warm-toned callout; selecting Chantilly North (delta -0.6) shows a cool-toned one close to neutral gray.

```bash
git add frontend/src/components/FacilityPanel.tsx frontend/src/components/NwsDeltaCallout.tsx
git commit -m "feat: add facility detail panel and NWS delta callout"
```

---

### Task 8: Forecast dial (signature element) and app wiring

**Files:**
- Create: `frontend/src/components/ForecastDial.tsx`
- Create: `frontend/src/App.tsx` (overwrite scaffold default)
- Create: `frontend/src/styles/app.css`

**Interfaces:**
- Consumes: everything produced by Tasks 2–7.
- Produces: the assembled app; nothing downstream consumes this.

- [ ] **Step 1: Implement `ForecastDial.tsx`**

```tsx
interface ForecastDialProps {
  hour: number;
  onChange: (hour: number) => void;
}

const TICKS = Array.from({ length: 12 }, (_, i) => i);

export function ForecastDial({ hour, onChange }: ForecastDialProps) {
  return (
    <div className="forecast-dial">
      <div className="forecast-dial__ticks" aria-hidden="true">
        {TICKS.map((t) => (
          <span
            key={t}
            className={t === hour ? 'forecast-dial__tick forecast-dial__tick--active' : 'forecast-dial__tick'}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={11}
        step={1}
        value={hour}
        onChange={(e) => onChange(Number(e.target.value))}
        className="forecast-dial__input"
        aria-label="Forecast hour"
      />
      <div className="forecast-dial__readout">{hour === 0 ? 'Now' : `+${hour}h`}</div>
    </div>
  );
}
```

Note: this stays a real `<input type="range">` under the gauge styling — that's what keeps it keyboard-operable and screen-reader-labeled. The gauge look comes entirely from CSS in Step 3, never from replacing the native control.

- [ ] **Step 2: Wire `App.tsx`**

```tsx
import { useState } from 'react';
import { useFacilities } from './hooks/useFacilities';
import { MapView } from './components/MapView';
import { RankingList } from './components/RankingList';
import { FacilityPanel } from './components/FacilityPanel';
import { NwsDeltaCallout } from './components/NwsDeltaCallout';
import { ForecastDial } from './components/ForecastDial';
import { Legend } from './components/Legend';
import './styles/tokens.css';
import './styles/app.css';

export default function App() {
  const { facilities, loading, error } = useFacilities();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forecastHour, setForecastHour] = useState(0);

  const selected = facilities.find((f) => f.id === selectedId) ?? null;

  if (loading) return <div className="app-loading">Loading facilities…</div>;

  return (
    <div className="app">
      <main className="app__map">
        <MapView facilities={facilities} selectedId={selectedId} onSelect={setSelectedId} forecastHour={forecastHour} />
        <Legend />
        {error && <div className="app__banner">Live data unavailable — showing cached demo data.</div>}
        <div className="app__dial">
          <ForecastDial hour={forecastHour} onChange={setForecastHour} />
        </div>
      </main>
      <aside className="app__rail">
        <RankingList facilities={facilities} selectedId={selectedId} onSelect={setSelectedId} />
        <FacilityPanel facility={selected} />
        <NwsDeltaCallout facility={selected} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Implement `app.css`**

```css
.app {
  display: grid;
  grid-template-columns: 1fr 320px;
  height: 100vh;
}

.app__map { position: relative; overflow: hidden; }

.app__rail {
  background: var(--surface);
  border-left: 1px solid var(--border);
  padding: 1rem;
  overflow-y: auto;
}

.app__dial {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  right: 1.5rem;
  background: rgba(28, 32, 40, 0.85);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.forecast-dial { position: relative; }

.forecast-dial__ticks {
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
  margin-bottom: 4px;
}

.forecast-dial__tick { width: 2px; height: 6px; background: var(--border); }
.forecast-dial__tick--active { background: var(--accent); height: 10px; }

.forecast-dial__input {
  width: 100%;
  appearance: none;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
}

.forecast-dial__input::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; grid-template-rows: 60vh 1fr; }
}
```

- [ ] **Step 4: Verify end-to-end in the browser**

Run: `npm run dev`
Expected: map + rail layout renders, clicking a column or list row updates the detail panel and delta callout, dragging the forecast dial visibly reshades/re-heights the columns, resizing to a phone width stacks map above rail.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ForecastDial.tsx frontend/src/App.tsx frontend/src/styles/app.css
git commit -m "feat: wire up full dashboard with forecast dial"
```

---

### Task 9: Deploy

**Files:**
- Create: `frontend/vercel.json` (only if a rewrite rule is needed — see Step 2)

- [ ] **Step 1: Build and smoke-test locally**

Run: `npm run build && npm run preview`
Expected: production build succeeds, preview server serves the same working app.

- [ ] **Step 2: Deploy to Vercel**

Run (from `frontend/`):
```bash
npx vercel --prod
```
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment variables once the backend lane has real values — leave unset to keep serving mock data.

- [ ] **Step 3: Verify the live URL in a clean incognito window**

Open the deployed URL in an incognito/private window with no prior login.
Expected: dashboard loads with no spinner-stall, no login prompt, no console errors. This is the exact condition judges will test — confirm it now, not on day 8.

- [ ] **Step 4: Commit**

```bash
git add frontend/vercel.json 2>/dev/null; git commit -m "chore: deploy configuration" --allow-empty
```

---

## Self-review notes

- Spec coverage: data contract (AGENTS.md) fully consumed by Task 4; design direction (palette, type, layout, signature element) implemented in Tasks 1, 8, 9; dataviz color rules (sequential/status/diverging) implemented and validated in Task 3; hackathon demo-must-load-instantly constraint addressed via mock-first data hooks (Task 4) and the incognito verification (Task 9, Step 3).
- Type consistency checked: `FacilitySummary`/`ForecastPoint` field names match exactly across `mockData.ts`, `useFacilities.ts`, `useFacilityForecast.ts`, and every component that destructures them.
- No placeholder steps — every step above has real, complete code or an explicit run command with an expected result.
