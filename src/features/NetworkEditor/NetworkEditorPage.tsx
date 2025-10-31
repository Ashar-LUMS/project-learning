import { useEffect, useState } from 'react';
import NetworkEditorLayout from './layout';
import ProjectTabComponent from './tabs/ProjectTab';
import NetworkGraph from './NetworkGraph';
import { supabase } from '../../supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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

  const renderNetworkSelector = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Select Network
      </label>
      <Select value={selectedNetworkId || ''} onValueChange={setSelectedNetworkId}>
        <SelectTrigger className="w-80">
          <SelectValue placeholder="Choose a network..." />
        </SelectTrigger>
        <SelectContent>
          {networks.map((network) => (
            <SelectItem key={network.id} value={network.id}>
              <div className="flex items-center justify-between w-full">
                <span className="font-medium">{network.name}</span>
                {network.created_at && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {new Date(network.created_at).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

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
              <div className="flex flex-col h-full space-y-6">
                {renderNetworkSelector()}
                
                {isLoadingNetworks ? (
                  <Card className="flex-1">
                    <CardContent className="flex items-center justify-center h-full p-8">
                      <div className="space-y-4 text-center">
                        <Skeleton className="h-8 w-48 mx-auto" />
                        <Skeleton className="h-4 w-64 mx-auto" />
                        <Skeleton className="h-32 w-full max-w-2xl mx-auto" />
                      </div>
                    </CardContent>
                  </Card>
                ) : networksError ? (
                  <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <p className="font-semibold mb-2">Unable to load networks</p>
                        <p className="text-sm opacity-90">{networksError}</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : selectedNetworkId ? (
                  <Card className="flex-1">
                    <CardContent className="p-6 h-full">
                      <NetworkGraph networkId={selectedNetworkId} />
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="flex-1">
                    <CardContent className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <div className="max-w-md space-y-4">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                          <svg 
                            className="w-8 h-8 text-muted-foreground" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={1.5} 
                              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" 
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold mb-2">No Network Selected</h3>
                          <p className="text-sm text-muted-foreground">
                            Choose a network from the dropdown above to visualize and analyze your network structure.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="max-w-md space-y-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                      <svg 
                        className="w-8 h-8 text-muted-foreground" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1.5} 
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" 
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Project Required</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Please select a project from the Projects tab to access and manage your networks.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'therapeutics':
      case 'analysis':
      case 'results':
        return (
          <div className="h-full p-6">
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="max-w-md space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <svg 
                      className="w-8 h-8 text-primary" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={1.5} 
                        d="M13 10V3L4 14h7v7l9-11h-7z" 
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2 capitalize">
                      {activeTab} Workspace
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      The {activeTab} module is currently under development and will be available soon.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Coming Soon
                  </Badge>
                </div>
              </CardContent>
            </Card>
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