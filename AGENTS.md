# AGENTS.md — Frontend Lane

This file is everything you need. You do not need to read `CLAUDE.md`, `HACKATHON_BRIEF.md`, `API_REFERENCE.md`, or anything under `/backend` — those belong to the backend lane, owned separately. If something here seems to require backend knowledge, it's a gap in this file, not a sign you need to go read those.

## What you're building

A data-centre thermal-siting dashboard for the FortyGuard × NVIDIA Hackathon'26. One page, one job: **show which data centre in Northern Virginia is losing cooling headroom right now, and which one will lose it in the next 12 hours.** The audience judging this includes an NVIDIA data-centre infrastructure specialist — this is an operations instrument, not a consumer weather app.

Deadline: **30 August 2026, 11:59 PM GST.** The demo must load instantly and work in an incognito window with no login — never call anything slow on page load; you're always reading pre-cached data (see Data below).

**Scope boundary:** you own everything in `/frontend`. Backend/Supabase/the FortyGuard API integration is owned by your teammate. You build against the data contract below — treat it as frozen. If the shape doesn't cover something you need, flag it rather than reaching into `/backend`.

Your step-by-step build order is in `docs/superpowers/plans/2026-08-22-frontend-implementation.md` — read that next, it has real code for every task. This file is the standing reference you'll come back to.

---

## Design direction

Get the `frontend-design` skill if your tooling supports skills (Claude Code, Cursor, Codex, Antigravity, Gemini CLI, and a dozen others all can):

```
npx skills add anthropics/skills@frontend-design -g -y
```

Skill page (readable without installing anything): https://skills.sh/anthropics/skills/frontend-design

If you can't or don't want to install it, here's a concrete starting direction distilled from it and from the dataviz skill — follow it or push it further, your call, but don't default to a generic SaaS-dashboard template. This product is closer to a power-plant control room than a consumer app, and the design should say that.

**Avoid the three AI-generated-design defaults:** cream background + serif + terracotta; near-black + one neon accent; newspaper-broadsheet with hairline rules. None of these fit an instrument panel.

**Palette** (UI chrome — graphite control-room base, not pure black, so the map/data stays the brightest thing on screen):
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#14171C` | page base |
| `--surface` | `#1C2028` | panels, cards |
| `--surface-raised` | `#242933` | hover/active state |
| `--ink` | `#EDEEF0` | primary text |
| `--ink-muted` | `#8B93A1` | labels, captions |
| `--accent` | `#E8A33D` | interactive elements only — instrument-amber, spend it sparingly |
| `--border` | `#2C313C` | hairlines |

**Type:** a technical display face used with restraint for headers (e.g. Space Grotesk), a legible workhorse for body copy (e.g. Inter), and — this is the important one for this subject — **a monospace face with tabular numerals for every number on screen** (temperatures, hours-exceeded, coordinates, timestamps): e.g. IBM Plex Mono or JetBrains Mono. Gauge-readout numerals are what make this feel like an instrument rather than a website. All via Google Fonts, self-host if you have time.

