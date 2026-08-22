import csv
from pathlib import Path

from supabase_client import get_supabase

# Curated fallback: the real PNNL/IM3 Data Center Atlas ships as GeoPackage/CSV
# (not GeoJSON), has no transmission/water/fibre fields, and the download is
# gated behind a pending MSD-LIVE account approval. Until that lands, this CSV
# of 10 named, publicly-documented Northern Virginia facilities stands in.
FALLBACK_CSV_PATH = Path(__file__).parent / "data" / "nova_facilities_fallback.csv"


def load_facilities(state_filter: str = "VA") -> list[dict]:
    """Load raw facility rows for `state_filter`. Swappable seam: once the real
    PNNL atlas is available, point this at that source instead — `run()` and
    its callers don't need to change."""
    with FALLBACK_CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [row for row in rows if row["state"].upper() == state_filter.upper()]


def run(state_filter: str = "VA") -> list[dict]:
    supabase = get_supabase()
    facilities = []

    for row in load_facilities(state_filter):
        facilities.append({
            "id": row["id"],
            "name": row["name"],
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "state": row["state"],
            "county": row["county"],
            # No infrastructure-layer join (FCC/USGS/HIFLD) yet — documented gap, not a bug.
            "has_transmission": False,
            "has_water": False,
            "has_fibre": False,
        })

    if facilities:
        supabase.table("facilities").upsert(facilities, on_conflict="id").execute()
    return facilities
