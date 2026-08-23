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
        try:
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
                exceedance_mean = exceedance["stats_data"].get("mean")
                persistence_max = persistence["stats_data"].get("max")
                if exceedance_mean is None or persistence_max is None:
                    # Partial/empty chunk (e.g. the trailing chunk ending on
                    # `today`) can come back as {"n_cells": 0} with no
                    # mean/max key -- treat that chunk as no additional
                    # exceedance rather than crashing the facility.
                    continue
                total_hours += exceedance_mean
                max_run = max(max_run, persistence_max)

            supabase.table("facility_exceedance").upsert({
                "facility_id": facility["id"],
                "threshold_c": THRESHOLD_C,
                "period_start": SEASON_START.isoformat(),
                "period_end": today.isoformat(),
                "hours_exceeded": round(total_hours, 1),
                "longest_run_hours": round(max_run, 1),
            }, on_conflict="facility_id,threshold_c,period_start,period_end").execute()
        except Exception as exc:
            print(f"  {facility['id']}: exceedance/persistence fetch failed ({exc}), skipping")
            continue
