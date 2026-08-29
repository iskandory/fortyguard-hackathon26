# Thermal Siting Console

**Cooling-headroom intelligence for AI factories.** A data-centre siting and thermal-risk copilot built on FortyGuard temperature data, covering the Northern Virginia corridor — the densest concentration of data centres in the world.

**Live demo:** https://fortyguard-thermal-console.vercel.app/ — opens in incognito, no login, no spinner.

FortyGuard × NVIDIA Hackathon'26 · Track 03 (Industrial & Enterprise) + Track 05 (Model Designing)

---

## The problem

An AI factory does not fail when the air gets hot. It fails when the **wet-bulb** temperature gets hot.

Wet-bulb is the physical floor on evaporative cooling: it is the lowest temperature a cooling tower or adiabatic system can reach by evaporating water. When the ambient wet-bulb climbs toward a facility's cooling design point, the chiller plant loses capacity — and when it crosses that point, the operator must derate compute, spend unplanned power on mechanical cooling, or both.

Two facts make this a siting problem rather than a weather problem:

1. **Wet-bulb varies at street scale.** Two campuses eight kilometres apart, one beside a river and one in the middle of an asphalt corridor, do not share a cooling risk profile. Airport-station weather data cannot resolve that difference — it is reported at one point and interpolated across tens of kilometres.
2. **Duration matters more than peak.** A single hour above the design wet-bulb is survivable; thermal mass absorbs it. Thirty unbroken hours is a derate, because the plant never gets a cool night to recover. Peak temperature is widely reported. **Persistence is not.**

## What it does

For every facility in the corridor, the console answers four questions:

| Question | Metric |
|---|---|
| How often does this site exceed its cooling design wet-bulb? | `hours_exceeded` over the season |
| What is the worst uninterrupted stretch? | `longest_run_hours` — the persistence signal |
| How much cooling margin is left overall? | `headroom_score`, 0–100, and a safe/watch/critical tier |
| Is tomorrow afternoon going to cost me capacity? | 12-hour forecast → `predicted_derating_pct` |

The map extrudes each facility as a column whose height is headroom *lost*, so the corridor's risk profile is legible at a glance. A 12-hour forecast scrubber re-projects every column forward hour by hour, turning "it will be hot tomorrow" into "this site loses this much thermal capacity at this hour."

The cooling design threshold is a configurable parameter (`THRESHOLD_C` in `backend/config.py`, default 26 °C), because the right value differs by facility class and chiller technology. All exceedance and derating figures are computed against it.

## How FortyGuard data is used

FortyGuard temperature data is the core of the project — every risk number traces back to it.

| Endpoint | Use |
|---|---|
| `POST /v1/heatmap` | Tile-level temperature statistics over a per-facility AOI, at ~100 m granularity, for both the current observation and the historical season |
| `POST /v1/env_params` | Derives `wet_bulb_temperature_celsius` and `heat_index_celsius` from the observed air temperature at the facility's exact coordinates |
| `GET /v1/status/{activity_id}` | Both endpoints are asynchronous; the client submits, then polls to completion |

Detailed endpoint notes, payload shapes, and the submit-and-poll contract are in [API_REFERENCE.md](API_REFERENCE.md).

**Resolution is the point.** NVIDIA's Earth-2 downscales weather to roughly 3 km. FortyGuard resolves to ~100 m. A data-centre campus is a 100 m object, so this project deliberately operates in the street-scale gap underneath km-scale climate models rather than duplicating them.

## Architecture

```
FortyGuard API ──▶ Python ETL ──▶ Supabase (Postgres + PostGIS) ──▶ React frontend
                                        ▲
                            Edge Function (holds API key,
                             serves live-refresh path)
```

**The controlling constraint: never call the FortyGuard API on page load.** Heatmap and segmentation calls are asynchronous and take seconds to minutes. A judge or a customer who opens the URL and sees a spinner leaves. So every expensive computation is pre-computed by an offline ETL and cached in Postgres; the frontend reads flat rows through PostgREST and paints in about a second.

Supabase was chosen over a hand-rolled API server precisely because *cache-and-serve with geospatial queries* is what it already is — Postgres for the cache, PostGIS for geography, PostgREST for the read API, Edge Functions for the two things that genuinely need a server: keeping the API key server-side, and the optional "refresh this facility now" path.

**Security posture:** Row Level Security is enabled on all five base tables with SELECT-only policies; anonymous INSERT, UPDATE, and DELETE are rejected at the database. The consolidated `facility_summary` view runs with `security_invoker = true` so base-table RLS applies to it. The FortyGuard API key exists only in Edge Function secrets — never in the frontend bundle, never in a committed file.

### Repository layout

```
/frontend   React 19 + Vite · MapLibre GL + deck.gl · Supabase JS client
            Falls back to bundled fixtures when env vars are absent, so the
            UI is never blocked on the backend being live.
/backend    Python ETL — FortyGuard client, PNNL facility ingestion,
            readings / exceedance / forecast / NWS modules,
            Supabase migrations, and the refresh-facility Edge Function.
```

### Data model

| Table | Grain |
|---|---|
| `facilities` | one row per data centre |
| `facility_readings` | facility × timestamp — air temp, wet-bulb, heat index |
| `facility_exceedance` | facility × threshold × period — hours exceeded, longest run |
| `facility_forecast` | facility × forecast hour — predicted wet-bulb, predicted derating |
| `nws_comparison` | facility × timestamp — FortyGuard vs NWS gridpoint delta |

The frontend reads one consolidated view, `facility_summary`, which joins the latest reading, current exceedance, peak forecast derating, and NWS delta into a single row per facility.

## Data sources

- **FortyGuard Temperature API** — all temperature, wet-bulb, and heat-index data (core dataset)
- **PNNL Data Center Atlas** — real facility identities and coordinates for the Northern Virginia corridor
- **NWS api.weather.gov** — official gridpoint temperatures, used only as an independent comparison to show what street-scale resolution adds over a ~2.5 km grid
- **Carto / OpenStreetMap** — basemap tiles (© OpenStreetMap contributors)

## Running it

**Frontend**
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npx tsc --noEmit && npx vitest run
```
With no Supabase environment variables set, the app serves a bundled fixture dataset, so it runs standalone.

**Backend ETL**
```bash
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
python -m pytest -q
python run_all.py     # requires FORTYGUARD_API_KEY + Supabase service-role credentials
```

Database migrations live in `backend/supabase/migrations/` and apply with `supabase db push`.

## Conventions

- **Celsius everywhere** in storage and API layers; converted to Fahrenheit only at display time.
- **`null` is never treated as `0`.** FortyGuard uses `null` for missing values; a missing temperature renders as `—`, never as a fabricated number.
- **Coordinates are `[longitude, latitude]`**, matching the FortyGuard API and GeoJSON.

## AI tool disclosure

Claude Code (Anthropic) was used throughout development as a pair-programming and code-review assistant across the backend ETL, the frontend, the database schema, and this documentation. All architectural decisions, the product direction, and the final review of every change were made by the team. Some commits carry a `Co-Authored-By: Claude` trailer, which reflects that assistance honestly.

## Team

- **Osman Iskander** — backend, data pipeline, database, deployment
- **Ahmed Saad** — frontend, map and visualisation layer

## Licence

The team retains ownership of this work. FortyGuard is granted a licence to showcase it, per the Hackathon'26 terms.
