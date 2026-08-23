from datetime import datetime

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

    print("Loading Northern Virginia facilities...")
    facilities = pnnl_ingest.run(state_filter="VA")
    print(f"  {len(facilities)} facilities loaded")

    print("Fetching current readings...")
    readings_etl.run(client, facilities)

    print("Computing seasonal exceedance/persistence...")
    exceedance_etl.run(client, facilities)

    # readings_etl just wrote each facility's current air_temp_c to
    # facility_readings. Pull it back so forecast_etl seeds its env_params
    # calls with the real current temperature instead of falling back to its
    # hardcoded 30.0 default. The same select also builds the Fahrenheit
    # lookup and the observation timestamp nws_etl needs below, so
    # facility_readings is only queried once.
    # facility_readings is unique on (facility_id, ts), not one row per
    # facility -- it's an accumulating time series -- so order newest-first
    # and keep only the first (most recent) row seen per facility_id.
    supabase = get_supabase()
    latest = (
        supabase.table("facility_readings")
        .select("facility_id,air_temp_c,ts")
        .order("ts", desc=True)
        .execute()
        .data
    )
    current_air_temp_c: dict[str, float] = {}
    reading_ts: dict[str, str] = {}
    for row in latest:
        if row["air_temp_c"] is not None and row["facility_id"] not in current_air_temp_c:
            current_air_temp_c[row["facility_id"]] = row["air_temp_c"]
            reading_ts[row["facility_id"]] = row["ts"]
    for facility in facilities:
        if facility["id"] in current_air_temp_c:
            facility["current_air_temp_c"] = current_air_temp_c[facility["id"]]

    print("Fetching 12-hour forecast...")
    forecast_etl.run(client, facilities)

    print("Comparing against NWS...")
    fortyguard_temps_f = {
        facility_id: air_temp_c * 9 / 5 + 32 for facility_id, air_temp_c in current_air_temp_c.items()
    }
    # All facilities are fetched within a single readings_etl.run() call using
    # one shared `observed_at` anchor, so every reading this run carries (near
    # enough) the same ts -- take the newest one as the representative
    # observation time for the NWS comparison window.
    observed_at = max((datetime.fromisoformat(ts) for ts in reading_ts.values()), default=None)
    nws_etl.run(facilities, fortyguard_temps_f, observed_at)

    print("Done.")


if __name__ == "__main__":
    main()
