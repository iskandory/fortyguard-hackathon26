# FortyGuard Temperature API — Reference

Source: <https://docs-api.fortyguard.com/docs/introduction> (API version 1.0.0, released 2026-04-22).
Extracted 2026-08-18. The docs site is a client-rendered SPA, so this file is the offline copy.

---

## 1. Basics

| | |
|---|---|
| Base URL | `https://api.fortyguard.com` |
| Auth | API key in a request header. No OAuth, no token exchange. |
| Content type | `application/json` |

```
api-key: YOUR_API_KEY
Content-Type: application/json
```

FortyGuard calls the platform the **Temperature Operating System (tOS)**, built on their
proprietary **Large Temperature Models (LTMs)**.

### The submit-then-poll pattern

Every analysis endpoint is asynchronous:

1. `POST` the job → response contains `data.activity_id`.
2. `GET /v1/status/{activity_id}` on an interval until `data.status` is `Completed` or `Failed`.
3. On `Completed`, the same status response carries `data.result`.

**Credits are deducted only on `Completed`.** Failed tasks cost nothing.

---

## 2. Endpoint index

| Endpoint | Method | Plans | Purpose |
|---|---|---|---|
| `/v1/heatmap` | POST | Basic + Premium | GeoJSON thermal map over a polygon AOI |
| `/v1/satellite` | POST | Premium | Tile-based satellite imagery segmentation |
| `/v1/streetview` | POST | Premium | Ground-level street view segmentation |
| `/v1/heat_intelligence` | POST | Premium | Multi-category PDF intelligence report |
| `/v1/env_params` | POST | Basic (3 params) / Premium (all) | Heat index, AQI, solar irradiance, etc. |
| `/v1/status/{activity_id}` | GET | both | Status + result for any submission |
| `/v1/system/fetch-api-key-usage` | POST | both | Credit usage for the current billing cycle |
| `/v1/system/fetch-api-key-custom-usage` | POST | both | Credit usage for a custom date range |

---

## 3. `POST /v1/heatmap` — Create Heatmap

High-resolution thermal maps derived from spatial and temporal inputs. Output is a GeoJSON
polygon layer whose tiles carry predicted or observed temperature data.

### Required

| Field | Type | Notes |
|---|---|---|
| `polygon_aoi` | object | GeoJSON `FeatureCollection`; geometry must be a **closed** `Polygon` (first coord == last) |
| `date_time` | object | see below |
| `date_time.start_date` | string | `YYYY-MM-DD`. Range `2019-01-01` → **now + 12 hours** |
| `date_time.filter_type` | number | `1`–`4`, see below |
| `granularity` | number | `60`, `80`, or `100` (meters) |

`filter_type`:

| Value | Meaning | Requires |
|---|---|---|
| `1` | Single Hour | `start_date`, `start_time` (`end_time` auto = start + 1h) |
| `2` | Range of Hours (same day, ≤ 23h) | `start_date`, `start_time`, `end_time` |
| `3` | Single Day (00:00–23:59) | `start_date` |
| `4` | Range of Days (≤ 1 month) | `start_date`, `end_date` — **heatmap only** |

### Optional

| Field | Type | Notes |
|---|---|---|
| `date_time.end_date` | string | `YYYY-MM-DD`. Required for `filter_type 4`; auto-populated for 1–3 |
| `date_time.start_time` | string | `HH:MM` 24h. Required for `filter_type` 1 and 2 |
| `date_time.end_time` | string | `HH:MM` 24h. Required for `filter_type 2` |
| `analytic_type` | string | default `tcm` — see below |
| `threshold` | number | °C for exceedance / persistence. Default `30`. Ignored by `tcm` / `time_of_measure` |
| `direction` | string | `above` (default) or `below`, for exceedance / persistence |

`analytic_type`:

| Value | Per-tile value | Unit (`stats_data.units`) |
|---|---|---|
| `tcm` | temperature snapshot | °C |
| `time_of_measure` | hour of day (0–23 UTC) the peak temperature occurs | hour |
| `exceedance` | number of hours past `threshold` | hour |
| `persistence` | longest continuous run of hours past `threshold` | hour |

### Request

