# CLAUDE.md — FortyGuard × NVIDIA Hackathon'26

Project context for Claude Code working in this repo. This file covers the whole project (both lanes). If you're working the frontend lane only, read [AGENTS.md](AGENTS.md) instead — it's scoped and self-contained for that purpose.

## What this is

A submission for the FortyGuard × NVIDIA Hackathon'26 ("Building the World's Temperature AI"). Deadline **30 August 2026, 11:59 PM GST** — hard close.

**Product:** an AI-factory (data-centre) thermal siting and cooling-headroom copilot. Given a candidate or existing data-centre site, it answers: how many hours per season does this site spend past its cooling design wet-bulb temperature, how long is the worst continuous run, and — via a 12-hour forecast — is tomorrow afternoon going to derate the chillers. Tracks 03 (Industrial & Enterprise) + 05 (Model Designing).

**City / asset set:** Northern Virginia (highest data-centre density in the US — real facility data is dense here, via the PNNL Data Center Atlas).

Full strategy, competitive landscape, judging criteria, and rationale: `HACKATHON_BRIEF.md` (kept locally, gitignored — not part of the tracked repo, since it's competitive/judge-strategy analysis with no value to someone evaluating the code). FortyGuard API details: [API_REFERENCE.md](API_REFERENCE.md) — note its stated historical floor of 2019-01-01 is wrong, three independent sources say 2021-01-01, use 2021.

## Team

- **You (backend + git owner):** Supabase (schema, Edge Functions), the Python ETL pipeline that calls the FortyGuard API and populates cached tables, and all GitHub pushes/merges for the whole repo.
- **Teammate (frontend):** React + Vite, builds against the Supabase table/view contract below. Works from [AGENTS.md](AGENTS.md) and the frontend plan only — do not assume he has read this file or the brief.

## Architecture

```
/frontend   React + Vite, MapLibre GL + deck.gl. Queries Supabase directly
            (PostgREST auto-API) for cached data; falls back to bundled
            mock fixtures when Supabase env vars are absent, so frontend
            work is never blocked on backend being live.
/backend    Python ETL (one-time/periodic script, not a persistent server)
            that calls the FortyGuard API, computes wet-bulb exceedance/
            persistence, pulls the PNNL Data Center Atlas, and writes into
            Supabase. Supabase Edge Functions hold the FortyGuard API key
            and serve the optional "run it fresh" live path.
```

**Why Supabase instead of a hand-rolled backend:** the brief's core architecture constraint is "pre-compute and cache, never call the FortyGuard API on page load" (heatmap/segmentation calls take seconds to minutes). Supabase Postgres + PostGIS *is* a cache-and-serve layer with geospatial queries built in, so there's no custom REST server to write. Edge Functions cover the two things that still need a server: hiding the API key, and the live-refresh path.

## Data contract (Supabase)

Base tables, populated by the backend ETL:

| Table | Grain | Key columns |
|---|---|---|
| `facilities` | one per data centre | `id, name, lat, lon, state, county, has_transmission, has_water, has_fibre` |
| `facility_readings` | facility × timestamp | `facility_id, ts, air_temp_c, wet_bulb_c, heat_index_c` |
| `facility_exceedance` | facility × threshold × period | `facility_id, threshold_c, period_start, period_end, hours_exceeded, longest_run_hours` |
| `facility_forecast` | facility × forecast hour | `facility_id, forecast_ts, forecast_hour, predicted_wet_bulb_c, predicted_derating_pct` |
| `nws_comparison` | facility × timestamp | `facility_id, ts, nws_temp_f, fortyguard_temp_f, delta_f` |

Frontend reads a consolidated view, `facility_summary` (one row per facility: latest reading, current headroom score, risk tier, next-12h peak derating) — defined in the backend plan, contract frozen in [AGENTS.md](AGENTS.md) so frontend can build against it before the view exists.

## Conventions

- **Celsius everywhere in storage and API/DB layers.** Convert to Fahrenheit only at display time (US audience expects °F on screen).
- **Never treat `null` as `0`** — FortyGuard's `env_params` uses `null` for missing values (legacy `-999`, already normalized out during ETL, but don't reintroduce the assumption in frontend code).
- **Secrets:** the FortyGuard API key lives only in Supabase Edge Function secrets, never in `.env` files that get committed, never in frontend code. `.env` must be gitignored before the first commit — a visible key is a stated hackathon disqualification.
- **GeoJSON/coordinates are `[longitude, latitude]`** everywhere in this project, matching the FortyGuard API convention.

Implementation plans (frontend and backend) are kept locally under `docs/superpowers/plans/` and are gitignored — not part of the tracked repo.
