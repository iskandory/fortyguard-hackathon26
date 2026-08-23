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
        try:
            hour_offset = 0
            for range_start, range_end in _same_day_ranges(now, FORECAST_HOURS):
                env_result = client.env_params(
                    latitude=facility["lat"], longitude=facility["lon"],
                    temperature=facility.get("current_air_temp_c") or 30.0,
                    start_date=range_start.strftime("%Y-%m-%d"), filter_type=2,
                    start_time=range_start.strftime("%H:00"), end_time=range_end.strftime("%H:00"),
                    analysis=["wet_bulb_temperature_celsius"],
                )
                locations = env_result.get("locations") or []
                if not locations:
                    print(f"  {facility['id']}: no locations in env_params response, skipping")
                    continue
                location = locations[0]
                timestamps = env_result.get("metadata", {}).get("timestamps")
                if not timestamps:
                    print(f"  {facility['id']}: no timestamps in env_params response, skipping")
                    continue
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
        except Exception as exc:
            print(f"  {facility['id']}: forecast fetch failed ({exc}), skipping")
            continue
