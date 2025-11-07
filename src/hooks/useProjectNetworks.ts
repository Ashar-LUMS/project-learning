import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';

interface UseProjectNetworksOptions {
  projectId?: string | null;
  autoSelectFirst?: boolean;
}

export interface ProjectNetworkRecord {
  id: string;
  name: string;
  created_at: string | null;
  data: any;
}

// internal state interface removed (not used)

export function useProjectNetworks({ projectId, autoSelectFirst = true }: UseProjectNetworksOptions) {
  const [networks, setNetworks] = useState<ProjectNetworkRecord[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!projectId) {
      setNetworks([]);
      setSelectedNetworkId(null);
      setIsLoading(false);
      setError(null);
      return () => { isMounted = false; };
    }

    const fetchNetworks = async () => {
      setIsLoading(true); setError(null);
      try {
        const { data: projectRow, error: projectError } = await supabase
          .from('projects')
          .select('networks')
          .eq('id', projectId)
          .maybeSingle();
        if (projectError) throw projectError;
        const networkIds = Array.isArray(projectRow?.networks)
          ? projectRow!.networks.filter((id: any): id is string => typeof id === 'string')
          : [];
        if (networkIds.length === 0) {
          if (isMounted) {
            setNetworks([]);
            setSelectedNetworkId(null);
          }
          return;
        }
        const { data: rows, error: networkError } = await supabase
          .from('networks')
          .select('id, name, network_data, created_at')
          .in('id', networkIds);
        if (networkError) throw networkError;
        const map = new Map<string, ProjectNetworkRecord>();
        (rows || []).forEach(r => {
          map.set(r.id, {
            id: r.id,
            name: r.name,
            data: r.network_data ?? null,
            created_at: r.created_at ?? null,
          });
        });
        const ordered = networkIds.map(id => map.get(id)).filter(Boolean) as ProjectNetworkRecord[];
        if (isMounted) {
          setNetworks(ordered);
          setSelectedNetworkId(prev => {
            if (prev && ordered.some(n => n.id === prev)) return prev;
            return autoSelectFirst ? (ordered[0]?.id ?? null) : null;
          });
        }
      } catch (e: any) {
        if (isMounted) {
          setNetworks([]);
          setSelectedNetworkId(null);
          setError(e?.message || 'Failed to load networks');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchNetworks();
    return () => { isMounted = false; };
  }, [projectId, autoSelectFirst]);

  const selectedNetwork = useMemo(
    () => networks.find(n => n.id === selectedNetworkId) || null,
    [networks, selectedNetworkId]
  );

  const selectNetwork = useCallback((id: string) => {
    setSelectedNetworkId(id);
  }, []);

  return {
    networks,
    selectedNetworkId,
    selectedNetwork,
    isLoading,
    error,
    selectNetwork,
    setNetworks, // expose for creation/import flows
  } as const;
}
