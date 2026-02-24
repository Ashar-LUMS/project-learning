import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import type { NetworkData } from '@/types/network';

export interface CaseStudy {
  id: number;
  created_at: string;
  name: string | null;
  network: NetworkData | null;
}

interface UseCaseStudiesReturn {
  caseStudies: CaseStudy[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch case studies from the Supabase `samples` table.
 * The samples table has the following schema:
 * - id: bigint (primary key)
 * - created_at: timestamptz
 * - name: text
 * - network: jsonb (NetworkData structure)
 */
export function useCaseStudies(): UseCaseStudiesReturn {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCaseStudies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useCaseStudies] Fetching case studies from samples table...');
      
      const { data, error: fetchError, status, statusText } = await supabase
        .from('samples')
        .select('id, created_at, name, network')
        .order('created_at', { ascending: false });

      console.log('[useCaseStudies] Response status:', status, statusText);

      if (fetchError) {
        console.error('[useCaseStudies] Fetch error:', fetchError);
        // Check if it's an RLS error
        if (fetchError.code === 'PGRST301' || fetchError.message?.includes('permission')) {
          throw new Error('Access denied. Please check that RLS policies are configured for the samples table.');
        }
        throw new Error(fetchError.message);
      }

      console.log('[useCaseStudies] Fetched data:', data);
      console.log('[useCaseStudies] Number of case studies:', data?.length ?? 0);

      if (data && data.length === 0) {
        console.log('[useCaseStudies] No case studies found. This could be because:');
        console.log('  1. The samples table is empty');
        console.log('  2. RLS is enabled but no SELECT policy exists for the current user/anon role');
      }

      // Map the data to ensure proper typing
      const mappedData: CaseStudy[] = (data || []).map((item: any) => ({
        id: item.id,
        created_at: item.created_at,
        name: item.name,
        network: item.network as NetworkData | null,
      }));

      setCaseStudies(mappedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch case studies';
      console.error('[useCaseStudies] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchCaseStudies();
  }, [fetchCaseStudies]);

  return {
    caseStudies,
    isLoading,
    error,
    refetch: fetchCaseStudies,
  };
}
