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
        temperature_stats = tcm_result["stats_data"].get("temperature_stats")
        if temperature_stats is None:
            # FortyGuard hasn't published TCM data for this time offset yet
            # (seen as {"n_cells": 0} with no temperature_stats key) -- this
            # is legitimately-missing data, not an error, so skip this
            # facility this cycle rather than crashing the whole run.
            print(f"  {facility['id']}: no TCM data yet for {start_date} {start_time}, skipping")
            continue
        air_temp_c = temperature_stats["mean"]

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
