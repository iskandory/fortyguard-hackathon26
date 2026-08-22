from datetime import date

THRESHOLD_C = 26.0        # cooling design wet-bulb threshold; tune per facility class
SEASON_START = date(2026, 6, 1)
FORECAST_HOURS = 12
MAX_DERATE_PCT = 30.0
DERATE_RAMP_C = 5.0        # degrees above threshold at which derating hits MAX_DERATE_PCT
GRANULARITY_M = 100
