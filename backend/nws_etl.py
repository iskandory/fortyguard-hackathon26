from datetime import datetime, timedelta, timezone

import requests

from supabase_client import get_supabase

USER_AGENT = "FortyGuardHackathon26 (contact: osmaniskander863@gmail.com)"


def fetch_nws_temp_f(lat: float, lon: float, observed_at: datetime | None = None) -> float | None:
    """Fetch an NWS temperature near `observed_at` so the comparison isn't a
    live reading diffed against a ~36h-old FortyGuard one. Falls back to the
    live `/observations/latest` endpoint when `observed_at` isn't given, or
    when the windowed query around it comes back empty (station gaps happen)."""
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

    temp_c = None
    if observed_at is not None:
        window_start = observed_at.isoformat()
        window_end = (observed_at + timedelta(hours=1)).isoformat()
        windowed_resp = requests.get(
            f"https://api.weather.gov/stations/{station_id}/observations",
            headers=headers, timeout=15,
            params={"start": window_start, "end": window_end, "limit": 1},
        )
        windowed_resp.raise_for_status()
        windowed_features = windowed_resp.json().get("features") or []
        if windowed_features:
            temp_c = windowed_features[0]["properties"]["temperature"]["value"]

    if temp_c is None:
        obs_resp = requests.get(
            f"https://api.weather.gov/stations/{station_id}/observations/latest", headers=headers, timeout=15,
        )
        obs_resp.raise_for_status()
        temp_c = obs_resp.json()["properties"]["temperature"]["value"]

    if temp_c is None:
        return None
    return round(temp_c * 9 / 5 + 32, 1)


def run(facilities: list[dict], fortyguard_temps_f: dict[str, float], observed_at: datetime | None = None) -> None:
    supabase = get_supabase()
    # The FortyGuard reading's own observation time -- not datetime.now() --
    # so nws_comparison.ts describes roughly the same hour on both sides of
    # the diff. Falls back to "now" only if the caller has no reading yet.
    ts = observed_at or datetime.now(timezone.utc)

    for facility in facilities:
        try:
            nws_temp_f = fetch_nws_temp_f(facility["lat"], facility["lon"], observed_at)
            fg_temp_f = fortyguard_temps_f.get(facility["id"])
            if nws_temp_f is None or fg_temp_f is None:
                continue

            supabase.table("nws_comparison").upsert({
                "facility_id": facility["id"],
                "ts": ts.isoformat(),
                "nws_temp_f": nws_temp_f,
                "fortyguard_temp_f": fg_temp_f,
                "delta_f": round(fg_temp_f - nws_temp_f, 1),
            }, on_conflict="facility_id,ts").execute()
        except Exception as exc:
            print(f"  {facility['id']}: NWS comparison failed ({exc}), skipping")
            continue