**Layout:** full-bleed 3D map as the hero (this map *is* the product's thesis — the gap between official grid temperature and real facility-level temperature). A slim right-hand instrument rail holds the ranked facility list, the forecast control, and the selected-facility readout. Not a hero-stat-plus-three-cards template.

```
┌─────────────────────────────────────────────┬──────────────┐
│                                               │  RANKED      │
│                                               │  FACILITIES  │
│         3D MAP — deck.gl over MapLibre       │  ▸ Ashburn-1 │
│         columns extruded by headroom loss,   │  ▸ Sterling-2│
│         colored by the sequential ramp below │  ▸ ...       │
│                                               ├──────────────┤
│                                               │  SELECTED    │
│                                               │  FACILITY    │
│                                               │  readout     │
├───────────────────────────────────────────────┤  panel      │
│  ◂── 12-HOUR FORECAST DIAL, gauge-styled ──▸  │              │
└─────────────────────────────────────────────┴──────────────┘
```

**Signature element:** the 12-hour forecast control is not a plain HTML range slider — style it as a horizontal gauge sweep with tick marks and a needle-style handle. Scrubbing it recolors the map live. This is the one place to spend real design effort; keep everything else disciplined around it.

**Data-color rules (from the dataviz skill — non-negotiable, not a style preference):**
- Temperature/headroom on the map is a **magnitude** → one hue, light→dark (an amber/copper ramp fits the instrument theme). Never a rainbow blue→red thermal scale — that's the #1 anti-pattern for this kind of data.
- Risk tier (safe/watch/critical, derived from exceedance thresholds) is **state**, not magnitude → use a reserved status palette (good/warning/critical), always paired with an icon + label, never color alone.
- The NWS-vs-FortyGuard delta (the "official grid says X, we say Y" callout) is **signed** → diverging: two hues + a neutral gray midpoint, not sequential.
- Before shipping any palette, run the validator: `node scripts/validate_palette.js "<hex,hex,...>" --mode dark` (script ships inside the dataviz skill directory) — don't eyeball colorblind-safety.
- Every colored series needs a legend. A single map layer needs no legend box, but risk tiers and the diverging delta both do.

---

## Tech stack

React + Vite + TypeScript. Map: MapLibre GL JS (basemap) + deck.gl (`@deck.gl/mapbox` `MapboxOverlay`, works with MapLibre) for the extruded/colored facility layer. Supabase JS client for data. Vitest for the handful of things worth unit-testing (color scale, formatters — not the map itself, which isn't meaningfully unit-testable).

```
/frontend
  package.json
  vite.config.ts
  .env.example
  src/
    main.tsx
    App.tsx
    lib/
      supabase.ts       — Supabase client + mock fallback
      mockData.ts        — fixtures matching the contract, used until backend is live
      colorScale.ts       — sequential/status/diverging scales, dataviz-validated
      format.ts           — °C→°F, hours, timestamps
    types/
      facility.ts         — TS types mirroring the Supabase contract
    components/
      MapView.tsx
      FacilityPanel.tsx
      ForecastDial.tsx
      RankingList.tsx
      NwsDeltaCallout.tsx
      Legend.tsx
    hooks/
      useFacilities.ts
      useFacilityForecast.ts
  tests/
    colorScale.test.ts
    format.test.ts
```

## Data contract

You read one view, `facility_summary` — one row per facility, already joined and pre-computed by the backend ETL. **Build against the mock fixture (`src/lib/mockData.ts`, first task in the plan) and you are never blocked waiting for the real backend** — `useFacilities()` swaps to live Supabase automatically once `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set; without them it silently serves the mock.

```ts
type FacilitySummary = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  state: string;
  county: string;
  current_air_temp_c: number;
  current_wet_bulb_c: number;
  hours_exceeded_season: number;      // exceedance analytic
  longest_run_hours: number;          // persistence analytic
  risk_tier: 'safe' | 'watch' | 'critical';
  headroom_score: number;             // 0–100, lower = less cooling headroom left
  peak_derating_next_12h_pct: number; // forward signal
  nws_grid_temp_f: number;
  fortyguard_local_temp_f: number;
  delta_f: number;                    // fortyguard - nws
};

type ForecastPoint = {
  facility_id: string;
  forecast_hour: number;   // 0–11
  predicted_wet_bulb_c: number;
  predicted_derating_pct: number;
};
```

All temperatures arrive in Celsius — convert to Fahrenheit only in `format.ts`, at the point of display.

## Environment

```
# .env — never commit this
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Both are safe to expose client-side (Supabase anon key + RLS is the intended public-client pattern) — this is not the FortyGuard API key, which never touches the frontend. Leave both blank to develop entirely against mock data.

## Running it

```
npm install
npm run dev       # http://localhost:5173, mock data if env vars unset
npm run test       # vitest
npm run build       # production build for deploy
```
