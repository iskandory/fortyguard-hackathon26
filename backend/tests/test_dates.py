from datetime import date
from dates import month_chunks


def test_month_chunks_splits_on_month_boundaries():
    chunks = list(month_chunks(date(2026, 6, 15), date(2026, 8, 5)))
    assert chunks == [
        (date(2026, 6, 15), date(2026, 6, 30)),
        (date(2026, 7, 1), date(2026, 7, 31)),
        (date(2026, 8, 1), date(2026, 8, 5)),
    ]


def test_month_chunks_handles_a_single_partial_month():
    chunks = list(month_chunks(date(2026, 8, 1), date(2026, 8, 5)))
    assert chunks == [(date(2026, 8, 1), date(2026, 8, 5))]