```python
import requests

response = requests.post(
    'https://api.fortyguard.com/v1/heatmap',
    headers={'api-key': 'your_api_key'},
    json={
        'polygon_aoi': {
            'type': 'FeatureCollection',
            'features': [
                {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [[
                            [-74.0170, 40.7050],
                            [-74.0030, 40.7050],
                            [-74.0030, 40.7180],
                            [-74.0170, 40.7180],
                            [-74.0170, 40.7050]
                        ]]
                    }
                }
            ]
        },
        'date_time': {
            'start_date': '2024-07-15',
            'start_time': '14:00',
            'filter_type': 1
        },
        'granularity': 100
    }
)
```

Analytic variant (exceedance / persistence):

```python
        'granularity': 100,
        'analytic_type': 'exceedance',
        'threshold': 30,
        'direction': 'above'
```

### Submission response

```json
{
  "error": false,
  "status_code": 200,
  "message": "Heatmap Submitted Successfully",
  "data": { "activity_id": "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df" }
}
```

### Completed result

```json
{
  "error": false,
  "status_code": 200,
  "message": "Completed",
  "data": {
    "activity_id": "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df",
    "status": "Completed",
    "result": { "map_data": {}, "stats_data": {} }
  }
}
```

- `result.map_data` — GeoJSON `FeatureCollection` of heatmap tiles.
- `result.stats_data` — aggregate statistics:
  - `Temperature_stats` — `Minimum`, `Maximum`, `Mean`, `Standard_deviation`
  - `Overall_temperature_distribution` — sorted array of temperature values
  - `Normal_temperature_distribution` — `x_axis` (temperature range), `y_axis` (probability density)
  - `Temperature_frequency` — histogram counts per temperature bin

---

## 4. `POST /v1/satellite` — Satellite View Segmentation

**Premium only.** Classifies land cover, building structures, vegetation, and thermal
characteristics from satellite imagery, tile-based (single point).

### Required

| Field | Type | Notes |
|---|---|---|
| `sat.latitude` | number | |
| `sat.longitude` | number | |
| `date_time.start_date` | string | `YYYY-MM-DD`, `2019-01-01` → now + 12h. **Should match the heatmap** you generated for this location/time |
| `date_time.filter_type` | number | `1` (Single Hour), `2` (Range of Hours), `3` (Single Day) — no `4` |
| `granularity` | number | `60`, `80`, or `100` |

Optional: `date_time.end_date`, `date_time.start_time`, `date_time.end_time` (same rules as heatmap).

```python
response = requests.post(
    'https://api.fortyguard.com/v1/satellite',
    headers={'api-key': 'your_api_key'},
    json={
        'sat': {'latitude': 41.84632807720175, 'longitude': -87.74329628220852},
        'date_time': {'start_date': '2024-07-15', 'start_time': '14:00', 'filter_type': 1},
        'granularity': 80
    }
)
```

### Completed result

```json
{
  "data": {
    "status": "Completed",
    "result": {
      "coordinates": { "latitude": "41.846...", "longitude": "-87.743..." },
      "orignal_image": [""],
      "image_year": 2026,
      "segmentation": {
        "image_dimensions": { "height": 350, "width": 350 },
        "mode": "sat",
        "processing_time_seconds": 0.273295,
        "request_id": "632fcd03",
        "segments": {},
        "image_legend": {},
        "image_content": ""
      }
    }
  }
}
```

- `orignal_image` (sic — misspelled in the API) — array of Base64 source images.
- `segmentation.segments` — per-class coverage values (typically percentages).
- `segmentation.image_legend` — RGB legend for rendering the mask.
- `segmentation.image_content` — Base64 segmentation mask.

Base64 comes back raw; prepend `data:image/png;base64,` to render in a browser.

---

## 5. `POST /v1/streetview` — Street View Segmentation

**Premium only.** Classifies urban features, building facades, vegetation, and road surfaces
from ground level.

### Required

| Field | Type | Notes |
|---|---|---|
| `latitude` | number | |
| `longitude` | number | |
| `vertical_angle` | number | degrees, tilt up/down |
| `horizontal_angle` | number | degrees, pan left/right, 0–360 |
| `back_view` | boolean | also capture the opposite direction |

