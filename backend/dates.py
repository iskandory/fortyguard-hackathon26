import calendar
from datetime import date, timedelta
from typing import Iterator


def month_chunks(start: date, end: date) -> Iterator[tuple[date, date]]:
    """Splits [start, end] into <=1-month pieces, required because FortyGuard's
    heatmap filter_type 4 caps a single request at one month."""
    current = start
    while current <= end:
        last_day = calendar.monthrange(current.year, current.month)[1]
        chunk_end = min(date(current.year, current.month, last_day), end)
        yield (current, chunk_end)
        current = chunk_end + timedelta(days=1)
