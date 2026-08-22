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