```python
response = requests.post(
    'https://api.fortyguard.com/v1/streetview',
    headers={'api-key': 'your_api_key'},
    json={
        'latitude': 40.7128,
        'longitude': -74.0060,
        'vertical_angle': 10.0,
        'horizontal_angle': 90.0,
        'back_view': False
    }
)
```

### Completed result

```json
{
  "data": {
    "status": "Completed",
    "result": {
      "coordinates": { "latitude": "40.7128", "longitude": "-74.006" },
      "front": {
        "original_image": "",
        "segments": {},
        "image_legend": {},
        "segmented_image": "",
        "image_date": "YYYY-MM-DD"
      }
    }
  }
}
```

`image_date` is when the Street View image was captured. Note `original_image` is spelled
correctly here, unlike the satellite endpoint.

---

## 6. `POST /v1/heat_intelligence` — Heat Intelligence

**Premium only.** Turns raw temperature data into a multi-dimensional intelligence report
(PDF) for an urban location.

### Required

| Field | Type | Notes |
|---|---|---|
| `latitude` | number | |
| `longitude` | number | |
| `temperature` | number | °C for the location |
| `date` | string | `YYYY-MM-DD`, `2019-01-01` → now + 12h. Should match the heatmap that produced this temperature |
| `analysis` | array[string] | any of `geographic`, `environmental`, `urban`, `events`, `anthropogenic` |

```python
response = requests.post(
    'https://api.fortyguard.com/v1/heat_intelligence',
    headers={'api-key': 'your_api_key'},
    json={
        'latitude': 40.7128,
        'longitude': -74.0060,
        'temperature': 32.5,
        'date': '2024-07-15',
        'analysis': ['environmental']
    }
)
```

### Result flow — different from the others

The status endpoint returns **JSON containing `data.result.download_link`**; it does *not*
stream the PDF. Report generation may take several minutes. The link is a temporary signed
URL — download immediately, never log or share it.

```python
import time
from pathlib import Path
import requests

activity_id = "f3e1c68b-1cc3-46bc-8589-1faaf30ef30a"
headers = {"api-key": "your_api_key"}
status_url = f"https://api.fortyguard.com/v1/status/{activity_id}"

for _ in range(120):
    status_resp = requests.get(status_url, headers=headers, timeout=30)
    status_resp.raise_for_status()
    data = status_resp.json()["data"]
    status = data.get("status")

    if status == "Completed":
        download_link = (data.get("result") or {}).get("download_link")
        if not download_link:
            raise RuntimeError(f"Activity {activity_id} completed without a download_link")

        report_resp = requests.get(download_link, timeout=60)
        report_resp.raise_for_status()
        Path("report.pdf").write_bytes(report_resp.content)
        print("Saved to report.pdf")
        break

    if status == "Failed":
        raise RuntimeError(f"Activity {activity_id} failed")

    time.sleep(5)
else:
    raise TimeoutError(f"Activity {activity_id} did not complete in time")
```

---

## 7. `POST /v1/env_params` — Environmental Parameters

Thermal stress metrics (heat index, apparent temperature, wet bulb), atmospheric and
hydrological variables (precipitation, AQI, ozone), and solar irradiance profiles.

### Required

| Field | Type | Notes |
|---|---|---|
| `latitude` | number | |
| `longitude` | number | |
| `temperature` | number | °C |
| `date_time.start_date` | string | `YYYY-MM-DD`, should match the heatmap for this location/time |
| `date_time.filter_type` | number | `1`, `2`, or `3` |

Optional: `date_time.end_date`, `date_time.start_time`, `date_time.end_time`, and `analysis`.

### `analysis` — omit to get everything

Basic and Startup plans are capped at **3 parameters per request**; Premium has full access.

**Thermal & atmospheric**

| Key | Unit |
|---|---|
| `heat_index_celsius` | °C ("feels like") |
| `apparent_temperature_celsius` | °C |
| `wet_bulb_temperature_celsius` | °C |
| `relative_humidity_percent` | % |
| `precipitation_mm` | mm |
| `cloud_cover_octas` | octas |
| `elevation` | m |

**Air quality (US AQI) & gases**

