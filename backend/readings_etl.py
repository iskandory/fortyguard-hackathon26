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
        air_temp_c = tcm_result["stats_data"]["temperature_stats"]["mean"]

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
