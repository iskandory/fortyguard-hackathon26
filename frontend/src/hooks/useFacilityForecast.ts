import { useEffect, useState } from 'react';
import { supabase, isLiveDataAvailable } from '../lib/supabase';
import { mockForecast } from '../lib/mockData';
import type { ForecastPoint } from '../types/facility';

export interface FacilityForecastResult {
  forecast: ForecastPoint[];
  loading: boolean;
}

/** Per-hour forecast for the selected facility only — the map never needs it. */
export function useFacilityForecast(
  facilityId: string | null,
): FacilityForecastResult {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!facilityId) {
      setForecast([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      if (!isLiveDataAvailable()) {
        if (!cancelled) {
          setForecast(mockForecast.filter((f) => f.facility_id === facilityId));
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase!
        .from('facility_forecast')
        .select('*')
        .eq('facility_id', facilityId)
        .order('forecast_hour', { ascending: true });
      if (!cancelled) {
        setForecast((data ?? []) as ForecastPoint[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  return { forecast, loading };
}
