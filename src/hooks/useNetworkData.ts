import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

type Node = {
  id: string;
  type: string;
  label: string;
};

type Edge = {
  source: string;
  target: string;
  interaction?: string;
};

type NetworkData = {
  nodes: Node[];
  edges: Edge[];
  rules?: string[] | null;
  metadata?: {
    dataset?: string;
    version?: string;
    description?: string;
  };
};

export function useNetworkData(networkId?: string, refreshToken: number = 0) {
  const [data, setData] = useState<NetworkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchData() {
      if (!networkId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const { data: networkData, error: networkError } = await supabase
          .from('networks')
          .select('network_data')
          .eq('id', networkId)
          .single();

        // DEV DEBUG: log the raw response so we can diagnose missing network_data
        // eslint-disable-next-line no-console
        console.log('[useNetworkData] fetched network row for', networkId, { networkData, networkError });

        // If network_data appears missing, fetch full row to inspect other fields
        if (!networkData || !networkData.network_data) {
          try {
            const { data: fullRow, error: fullErr } = await supabase
              .from('networks')
              .select('*')
              .eq('id', networkId)
              .maybeSingle();
            // eslint-disable-next-line no-console
            console.log('[useNetworkData] full row inspect', { fullRow, fullErr });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[useNetworkData] failed to fetch full row', e);
          }
        }

        if (networkError) {
          if (!controller.signal.aborted && isMounted) {
            setError(networkError.message || "Failed to fetch network data");
            setData(null);
          }
        } else {
          if (!controller.signal.aborted && isMounted) {
            setData(networkData?.network_data || null);
          }
        }
      } catch (err: any) {
        if (!controller.signal.aborted && isMounted) {
          setError(err?.message || String(err));
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted && isMounted) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [networkId, refreshToken]);

  return { data, isLoading, error } as const;
}
