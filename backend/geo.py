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
