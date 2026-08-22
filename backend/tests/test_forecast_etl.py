from datetime import datetime, timezone
from forecast_etl import _same_day_ranges, derate_from_wet_bulb


def test_same_day_ranges_splits_across_midnight():
    start = datetime(2026, 8, 22, 22, 0, tzinfo=timezone.utc)
    ranges = _same_day_ranges(start, hours=12)
    assert all(r[0].date() == r[1].date() for r in ranges)
    total_hours = sum(int((end - begin).total_seconds() // 3600) + 1 for begin, end in ranges)
    assert total_hours == 12


def test_same_day_ranges_stays_in_one_chunk_mid_morning():
    start = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)
    ranges = _same_day_ranges(start, hours=12)
    assert len(ranges) == 1


def test_derate_from_wet_bulb_is_zero_at_and_below_threshold():
    assert derate_from_wet_bulb(24.0, threshold_c=26.0) == 0.0
    assert derate_from_wet_bulb(26.0, threshold_c=26.0) == 0.0


def test_derate_from_wet_bulb_ramps_to_the_max():
    result = derate_from_wet_bulb(31.0, threshold_c=26.0, max_derate_pct=30.0, ramp_c=5.0)
    assert result == 30.0


def test_derate_from_wet_bulb_passes_through_null():
    assert derate_from_wet_bulb(None) is None
