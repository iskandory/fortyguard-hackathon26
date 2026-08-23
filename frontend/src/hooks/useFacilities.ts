import { useEffect, useState } from 'react';
import { supabase, isLiveDataAvailable } from '../lib/supabase';
import { mockFacilities } from '../lib/mockData';
import type { FacilitySummary } from '../types/facility';

export type DataSource = 'mock' | 'live';

export interface UseFacilitiesResult {
  facilities: FacilitySummary[];
  loading: boolean;
  error: string | null;
  source: DataSource;
}

/**
 * Mock-first: with no Supabase env vars this serves the bundled cached
 * dataset instantly — a judge opening the demo URL in an incognito window
 * sees content within ~1s, no network, no login. Live data is opt-in.
 */
export function useFacilities(): UseFacilitiesResult {
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource>(
    isLiveDataAvailable() ? 'live' : 'mock',
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isLiveDataAvailable()) {
        if (!cancelled) {
          setFacilities(mockFacilities);
          setLoading(false);
        }
        return;
      }
      const { data, error: queryError } = await supabase!
        .from('facility_summary')
        .select('*');
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setFacilities(mockFacilities);
        setSource('mock');
      } else if (data && data.length > 0) {
        setFacilities(data as FacilitySummary[]);
      } else {
        setFacilities(mockFacilities);
        setSource('mock');
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { facilities, loading, error, source };
}
