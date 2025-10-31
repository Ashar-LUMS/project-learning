import { useEffect, useState } from 'react';
import NetworkEditorLayout from './layout';
import ProjectTabComponent from './tabs/ProjectTab';
import NetworkGraph from './NetworkGraph';
import { supabase } from '../../supabaseClient';

type Network = {
  id: string;
  name: string;
  data: any;
  created_at?: string | null;
};

export default function NetworkEditorPage() {
  const [activeTab, setActiveTab] = useState<'projects' | 'network' | 'therapeutics' | 'analysis' | 'results'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(false);
  const [networksError, setNetworksError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!selectedProjectId) {
      setNetworks([]);
      setSelectedNetworkId(null);
      setNetworksError(null);
      setIsLoadingNetworks(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchNetworks = async () => {
      setIsLoadingNetworks(true);
      setNetworksError(null);

      try {
        const { data: projectRow, error: projectError } = await supabase
          .from('projects')
          .select('networks')
          .eq('id', selectedProjectId)
          .maybeSingle();

        if (projectError) throw projectError;

        const networkIds = Array.isArray(projectRow?.networks)
          ? projectRow?.networks.filter((id): id is string => typeof id === 'string')
          : [];

        if (networkIds.length === 0) {
          if (isMounted) {
            setNetworks([]);
            setSelectedNetworkId(null);
          }
          return;
        }

        const { data: networkRows, error: networkError } = await supabase
          .from('networks')
          .select('id, name, network_data, created_at')
          .in('id', networkIds);

        if (networkError) throw networkError;

        const networkMap = new Map<string, Network>();
        (networkRows ?? []).forEach((row) => {
          networkMap.set(row.id, {
            id: row.id,
            name: row.name,
            data: row.network_data ?? null,
            created_at: row.created_at ?? null,
          });
        });

        const ordered = networkIds
          .map((id) => networkMap.get(id))
          .filter((network): network is Network => Boolean(network));

        if (!isMounted) return;

        setNetworks(ordered);
        setSelectedNetworkId((prev) => {
          if (prev && ordered.some((network) => network.id === prev)) {
            return prev;
          }
          return ordered[0]?.id ?? null;
        });
      } catch (error: any) {
        if (!isMounted) return;
        setNetworks([]);
        setSelectedNetworkId(null);
        setNetworksError(error?.message || 'Failed to load project networks.');
      } finally {
        if (isMounted) {
          setIsLoadingNetworks(false);
        }
      }
    };

    fetchNetworks();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'projects':
        return (
          <div className="h-full">
            <ProjectTabComponent onProjectSelect={setSelectedProjectId} />
          </div>
        );
        
      case 'network':
        return (
          <div className="h-full p-6">
            {selectedProjectId ? (
              <div className="flex flex-col h-full">
                <div className="mb-4">
                  <select 
                    className="w-64 p-2 border rounded-md bg-background"
                    value={selectedNetworkId || ''}
                    onChange={(e) => setSelectedNetworkId(e.target.value)}
                  >
                    <option value="">Select a network</option>
                    {networks.map(network => (
                      <option key={network.id} value={network.id}>
                        {network.name}
                      </option>
                    ))}
                  </select>
                </div>
                {isLoadingNetworks ? (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground">
                    Loading networks...
                  </div>
                ) : networksError ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-destructive">
                    {networksError}
                  </div>
                ) : selectedNetworkId ? (
                  <div className="flex-1">
                    <NetworkGraph networkId={selectedNetworkId} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-muted-foreground">
                    Please select a network to view
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Please select a project from the Projects tab to view networks
              </div>
            )}
          </div>
        );

      case 'therapeutics':
      case 'analysis':
      case 'results':
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} workspace - Coming soon
            </div>
          </div>
        );

      default:
        return (
          <div className="h-full">
            <ProjectTabComponent onProjectSelect={setSelectedProjectId} />
          </div>
        );
    }
  };

  return (
    <NetworkEditorLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderMainContent()}
    </NetworkEditorLayout>
  );
}