| Key | Meaning |
|---|---|
| `air_quality:idx` | overall US AQI |
| `air_quality_pm2p5:idx` | AQI, PM2.5 |
| `air_quality_pm10:idx` | AQI, PM10 |
| `air_quality_no2:idx` | AQI, nitrogen dioxide |
| `aqi_us_co` | AQI, carbon monoxide |
| `air_quality_o3:idx` | AQI, ozone |
| `air_quality_so2:idx` | AQI, sulphur dioxide |
| `methane_ppb` | ppb |
| `co2_ppm` | ppm |

**Solar**

| Key | Meaning |
|---|---|
| `solar_irradiance` | clear-sky GHI / DNI / DHI |

```python
response = requests.post(
    'https://api.fortyguard.com/v1/env_params',
    headers={'api-key': 'your_api_key'},
    json={
        'latitude': 40.7128,
        'longitude': -74.0060,
        'temperature': 32.5,
        'date_time': {'start_date': '2024-07-15', 'start_time': '14:00', 'filter_type': 1}
    }
)
```

### Completed result shape

```json
{
  "data": {
    "status": "Completed",
    "result": {
      "metadata": {
        "timezone": "TIMEZONE_STRING",
        "timezone_offset_hours": "NUMBER",
        "time_range": { "start": "...", "end": "...", "interval": "...", "count": "INTEGER" },
        "timestamps": ["YYYY-MM-DDTHH:MM:SS±HH:MM"]
      },
      "locations": [
        {
          "lat": "NUMBER", "lon": "NUMBER",
          "elevation": "NUMBER", "temperature": "NUMBER",
          "parameters": { "heat_index_celsius": ["NUMBER_OR_NULL"], "...": [] },
          "solar_irradiance": {
            "clear_sky": { "ghi": "NUMBER", "dni": "NUMBER", "dhi": "NUMBER" },
            "description": "STRING"
          }
        }
      ]
    }
  }
}
```

Parameter values are **arrays aligned to `metadata.timestamps`**.

> **Missing values:** new responses return JSON `null`; older stored responses may still
> contain the legacy sentinel `-999`. `null` means the upstream provider had no data —
> it must **not** be interpreted as zero.

---

## 8. `GET /v1/status/{activity_id}` — Check Status

Works for every submission endpoint. `activity_id` comes from the submission response.

```python
response = requests.get(
    f'https://api.fortyguard.com/v1/status/{activity_id}',
    headers={'api-key': 'your_api_key'}
)
```

```json
{
  "error": false,
  "status_code": 200,
  "message": "Processing",
  "data": {
    "activity_id": "f3e1c68b-1cc3-46bc-8589-1faaf30ef30a",
    "status": "Processing"
  }
}
```

---

## 9. Credit usage endpoints

Both are POST and take the key in the **body**, not the header.

```
POST /v1/system/fetch-api-key-usage
{ "api_key": "..." }

POST /v1/system/fetch-api-key-custom-usage
{ "api_key": "...", "start_date": "2026-08-01T00:00:00Z", "end_date": "2026-08-18T23:59:59Z" }
```

Response carries `plan_details` (`plan_type`, `cycle_type`, `active`, `billing_period`,
`subscription_start_date`, `credits_reset_date`), `api_key_details` (`status` `active`/`expired`,
`valid`, `api_access_available`, `expiry_date`), `credit_summary` (`cycle_remaining_credits`,
`total_available_credits`), `total_credits_used`, and `activity_breakdown[]` of
`{ name, credits, percentage }`.

Activity names seen in the breakdown: `Heatmap Generation`, `Tile Satellite Segmentation`,
`Streetview Segmentation`, `Environment Parameter Analysis`, `Heat Intelligence Report`,
`Unused Credits`.

A subscription can be active while the individual API key has expired — requests with an
expired key are rejected regardless.

---

## 10. Status and error codes

| Response | Meaning |
|---|---|
| `400` / `422` | Invalid request or validation error |
| `401` | Missing or invalid API key |
| `403` | Insufficient plan access or authorization |
| `404` | Activity not found, or temporarily unavailable immediately after submission |
| `429` | Rate limit exceeded |
| `500` | Server-side processing error |
| `Processing` | Continue bounded polling |
| `Completed` | Retrieve the endpoint-specific result |
| `Failed` | Terminal — stop polling and record the activity ID |

