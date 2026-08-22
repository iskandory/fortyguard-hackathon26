# Backend Implementation Plan — Supabase Schema + FortyGuard ETL

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Supabase schema that the frontend already builds against (`facility_summary` and friends), and the Python ETL that populates it from the FortyGuard API and the PNNL Data Center Atlas for Northern Virginia data centres — plus a Supabase Edge Function for the optional "run it fresh" live path.

**Architecture:** Supabase Postgres + PostGIS is the cache/serving layer (auto-REST via PostgREST, read by the frontend directly). A Python script — run manually during the build, then on a daily schedule via GitHub Actions through judging — calls the FortyGuard API's submit-then-poll endpoints and writes results into Supabase using the service-role key. A Supabase Edge Function holds the FortyGuard key as a secret and serves live single-facility refreshes without exposing the key to the browser.

**Tech Stack:** Python 3.11, `requests`, `supabase-py`, `pytest` + `responses` (mocked HTTP), Supabase CLI, Deno (Edge Functions), PostgreSQL/PostGIS.

**Spec:** [../../../CLAUDE.md](../../../CLAUDE.md) (data contract, conventions) and [../../../API_REFERENCE.md](../../../API_REFERENCE.md) (FortyGuard request/response schemas — this plan follows it exactly, including its two known gaps: the heatmap tile-level GeoJSON schema isn't published, so this plan reads the documented `stats_data` aggregate instead of guessing at tile property names; and the doc's stated historical floor of `2019-01-01` is superseded by `2021-01-01` per three independent sources, though it doesn't affect this plan's date ranges since they're all in 2026).

## Global Constraints

- All temperatures stored in Celsius; only `nws_comparison` stores Fahrenheit (matching what NWS returns natively), per the frozen contract in `CLAUDE.md`.
- `FortyGuard` API `null` values are missing data, never coerced to `0` — every extraction takes the last non-null value or stores `null`.
- Coordinates are US-only (FortyGuard hard constraint) — Northern Virginia facilities only for this build.
- `/v1/heatmap` `filter_type: 4` (range of days) is capped at **≤ 1 month** — seasonal exceedance/persistence must chunk by calendar month and aggregate, never send a 3-month range in one call.
- `/v1/heatmap` `filter_type: 2` (range of hours) is capped at **≤ 23h and same calendar day** — a 12-hour forecast starting late in the day must split across the midnight boundary.
- GeoJSON coordinates are `[longitude, latitude]` order everywhere, matching FortyGuard's convention.
- The FortyGuard API key lives only in `backend/.env` locally (gitignored) and in the Supabase Edge Function secret / GitHub Actions secret in deployment — never in a table, never in frontend-reachable code.
- Supabase writes use the **service-role key** (bypasses RLS); the frontend's anon key only ever gets read access via RLS policies.
- Credits deduct only on `Completed` status — a `Failed` activity is free, so the client should let failures surface rather than silently retrying forever.

---

### Task 1: Supabase schema migration

**Files:**
- Create: `backend/supabase/migrations/0001_init_schema.sql`

**Interfaces:**
- Produces: tables `facilities`, `facility_readings`, `facility_exceedance`, `facility_forecast`, `nws_comparison`; view `facility_summary` — this is the exact contract every later task and the (already-built) frontend read against.

- [ ] **Step 1: Write the migration**

```sql
create extension if not exists postgis;

create table facilities (
  id text primary key,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  geom geography(Point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) stored,
  state text not null,
  county text not null,
  has_transmission boolean not null default false,
  has_water boolean not null default false,
  has_fibre boolean not null default false,
  created_at timestamptz not null default now()
);

create table facility_readings (
  id bigint generated always as identity primary key,
  facility_id text not null references facilities(id) on delete cascade,
  ts timestamptz not null,
  air_temp_c double precision,
  wet_bulb_c double precision,
  heat_index_c double precision,
  unique (facility_id, ts)
);

create table facility_exceedance (
  id bigint generated always as identity primary key,
  facility_id text not null references facilities(id) on delete cascade,
  threshold_c double precision not null,
  period_start date not null,
  period_end date not null,
  hours_exceeded double precision not null,
  longest_run_hours double precision not null,
  unique (facility_id, threshold_c, period_start, period_end)
);

create table facility_forecast (
  id bigint generated always as identity primary key,
  facility_id text not null references facilities(id) on delete cascade,
  forecast_ts timestamptz not null,
  forecast_hour int not null check (forecast_hour between 0 and 11),
  predicted_wet_bulb_c double precision,
  predicted_derating_pct double precision,
  unique (facility_id, forecast_hour)
);

create table nws_comparison (
  id bigint generated always as identity primary key,
  facility_id text not null references facilities(id) on delete cascade,
  ts timestamptz not null,
  nws_temp_f double precision,
  fortyguard_temp_f double precision,
  delta_f double precision,
  unique (facility_id, ts)
);

-- Public read-only cache: no facility/thermal data here is sensitive,
-- and all writes go through the service-role key from the ETL, which
-- bypasses RLS entirely — so these policies only ever grant SELECT.
alter table facilities enable row level security;
alter table facility_readings enable row level security;
alter table facility_exceedance enable row level security;
alter table facility_forecast enable row level security;
alter table nws_comparison enable row level security;

create policy "public read" on facilities for select using (true);
create policy "public read" on facility_readings for select using (true);
create policy "public read" on facility_exceedance for select using (true);
create policy "public read" on facility_forecast for select using (true);
create policy "public read" on nws_comparison for select using (true);

create or replace view facility_summary as
with latest_reading as (
  select distinct on (facility_id) facility_id, ts, air_temp_c, wet_bulb_c, heat_index_c
  from facility_readings
  order by facility_id, ts desc
),
current_exceedance as (
  select distinct on (facility_id) facility_id, hours_exceeded, longest_run_hours
  from facility_exceedance
  order by facility_id, period_end desc
),
peak_forecast as (
  select facility_id, max(predicted_derating_pct) as peak_derating_next_12h_pct
  from facility_forecast
  group by facility_id
),
latest_nws as (
  select distinct on (facility_id) facility_id, nws_temp_f, fortyguard_temp_f, delta_f
  from nws_comparison
  order by facility_id, ts desc
)
select
  f.id, f.name, f.lat, f.lon, f.state, f.county,
  lr.air_temp_c as current_air_temp_c,
  lr.wet_bulb_c as current_wet_bulb_c,
  coalesce(ce.hours_exceeded, 0) as hours_exceeded_season,
  coalesce(ce.longest_run_hours, 0) as longest_run_hours,
  case
    when ce.longest_run_hours is null then 'safe'
    when ce.longest_run_hours >= 8 then 'critical'
    when ce.longest_run_hours >= 3 then 'watch'
    else 'safe'
  end as risk_tier,
  greatest(0, least(100, 100 - coalesce(ce.hours_exceeded, 0) / 2)) as headroom_score,
  coalesce(pf.peak_derating_next_12h_pct, 0) as peak_derating_next_12h_pct,
  ln.nws_temp_f as nws_grid_temp_f,
  ln.fortyguard_temp_f as fortyguard_local_temp_f,
  ln.delta_f
from facilities f
left join latest_reading lr on lr.facility_id = f.id
left join current_exceedance ce on ce.facility_id = f.id
left join peak_forecast pf on pf.facility_id = f.id
left join latest_nws ln on ln.facility_id = f.id;

grant select on facility_summary to anon, authenticated;
```

The `risk_tier`/`headroom_score` formulas are a defensible starting heuristic (tier by longest continuous run: <3h safe, 3–8h watch, ≥8h critical; headroom = 100 minus half the season's exceedance hours, clamped 0–100) — tune the constants once real seasonal numbers are in, don't rebuild the view.

- [ ] **Step 2: Apply the migration**

Run (from `backend/`, after `supabase init` and `supabase link --project-ref <your-project-ref>`):
```bash
supabase db push
```
Expected: five tables and one view created with no errors; check in the Supabase dashboard's Table Editor.

- [ ] **Step 3: Verify the view is queryable with the anon key**

Run:
```bash
curl "https://<project-ref>.supabase.co/rest/v1/facility_summary?select=*" \
  -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
```
Expected: `200` with an empty JSON array `[]` (no facilities loaded yet — that's Task 5). A `401`/`403` here means the RLS policy or the view grant is wrong; fix before moving on, since this is the exact call the frontend makes.

- [ ] **Step 4: Commit**

```bash
git add backend/supabase/migrations/0001_init_schema.sql
git commit -m "feat: add Supabase schema and facility_summary view"
```

---

### Task 2: Backend project scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/config.py`
- Create: `backend/supabase_client.py`

**Interfaces:**
- Produces: `get_supabase() -> Client`; config constants `THRESHOLD_C`, `SEASON_START`, `FORECAST_HOURS`, `MAX_DERATE_PCT`, `DERATE_RAMP_C`, `GRANULARITY_M` — consumed by every ETL task from Task 5 onward.

- [ ] **Step 1: Write `requirements.txt`**

```
requests>=2.31
supabase>=2.4
python-dotenv>=1.0
pytest>=8.0
responses>=0.25
```

- [ ] **Step 2: Write `.env.example` and `.gitignore`**

`backend/.env.example`:
```
FORTYGUARD_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`backend/.gitignore`:
```
.env
__pycache__/
*.pyc
data/
.venv/
```

`data/` holds the downloaded PNNL atlas file (Task 5) — large, not source, never committed.

- [ ] **Step 3: Write `config.py`**

```python
from datetime import date

THRESHOLD_C = 26.0        # cooling design wet-bulb threshold; tune per facility class
SEASON_START = date(2026, 6, 1)
FORECAST_HOURS = 12
MAX_DERATE_PCT = 30.0
DERATE_RAMP_C = 5.0        # degrees above threshold at which derating hits MAX_DERATE_PCT
GRANULARITY_M = 100
```

- [ ] **Step 4: Write `supabase_client.py`**

```python
import os
from functools import lru_cache
from supabase import create_client, Client


@lru_cache
def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, service_key)
```

- [ ] **Step 5: Install and verify**

Run:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env   # then fill in the three values
python -c "from supabase_client import get_supabase; print(get_supabase())"
```
Expected: prints a `Client` object with no errors (confirms `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are valid).

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/.env.example backend/.gitignore backend/config.py backend/supabase_client.py
git commit -m "chore: scaffold backend project and config"
```

---

### Task 3: Geo and date helpers (TDD)

**Files:**
- Create: `backend/geo.py`
- Create: `backend/dates.py`
- Test: `backend/tests/test_geo.py`
- Test: `backend/tests/test_dates.py`

**Interfaces:**
- Produces: `point_to_aoi(lat: float, lon: float, half_width_deg: float = 0.0025) -> dict`, `month_chunks(start: date, end: date) -> Iterator[tuple[date, date]]` — consumed by Tasks 6–8.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_geo.py`:
```python
from geo import point_to_aoi


def test_point_to_aoi_produces_closed_polygon():
    aoi = point_to_aoi(39.0438, -77.4874)
    ring = aoi["features"][0]["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1]
    assert len(ring) == 5


def test_point_to_aoi_centers_on_the_point():
    lat, lon = 39.0438, -77.4874
    aoi = point_to_aoi(lat, lon, half_width_deg=0.001)
    ring = aoi["features"][0]["geometry"]["coordinates"][0]
    lons = [c[0] for c in ring]
    lats = [c[1] for c in ring]
    assert min(lons) < lon < max(lons)
    assert min(lats) < lat < max(lats)
```

`backend/tests/test_dates.py`:
```python
from datetime import date
from dates import month_chunks


def test_month_chunks_splits_on_month_boundaries():
    chunks = list(month_chunks(date(2026, 6, 15), date(2026, 8, 5)))
    assert chunks == [
        (date(2026, 6, 15), date(2026, 6, 30)),
        (date(2026, 7, 1), date(2026, 7, 31)),
        (date(2026, 8, 1), date(2026, 8, 5)),
    ]


def test_month_chunks_handles_a_single_partial_month():
    chunks = list(month_chunks(date(2026, 8, 1), date(2026, 8, 5)))
    assert chunks == [(date(2026, 8, 1), date(2026, 8, 5))]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/ -v`
Expected: FAIL — `geo.py` and `dates.py` don't exist yet.

- [ ] **Step 3: Implement `geo.py`**

```python
def point_to_aoi(lat: float, lon: float, half_width_deg: float = 0.0025) -> dict:
    """~0.0025deg is ~275m at Northern Virginia's latitude — small enough that a
    100m-granularity heatmap call returns only a few tiles, so the AOI's
    aggregate stats represent this one facility rather than a wider area."""
    ring = [
        [lon - half_width_deg, lat - half_width_deg],
        [lon + half_width_deg, lat - half_width_deg],
        [lon + half_width_deg, lat + half_width_deg],
        [lon - half_width_deg, lat + half_width_deg],
        [lon - half_width_deg, lat - half_width_deg],
    ]
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}
        ],
    }
```

- [ ] **Step 4: Implement `dates.py`**

```python
import calendar
from datetime import date, timedelta
from typing import Iterator


def month_chunks(start: date, end: date) -> Iterator[tuple[date, date]]:
    """Splits [start, end] into <=1-month pieces, required because FortyGuard's
    heatmap filter_type 4 caps a single request at one month."""
    current = start
    while current <= end:
        last_day = calendar.monthrange(current.year, current.month)[1]
        chunk_end = min(date(current.year, current.month, last_day), end)
        yield (current, chunk_end)
        current = chunk_end + timedelta(days=1)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest backend/tests/ -v`
Expected: PASS, all four cases green.

- [ ] **Step 6: Commit**

```bash
git add backend/geo.py backend/dates.py backend/tests/test_geo.py backend/tests/test_dates.py
git commit -m "feat: add AOI and month-chunking helpers"
```

---

### Task 4: FortyGuard API client (TDD, mocked HTTP)

**Files:**
- Create: `backend/fortyguard_client.py`
- Test: `backend/tests/test_fortyguard_client.py`

**Interfaces:**
- Consumes: nothing (talks to the network / mocked network only).
- Produces: `FortyGuardClient(api_key: str | None = None)` with `.heatmap(polygon_aoi, start_date, filter_type=1, granularity=100, analytic_type=None, threshold=None, direction="above", start_time=None, end_time=None, end_date=None) -> dict` and `.env_params(latitude, longitude, temperature, start_date, filter_type=1, start_time=None, end_time=None, end_date=None, analysis=None) -> dict`, both returning the `result` object from a `Completed` activity; raises `FortyGuardError` on `Failed` or timeout. Consumed by Tasks 6–8.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_fortyguard_client.py`:
```python
import responses
import fortyguard_client
from fortyguard_client import FortyGuardClient, FortyGuardError

BASE_URL = "https://api.fortyguard.com"


@responses.activate
def test_heatmap_submits_and_polls_to_completion(monkeypatch):
    monkeypatch.setattr(fortyguard_client.time, "sleep", lambda _: None)
    responses.add(
        responses.POST, f"{BASE_URL}/v1/heatmap",
        json={"error": False, "data": {"activity_id": "abc-123"}}, status=200,
    )
    responses.add(
        responses.GET, f"{BASE_URL}/v1/status/abc-123",
        json={"data": {"activity_id": "abc-123", "status": "Processing"}}, status=200,
    )
    responses.add(
        responses.GET, f"{BASE_URL}/v1/status/abc-123",
        json={
            "data": {
                "activity_id": "abc-123",
                "status": "Completed",
                "result": {"stats_data": {"Temperature_stats": {"Mean": 31.2}}},
            }
        },
        status=200,
    )

    client = FortyGuardClient(api_key="test-key")
    result = client.heatmap(
        polygon_aoi={"type": "FeatureCollection", "features": []},
        start_date="2026-08-01", filter_type=1, start_time="14:00",
    )

    assert result["stats_data"]["Temperature_stats"]["Mean"] == 31.2


@responses.activate
def test_failed_activity_raises(monkeypatch):
    monkeypatch.setattr(fortyguard_client.time, "sleep", lambda _: None)
    responses.add(
        responses.POST, f"{BASE_URL}/v1/heatmap",
        json={"data": {"activity_id": "bad-1"}}, status=200,
    )
    responses.add(
        responses.GET, f"{BASE_URL}/v1/status/bad-1",
        json={"data": {"activity_id": "bad-1", "status": "Failed"}}, status=200,
    )

    client = FortyGuardClient(api_key="test-key")
    try:
        client.heatmap(polygon_aoi={"type": "FeatureCollection", "features": []}, start_date="2026-08-01")
        assert False, "expected FortyGuardError"
    except FortyGuardError:
        pass


@responses.activate
def test_env_params_sends_the_documented_shape(monkeypatch):
    monkeypatch.setattr(fortyguard_client.time, "sleep", lambda _: None)
    responses.add(
        responses.POST, f"{BASE_URL}/v1/env_params",
        json={"data": {"activity_id": "env-1"}}, status=200,
    )
    responses.add(
        responses.GET, f"{BASE_URL}/v1/status/env-1",
        json={
            "data": {
                "activity_id": "env-1",
                "status": "Completed",
                "result": {
                    "metadata": {"timestamps": ["2026-08-22T14:00:00+00:00"]},
                    "locations": [{"parameters": {"wet_bulb_temperature_celsius": [24.1]}}],
                },
            }
        },
        status=200,
    )

    client = FortyGuardClient(api_key="test-key")
    result = client.env_params(
        latitude=39.04, longitude=-77.48, temperature=31.2,
        start_date="2026-08-22", filter_type=1, start_time="14:00",
        analysis=["wet_bulb_temperature_celsius"],
    )

    sent_body = responses.calls[0].request.body
    assert b'"temperature": 31.2' in sent_body or b'"temperature":31.2' in sent_body
    assert result["locations"][0]["parameters"]["wet_bulb_temperature_celsius"] == [24.1]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_fortyguard_client.py -v`
Expected: FAIL — `fortyguard_client.py` doesn't exist yet.

- [ ] **Step 3: Implement `fortyguard_client.py`**

```python
import os
import time
from typing import Optional

import requests

BASE_URL = "https://api.fortyguard.com"
POLL_INTERVAL_SECONDS = 4
POLL_TIMEOUT_SECONDS = 300
MAX_LEADING_404_RETRIES = 5


class FortyGuardError(Exception):
    pass


class FortyGuardClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ["FORTYGUARD_API_KEY"]
        self.session = requests.Session()
        self.session.headers.update({"api-key": self.api_key, "Content-Type": "application/json"})

    def _submit(self, endpoint: str, payload: dict) -> str:
        resp = self.session.post(f"{BASE_URL}{endpoint}", json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()["data"]["activity_id"]

    def _poll(self, activity_id: str) -> dict:
        deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
        leading_404s = 0
        while time.monotonic() < deadline:
            resp = self.session.get(f"{BASE_URL}/v1/status/{activity_id}", timeout=30)
            if resp.status_code == 404 and leading_404s < MAX_LEADING_404_RETRIES:
                # A 404 immediately after submission is expected and retryable.
                leading_404s += 1
                time.sleep(POLL_INTERVAL_SECONDS)
                continue
            resp.raise_for_status()
            body = resp.json()["data"]
            status = body["status"]
            if status == "Completed":
                return body["result"]
            if status == "Failed":
                raise FortyGuardError(f"activity {activity_id} failed: {body}")
            time.sleep(POLL_INTERVAL_SECONDS)
        raise FortyGuardError(f"activity {activity_id} timed out after {POLL_TIMEOUT_SECONDS}s")

    def _run(self, endpoint: str, payload: dict) -> dict:
        activity_id = self._submit(endpoint, payload)
        return self._poll(activity_id)

    def heatmap(
        self,
        polygon_aoi: dict,
        start_date: str,
        filter_type: int = 1,
        granularity: int = 100,
        analytic_type: Optional[str] = None,
        threshold: Optional[float] = None,
        direction: str = "above",
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        date_time = {"start_date": start_date, "filter_type": filter_type}
        if start_time:
            date_time["start_time"] = start_time
        if end_time:
            date_time["end_time"] = end_time
        if end_date:
            date_time["end_date"] = end_date
        payload = {"polygon_aoi": polygon_aoi, "date_time": date_time, "granularity": granularity}
        if analytic_type:
            payload["analytic_type"] = analytic_type
            payload["threshold"] = threshold if threshold is not None else 30
            payload["direction"] = direction
        return self._run("/v1/heatmap", payload)

    def env_params(
        self,
        latitude: float,
        longitude: float,
        temperature: float,
        start_date: str,
        filter_type: int = 1,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        end_date: Optional[str] = None,
        analysis: Optional[list] = None,
    ) -> dict:
        date_time = {"start_date": start_date, "filter_type": filter_type}
        if start_time:
            date_time["start_time"] = start_time
        if end_time:
            date_time["end_time"] = end_time
        if end_date:
            date_time["end_date"] = end_date
        payload = {"latitude": latitude, "longitude": longitude, "temperature": temperature, "date_time": date_time}
        if analysis:
            payload["analysis"] = analysis
        return self._run("/v1/env_params", payload)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_fortyguard_client.py -v`
Expected: PASS, all three cases green.

- [ ] **Step 5: Commit**

```bash
git add backend/fortyguard_client.py backend/tests/test_fortyguard_client.py
git commit -m "feat: add FortyGuard API client with submit-then-poll"
```

---

### Task 5: PNNL Data Center Atlas ingestion

**Files:**
- Create: `backend/pnnl_ingest.py`

**Interfaces:**
- Consumes: `get_supabase` (Task 2).
- Produces: `run(state_filter: str = "VA") -> list[dict]` returning the facility rows it wrote — the `facilities` list every later ETL task (6–9) is called with.

- [ ] **Step 1: Download and inspect the real atlas file first**

The PNNL IM3 Data Center Atlas (`immm.pnnl.gov/datacenter-atlas`) doesn't publish its exact export schema in FortyGuard's docs or the hackathon brief — it has to be confirmed against the real file before the field-name mapping below can be trusted. Download it, save it as `backend/data/pnnl_datacenter_atlas.geojson`, open it, and note the actual property keys for name/state/county/transmission/water/fibre. Update `FIELD_MAP` in Step 2 to match — the values below are best-guesses from the brief's description ("transmission lines, public water service areas, ≥1 Gbps fibre coverage"), not confirmed field names.

- [ ] **Step 2: Implement `pnnl_ingest.py`**

```python
import json
from pathlib import Path

from supabase_client import get_supabase

ATLAS_PATH = Path(__file__).parent / "data" / "pnnl_datacenter_atlas.geojson"

# Confirm these against the real downloaded file (Step 1) before trusting output.
FIELD_MAP = {
    "name": "name",
    "state": "state",
    "county": "county",
    "transmission": "has_transmission_line",
    "water": "has_water_service",
    "fibre": "has_fibre_1gbps",
}


def load_features(state_filter: str = "VA") -> list[dict]:
    raw = json.loads(ATLAS_PATH.read_text())
    return [
        f for f in raw["features"]
        if str(f["properties"].get(FIELD_MAP["state"], "")).upper() in (state_filter, f"US-{state_filter}")
    ]


def run(state_filter: str = "VA") -> list[dict]:
    supabase = get_supabase()
    facilities = []

    for feature in load_features(state_filter):
        props = feature["properties"]
        lon, lat = feature["geometry"]["coordinates"][:2]
        name = props[FIELD_MAP["name"]]
        facilities.append({
            "id": props.get("facility_id") or props.get("id") or f"{name}-{lat:.4f}-{lon:.4f}",
            "name": name,
            "lat": lat,
            "lon": lon,
            "state": str(props.get(FIELD_MAP["state"], state_filter)),
            "county": str(props.get(FIELD_MAP["county"], "")),
            "has_transmission": bool(props.get(FIELD_MAP["transmission"])),
            "has_water": bool(props.get(FIELD_MAP["water"])),
            "has_fibre": bool(props.get(FIELD_MAP["fibre"])),
        })

    if facilities:
        supabase.table("facilities").upsert(facilities, on_conflict="id").execute()
    return facilities
```

- [ ] **Step 3: Run against the real file and verify**

Run:
```bash
cd backend
python -c "import pnnl_ingest; rows = pnnl_ingest.run('VA'); print(len(rows), rows[0] if rows else None)"
```
Expected: prints a facility count > 0 and one sample row with a real Northern Virginia name/lat/lon. Then re-run the Task 1 Step 3 `curl` against `facility_summary` — it should now return that many rows (with all thermal fields still `null`, since Tasks 6–9 haven't run yet).

- [ ] **Step 4: Commit**

```bash
git add backend/pnnl_ingest.py
git commit -m "feat: ingest PNNL Data Center Atlas into facilities table"
```

---

### Task 6: Current readings ETL

**Files:**
- Create: `backend/readings_etl.py`

**Interfaces:**
- Consumes: `FortyGuardClient.heatmap`/`.env_params` (Task 4), `point_to_aoi` (Task 3), `get_supabase` (Task 2), facility rows shaped like Task 5's output (`id`, `lat`, `lon`).
- Produces: `run(client: FortyGuardClient, facilities: list[dict]) -> None`, writing into `facility_readings`.

- [ ] **Step 1: Implement `readings_etl.py`**

```python
from datetime import datetime, timezone

from fortyguard_client import FortyGuardClient
from geo import point_to_aoi
from supabase_client import get_supabase


def _last_non_null(series: list) -> float | None:
    return next((v for v in reversed(series) if v is not None), None)


def run(client: FortyGuardClient, facilities: list[dict]) -> None:
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    start_date = now.strftime("%Y-%m-%d")
    start_time = now.strftime("%H:00")

    for facility in facilities:
        aoi = point_to_aoi(facility["lat"], facility["lon"])

        tcm_result = client.heatmap(
            polygon_aoi=aoi, start_date=start_date, filter_type=1, start_time=start_time,
        )
        air_temp_c = tcm_result["stats_data"]["Temperature_stats"]["Mean"]

        env_result = client.env_params(
            latitude=facility["lat"], longitude=facility["lon"], temperature=air_temp_c,
            start_date=start_date, filter_type=1, start_time=start_time,
            analysis=["wet_bulb_temperature_celsius", "heat_index_celsius"],
        )
        location = env_result["locations"][0]
        wet_bulb_c = _last_non_null(location["parameters"].get("wet_bulb_temperature_celsius", []))
        heat_index_c = _last_non_null(location["parameters"].get("heat_index_celsius", []))

        supabase.table("facility_readings").upsert({
            "facility_id": facility["id"],
            "ts": now.isoformat(),
            "air_temp_c": air_temp_c,
            "wet_bulb_c": wet_bulb_c,
            "heat_index_c": heat_index_c,
        }, on_conflict="facility_id,ts").execute()
```

The `temperature` field `env_params` requires is deliberately the `tcm` heatmap's own `Mean` for the same tiny AOI/time, per the API doc's note that it "should match the heatmap you generated for this location/time" — not an independent guess.

- [ ] **Step 2: Verify against one real facility**

Run:
```bash
cd backend
python -c "
from fortyguard_client import FortyGuardClient
import readings_etl
client = FortyGuardClient()
readings_etl.run(client, [{'id': 'test-1', 'lat': 39.0438, 'lon': -77.4874}])
"
```
Expected: no exceptions; check the Supabase Table Editor for a new `facility_readings` row with non-null `air_temp_c` and a plausible August Virginia temperature. If `wet_bulb_c` comes back `null`, that's a legitimate missing-data case per the API — don't treat it as a bug, but do check `env_result` was requested with `analysis` matching the exact key names in the docs' parameter table.

- [ ] **Step 3: Commit**

```bash
git add backend/readings_etl.py
git commit -m "feat: add current-readings ETL chaining tcm heatmap into env_params"
```

---

### Task 7: Seasonal exceedance/persistence ETL

**Files:**
- Create: `backend/exceedance_etl.py`

**Interfaces:**
- Consumes: `FortyGuardClient.heatmap` (Task 4), `point_to_aoi`, `month_chunks` (Task 3), `get_supabase` (Task 2), `THRESHOLD_C`, `SEASON_START` (Task 2).
- Produces: `run(client: FortyGuardClient, facilities: list[dict]) -> None`, writing into `facility_exceedance`.

- [ ] **Step 1: Implement `exceedance_etl.py`**

```python
from datetime import date

from config import SEASON_START, THRESHOLD_C
from dates import month_chunks
from fortyguard_client import FortyGuardClient
from geo import point_to_aoi
from supabase_client import get_supabase


def run(client: FortyGuardClient, facilities: list[dict]) -> None:
    supabase = get_supabase()
    today = date.today()

    for facility in facilities:
        aoi = point_to_aoi(facility["lat"], facility["lon"])
        total_hours = 0.0
        max_run = 0.0

        for chunk_start, chunk_end in month_chunks(SEASON_START, today):
            exceedance = client.heatmap(
                polygon_aoi=aoi, start_date=chunk_start.isoformat(), filter_type=4,
                end_date=chunk_end.isoformat(), analytic_type="exceedance",
                threshold=THRESHOLD_C, direction="above",
            )
            persistence = client.heatmap(
                polygon_aoi=aoi, start_date=chunk_start.isoformat(), filter_type=4,
                end_date=chunk_end.isoformat(), analytic_type="persistence",
                threshold=THRESHOLD_C, direction="above",
            )
            total_hours += exceedance["stats_data"]["Temperature_stats"]["Mean"]
            max_run = max(max_run, persistence["stats_data"]["Temperature_stats"]["Maximum"])

        supabase.table("facility_exceedance").upsert({
            "facility_id": facility["id"],
            "threshold_c": THRESHOLD_C,
            "period_start": SEASON_START.isoformat(),
            "period_end": today.isoformat(),
            "hours_exceeded": round(total_hours, 1),
            "longest_run_hours": round(max_run, 1),
        }, on_conflict="facility_id,threshold_c,period_start,period_end").execute()
```

`longest_run_hours` takes the `Maximum` per month chunk (not `Mean`) — persistence is specifically about the worst continuous stretch, so averaging it away would understate exactly the number the product exists to surface. This does mean a run spanning a month boundary gets counted as two shorter runs rather than one long one; note that as a known simplification, not a hidden bug, if it comes up in judging.

- [ ] **Step 2: Verify against one real facility**

Run:
```bash
cd backend
python -c "
from fortyguard_client import FortyGuardClient
import exceedance_etl
client = FortyGuardClient()
exceedance_etl.run(client, [{'id': 'test-1', 'lat': 39.0438, 'lon': -77.4874}])
"
```
Expected: no exceptions; check `facility_exceedance` for a row with `hours_exceeded` and `longest_run_hours` both >= 0 and plausible for a Northern Virginia summer (dozens to low-hundreds of hours, single-digit-to-low-teens hour runs).

- [ ] **Step 3: Commit**

```bash
git add backend/exceedance_etl.py
git commit -m "feat: add seasonal exceedance/persistence ETL with monthly chunking"
```

---

### Task 8: 12-hour forecast ETL

**Files:**
- Create: `backend/forecast_etl.py`
- Test: `backend/tests/test_forecast_etl.py`

**Interfaces:**
- Consumes: `FortyGuardClient.env_params` (Task 4), `get_supabase` (Task 2), `THRESHOLD_C`, `MAX_DERATE_PCT`, `DERATE_RAMP_C`, `FORECAST_HOURS` (Task 2).
- Produces: `run(client: FortyGuardClient, facilities: list[dict]) -> None`, writing into `facility_forecast`; `derate_from_wet_bulb(wet_bulb_c) -> float | None` (also usable standalone, e.g. from the Edge Function's own derating display logic later if needed).

- [ ] **Step 1: Write the failing test for the midnight-boundary edge case**

`backend/tests/test_forecast_etl.py`:
```python
from datetime import datetime, timezone
from forecast_etl import _same_day_ranges, derate_from_wet_bulb


def test_same_day_ranges_splits_across_midnight():
    start = datetime(2026, 8, 22, 22, 0, tzinfo=timezone.utc)
    ranges = _same_day_ranges(start, hours=12)
    assert all(r[0].date() == r[1].date() for r in ranges)
    total_hours = sum(int((end - begin).total_seconds() // 3600) + 1 for begin, end in ranges)
    assert total_hours == 12


def test_same_day_ranges_stays_in_one_chunk_mid_morning():
    start = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)
    ranges = _same_day_ranges(start, hours=12)
    assert len(ranges) == 1


def test_derate_from_wet_bulb_is_zero_at_and_below_threshold():
    assert derate_from_wet_bulb(24.0, threshold_c=26.0) == 0.0
    assert derate_from_wet_bulb(26.0, threshold_c=26.0) == 0.0


def test_derate_from_wet_bulb_ramps_to_the_max():
    result = derate_from_wet_bulb(31.0, threshold_c=26.0, max_derate_pct=30.0, ramp_c=5.0)
    assert result == 30.0


def test_derate_from_wet_bulb_passes_through_null():
    assert derate_from_wet_bulb(None) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_forecast_etl.py -v`
Expected: FAIL — `forecast_etl.py` doesn't exist yet.

- [ ] **Step 3: Implement `forecast_etl.py`**

```python
from datetime import datetime, timedelta, timezone

from config import DERATE_RAMP_C, FORECAST_HOURS, MAX_DERATE_PCT, THRESHOLD_C
from fortyguard_client import FortyGuardClient
from supabase_client import get_supabase


def _same_day_ranges(start: datetime, hours: int) -> list[tuple[datetime, datetime]]:
    """FortyGuard's filter_type 2 caps a request at <=23h within one calendar
    day, so a forecast window that crosses midnight has to be split."""
    ranges = []
    cursor = start
    remaining = hours
    while remaining > 0:
        end_of_day = cursor.replace(hour=23, minute=0, second=0, microsecond=0)
        hours_left_today = int((end_of_day - cursor).total_seconds() // 3600) + 1
        span = min(remaining, hours_left_today, 23)
        span_end = cursor + timedelta(hours=span - 1)
        ranges.append((cursor, span_end))
        remaining -= span
        cursor = span_end + timedelta(hours=1)
    return ranges


def derate_from_wet_bulb(
    wet_bulb_c: float | None,
    threshold_c: float = THRESHOLD_C,
    max_derate_pct: float = MAX_DERATE_PCT,
    ramp_c: float = DERATE_RAMP_C,
) -> float | None:
    if wet_bulb_c is None:
        return None
    if wet_bulb_c <= threshold_c:
        return 0.0
    over = wet_bulb_c - threshold_c
    return round(min(max_derate_pct, (over / ramp_c) * max_derate_pct), 1)


def run(client: FortyGuardClient, facilities: list[dict]) -> None:
    supabase = get_supabase()
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

    for facility in facilities:
        hour_offset = 0
        for range_start, range_end in _same_day_ranges(now, FORECAST_HOURS):
            env_result = client.env_params(
                latitude=facility["lat"], longitude=facility["lon"],
                temperature=facility.get("current_air_temp_c") or 30.0,
                start_date=range_start.strftime("%Y-%m-%d"), filter_type=2,
                start_time=range_start.strftime("%H:00"), end_time=range_end.strftime("%H:00"),
                analysis=["wet_bulb_temperature_celsius"],
            )
            location = env_result["locations"][0]
            timestamps = env_result["metadata"]["timestamps"]
            wet_bulb_series = location["parameters"].get("wet_bulb_temperature_celsius", [])

            for ts, wet_bulb_c in zip(timestamps, wet_bulb_series):
                supabase.table("facility_forecast").upsert({
                    "facility_id": facility["id"],
                    "forecast_ts": ts,
                    "forecast_hour": hour_offset,
                    "predicted_wet_bulb_c": wet_bulb_c,
                    "predicted_derating_pct": derate_from_wet_bulb(wet_bulb_c),
                }, on_conflict="facility_id,forecast_hour").execute()
                hour_offset += 1
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_forecast_etl.py -v`
Expected: PASS, all five cases green.

- [ ] **Step 5: Commit**

```bash
git add backend/forecast_etl.py backend/tests/test_forecast_etl.py
git commit -m "feat: add 12-hour forecast ETL with midnight-safe chunking"
```

---

### Task 9: NWS comparison ETL

**Files:**
- Create: `backend/nws_etl.py`

**Interfaces:**
- Consumes: `get_supabase` (Task 2).
- Produces: `fetch_nws_temp_f(lat: float, lon: float) -> float | None`; `run(facilities: list[dict], fortyguard_temps_f: dict[str, float]) -> None`, writing into `nws_comparison`.

- [ ] **Step 1: Implement `nws_etl.py`**

```python
from datetime import datetime, timezone

import requests

from supabase_client import get_supabase

USER_AGENT = "FortyGuardHackathon26 (contact: osmaniskander863@gmail.com)"


def fetch_nws_temp_f(lat: float, lon: float) -> float | None:
    headers = {"User-Agent": USER_AGENT}

    points_resp = requests.get(f"https://api.weather.gov/points/{lat},{lon}", headers=headers, timeout=15)
    points_resp.raise_for_status()
    stations_url = points_resp.json()["properties"]["observationStations"]

    stations_resp = requests.get(stations_url, headers=headers, timeout=15)
    stations_resp.raise_for_status()
    features = stations_resp.json()["features"]
    if not features:
        return None
    station_id = features[0]["properties"]["stationIdentifier"]

    obs_resp = requests.get(
        f"https://api.weather.gov/stations/{station_id}/observations/latest", headers=headers, timeout=15,
    )
    obs_resp.raise_for_status()
    temp_c = obs_resp.json()["properties"]["temperature"]["value"]
    if temp_c is None:
        return None
    return round(temp_c * 9 / 5 + 32, 1)


def run(facilities: list[dict], fortyguard_temps_f: dict[str, float]) -> None:
    supabase = get_supabase()
    now = datetime.now(timezone.utc)

    for facility in facilities:
        nws_temp_f = fetch_nws_temp_f(facility["lat"], facility["lon"])
        fg_temp_f = fortyguard_temps_f.get(facility["id"])
        if nws_temp_f is None or fg_temp_f is None:
            continue

        supabase.table("nws_comparison").upsert({
            "facility_id": facility["id"],
            "ts": now.isoformat(),
            "nws_temp_f": nws_temp_f,
            "fortyguard_temp_f": fg_temp_f,
            "delta_f": round(fg_temp_f - nws_temp_f, 1),
        }, on_conflict="facility_id,ts").execute()
```

The `User-Agent` header is mandatory — NWS's API silently behaves differently or rejects requests without one.

- [ ] **Step 2: Verify against one real facility**

Run:
```bash
cd backend
python -c "
import nws_etl
temp = nws_etl.fetch_nws_temp_f(39.0438, -77.4874)
print('NWS temp F:', temp)
"
```
Expected: prints a plausible August Northern Virginia temperature in Fahrenheit, no exceptions.

- [ ] **Step 3: Commit**

```bash
git add backend/nws_etl.py
git commit -m "feat: add NWS comparison ETL"
```

---

### Task 10: Orchestration, live-refresh Edge Function, and scheduled re-runs

**Files:**
- Create: `backend/run_all.py`
- Create: `backend/supabase/functions/refresh-facility/index.ts`
- Create: `.github/workflows/refresh-data.yml`

**Interfaces:**
- Consumes: everything produced by Tasks 2–9.
- Produces: a runnable end-to-end pipeline; nothing downstream consumes this.

- [ ] **Step 1: Implement `run_all.py`**

```python
from dotenv import load_dotenv

load_dotenv()

import exceedance_etl
import forecast_etl
import nws_etl
import pnnl_ingest
import readings_etl
from fortyguard_client import FortyGuardClient
from supabase_client import get_supabase


def main() -> None:
    client = FortyGuardClient()

    print("Ingesting PNNL Data Center Atlas...")
    facilities = pnnl_ingest.run(state_filter="VA")
    print(f"  {len(facilities)} facilities loaded")

    print("Fetching current readings...")
    readings_etl.run(client, facilities)

    print("Computing seasonal exceedance/persistence...")
    exceedance_etl.run(client, facilities)

    print("Fetching 12-hour forecast...")
    forecast_etl.run(client, facilities)

    print("Comparing against NWS...")
    supabase = get_supabase()
    latest = supabase.table("facility_readings").select("facility_id,air_temp_c").execute().data
    fortyguard_temps_f = {
        row["facility_id"]: row["air_temp_c"] * 9 / 5 + 32
        for row in latest if row["air_temp_c"] is not None
    }
    nws_etl.run(facilities, fortyguard_temps_f)

    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it end-to-end and verify from the frontend's own query shape**

Run: `cd backend && python run_all.py`
Expected: all five stages print without exceptions. Then re-run Task 1 Step 3's `curl` against `facility_summary` — every Northern Virginia facility should now have non-null `current_air_temp_c`, `current_wet_bulb_c`, a real `risk_tier`, and a non-zero `peak_derating_next_12h_pct` for at least the facilities with the least headroom. This is the exact query the frontend's `useFacilities()` hook makes — if it looks right here, the frontend will render it correctly once its Supabase env vars are set.

- [ ] **Step 3: Implement the "run it fresh" Edge Function**

`backend/supabase/functions/refresh-facility/index.ts`:
```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FORTYGUARD_BASE_URL = "https://api.fortyguard.com";
const FORTYGUARD_API_KEY = Deno.env.get("FORTYGUARD_API_KEY")!;
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 60000;

async function pollActivity(activityId: string): Promise<unknown> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${FORTYGUARD_BASE_URL}/v1/status/${activityId}`, {
      headers: { "api-key": FORTYGUARD_API_KEY },
    });
    const body = await res.json();
    const status = body?.data?.status;
    if (status === "Completed") return body.data.result;
    if (status === "Failed") throw new Error(`activity ${activityId} failed`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`activity ${activityId} timed out`);
}

serve(async (req) => {
  const { lat, lon, air_temp_c } = await req.json();
  const now = new Date();

  const submitRes = await fetch(`${FORTYGUARD_BASE_URL}/v1/env_params`, {
    method: "POST",
    headers: { "api-key": FORTYGUARD_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: lat,
      longitude: lon,
      temperature: air_temp_c,
      date_time: {
        start_date: now.toISOString().slice(0, 10),
        filter_type: 1,
        start_time: now.toISOString().slice(11, 16),
      },
      analysis: ["wet_bulb_temperature_celsius", "heat_index_celsius"],
    }),
  });
  const submitBody = await submitRes.json();
  const activityId = submitBody?.data?.activity_id;
  if (!activityId) {
    return new Response(JSON.stringify({ error: "submission failed", body: submitBody }), { status: 502 });
  }

  const result = await pollActivity(activityId);
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
```

- [ ] **Step 4: Deploy the Edge Function and set its secret**

Run:
```bash
supabase functions deploy refresh-facility
supabase secrets set FORTYGUARD_API_KEY=<your-key>
```
Expected: deploy succeeds; test with `curl -X POST https://<project-ref>.supabase.co/functions/v1/refresh-facility -H "Authorization: Bearer <anon-key>" -d '{"lat":39.0438,"lon":-77.4874,"air_temp_c":32}'` and get back a `Completed` result body.

- [ ] **Step 5: Add a scheduled re-run so cached data doesn't go stale during judging**

`.github/workflows/refresh-data.yml`:
```yaml
name: Refresh cached thermal data
on:
  schedule:
    - cron: '0 12 * * *'
  workflow_dispatch: {}
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r backend/requirements.txt
      - run: python run_all.py
        working-directory: backend
        env:
          FORTYGUARD_API_KEY: ${{ secrets.FORTYGUARD_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

Add the three secrets under the repo's Settings → Secrets and variables → Actions before this can run — never as plaintext in the workflow file. Judging runs 1–15 September, so a daily refresh keeps the demo's cached numbers from visibly going stale over those three weeks without anyone needing to remember to re-run it manually.

- [ ] **Step 6: Commit**

```bash
git add backend/run_all.py backend/supabase/functions/refresh-facility/index.ts .github/workflows/refresh-data.yml
git commit -m "feat: add pipeline orchestration, live-refresh Edge Function, and scheduled re-runs"
```

---

## Self-review notes

- Spec coverage: every column in `CLAUDE.md`'s data contract is produced by exactly one task (facilities → Task 5, facility_readings → Task 6, facility_exceedance → Task 7, facility_forecast → Task 8, nws_comparison → Task 9); `facility_summary` (Task 1) is the exact shape `AGENTS.md` already committed to the frontend team.
- Global Constraints checked against tasks: month-chunking (Task 7) and same-day chunking (Task 8) both directly enforce the documented `filter_type` caps; null-handling (`_last_non_null`, `derate_from_wet_bulb`) never coerces to zero; secrets only ever appear in `.env` (gitignored, Task 2) and the Edge Function/Actions secrets (Task 10), never in a table or committed file.
- Type consistency checked: `facilities` list shape (`id`, `lat`, `lon`, plus optional `current_air_temp_c`) is produced by Task 5 and consumed identically by Tasks 6–9; `FortyGuardClient.heatmap`/`.env_params` signatures are identical between Task 4's implementation and every later task's call sites.
- Two explicit, labeled unknowns rather than fabricated placeholders: the heatmap tile-level GeoJSON schema (worked around by using the documented `stats_data` aggregate over a deliberately tiny AOI instead of guessing at tile property names) and the PNNL atlas's real field names (Task 5, Step 1 — a concrete download-and-inspect step, not a TODO).
