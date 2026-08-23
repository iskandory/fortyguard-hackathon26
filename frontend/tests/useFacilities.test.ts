import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFacilities } from '../src/hooks/useFacilities';
import { mockFacilities } from '../src/lib/mockData';

describe('useFacilities', () => {
  it('serves mock fixtures when no Supabase env vars are set', async () => {
    const { result } = renderHook(() => useFacilities());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.facilities).toEqual(mockFacilities);
    expect(result.current.error).toBeNull();
    expect(result.current.source).toBe('mock');
  });
});