A `404` right after submitting is expected sometimes; treat it as retryable for the first
few polls rather than as a hard failure.

---

## 11. Known limitations

### Plans

| Capability | API Basic | API Premium | API Startup |
|---|---|---|---|
| Monthly credits | 1,000,000 | 5,000,000 | 1,000,000 |
| Commercial license | Included | Included | Included |
| Heatmap max area | ≤ 10 mi² | ≤ 50 mi² | ≤ 10 mi² |
| Map Statistics | Full | Full | Full |
| Environmental Parameters | 3 per request | All | 3 per request |
| Satellite Segmentation | ✗ | ✓ | ✗ |
| Street View Segmentation | ✗ | ✓ | ✗ |
| Heat Intelligence Reports | ✗ | ✓ | ✗ |
| Access window | Monthly, renews | Monthly, renews | 6 months, one-time |
| Regional coverage | US only | US only | US only |

### Input constraints

Violations return `400 Bad Request` and are **not** charged against credits.

- **Coordinates** — `latitude` in `[-90, 90]`, `longitude` in `[-180, 180]`. This release
  requires coordinates inside the **United States**.
- **Polygon AOI** — valid GeoJSON `FeatureCollection` whose geometry is a closed `Polygon`.
- **Date format** — `start_date` / `end_date` as `YYYY-MM-DD`; `start_time` / `end_time` as
  `HH:MM` 24-hour.
- **Date range** — between `2019-01-01` and the present day. `/v1/heatmap` additionally
  forecasts up to **12 hours** ahead, so its ceiling is `now + 12 hours`. Anything earlier
  than 2019-01-01 or more than 12h in the future is rejected.
- **Filter types** — `1`, `2`, or `3` generally; `filter_type 2` supports a max range of
  **23 hours**. `filter_type 4` exists only on `/v1/heatmap` (≤ 1 month).
- **Granularity** — `60m`, `80m`, or `100m`.

### Processing and billing

- Submission endpoints return an `activity_id`; results come from `GET /v1/status/{activity_id}`.
- `Failed` tasks do **not** consume credits.
- Credits deduct only on `Completed`.
- Unused credits do **not** roll over — they reset on `credits_reset_date`.
- API Startup is a one-time 1,000,000-credit allocation over a 6-month window, not a
  recurring monthly cycle.
- Segmentation images are Base64; prepend `data:image/png;base64,` if the MIME prefix is absent.
- Heat Intelligence `download_link` is temporary — use immediately, don't log or share.

Undocumented or incorrect limits: <support@fortyguard.com>

---

## 12. Version history

**1.0.0 — 2026-04-22 — Initial Public Release**

First GA release: core Temperature API surface, two subscription plans, credit tracking,
and full documentation.

Added: `/v1/heatmap`, `/v1/satellite`, `/v1/streetview`, `/v1/heat_intelligence`,
`/v1/env_params`, `/v1/status/{activity_id}`, `api-key` header auth, and the two
`/v1/system/fetch-api-key-*-usage` reporting endpoints.

---

## 13. Doc page URLs

| Page | URL |
|---|---|
| Introduction | <https://docs-api.fortyguard.com/docs/introduction> |
| Quickstart | <https://docs-api.fortyguard.com/docs/quickstart> |
| Authentication | <https://docs-api.fortyguard.com/docs/authentication> |
| Create Heatmap | <https://docs-api.fortyguard.com/docs/create-heatmap> |
| Satellite View Segmentation | <https://docs-api.fortyguard.com/docs/satellite-view-segmentation> |
| Street View Segmentation | <https://docs-api.fortyguard.com/docs/street-view-segmentation> |
| Heat Intelligence | <https://docs-api.fortyguard.com/docs/heat-intelligence> |
| Environmental Parameters | <https://docs-api.fortyguard.com/docs/environmental-parameters> |
| Check Status | <https://docs-api.fortyguard.com/docs/check-status> |
| Check API Credits Usage | <https://docs-api.fortyguard.com/docs/credits-usage> |
| Known Limitations | <https://docs-api.fortyguard.com/docs/limitations> |
| Release Notes | <https://docs-api.fortyguard.com/docs/release-notes> |
| Pricing | <https://fortyguard.com/api-pricing> |
