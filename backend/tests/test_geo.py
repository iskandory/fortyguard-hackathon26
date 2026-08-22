from geo import point_to_aoi


def test_point_to_aoi_produces_closed_polygon():
    aoi = point_to_aoi(39.0438, -77.4874)
    ring = aoi["features"][0]["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1]
    assert len(ring) == 5


def test_point_to_aoi_centers_on_the_point():
    lat, lon = 39.0438, -77.4874
    aoi = point_to_aoi(lat, lon, half_width_deg=0.001)
    ring = aoi["features"][0]["geometry"]["coordinates"][0]
    lons = [c[0] for c in ring]
    lats = [c[1] for c in ring]
    assert min(lons) < lon < max(lons)
    assert min(lats) < lat < max(lats)
