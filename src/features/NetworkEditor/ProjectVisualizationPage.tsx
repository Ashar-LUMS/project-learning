"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import NetworkGraph from "./NetworkGraph";
import { supabase } from "../../supabaseClient";
import NetworkEditorLayout from "./layout";

type ProjectRecord = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  networks?: string[] | null;
};

type NetworkRecord = {
  id: string;
  name: string;
  created_at: string | null;
  data: any;
};

type TabType = 'projects' | 'network' | 'therapeutics' | 'analysis' | 'results';

const MAX_RECENT_NETWORKS = 10;

export default function ProjectVisualizationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('network');
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [networks, setNetworks] = useState<NetworkRecord[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [recentNetworkIds, setRecentNetworkIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!projectId) {
      setLoadError("Missing project identifier.");
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const loadProjectAndNetworks = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const { data: projectRow, error: projectError } = await supabase
          .from('projects')
          .select('id, name, assignees, created_at, networks')
          .eq('id', projectId)
          .maybeSingle();

        if (projectError) throw projectError;
        if (!projectRow) throw new Error('Project not found.');

        const networkIds = Array.isArray(projectRow.networks)
          ? projectRow.networks.filter((id): id is string => typeof id === 'string')
          : [];

        let orderedNetworks: NetworkRecord[] = [];

        if (networkIds.length > 0) {
          const { data: networkRows, error: networkError } = await supabase
            .from('networks')
            .select('id, name, network_data, created_at')
            .in('id', networkIds);

          if (networkError) throw networkError;

          const networkMap = new Map<string, NetworkRecord>();
          (networkRows ?? []).forEach((row) => {
            networkMap.set(row.id, {
              id: row.id,
              name: row.name,
              created_at: row.created_at ?? null,
              data: row.network_data ?? null,
            });
          });

          orderedNetworks = networkIds
            .map((id) => networkMap.get(id))
            .filter((network): network is NetworkRecord => Boolean(network));

          if ((networkRows ?? []).length !== orderedNetworks.length) {
            (networkRows ?? []).forEach((row) => {
              if (!networkIds.includes(row.id)) {
                orderedNetworks.push({
                  id: row.id,
                  name: row.name,
                  created_at: row.created_at ?? null,
                  data: row.network_data ?? null,
                });
              }
            });
          }
        }

        if (!isMounted) return;

        setProject(projectRow as ProjectRecord);
        setNetworks(orderedNetworks);
      } catch (error: any) {
        if (!isMounted) return;
        setProject(null);
        setNetworks([]);
        setSelectedNetworkId(null);
        setRecentNetworkIds([]);
        setLoadError(error?.message || 'Failed to load project.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProjectAndNetworks();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!networks.length) {
      setSelectedNetworkId(null);
      setRecentNetworkIds([]);
      return;
    }

    setSelectedNetworkId((prev) => {
      if (prev && networks.some((network) => network.id === prev)) {
        return prev;
      }
      return networks[0]?.id ?? null;
    });

    setRecentNetworkIds((prev) => {
      const validPrev = prev.filter((id) => networks.some((network) => network.id === id));
      if (validPrev.length > 0) {
        const missing = networks
          .map((network) => network.id)
          .filter((id) => !validPrev.includes(id));
        return [...validPrev, ...missing].slice(0, MAX_RECENT_NETWORKS);
      }

      return [...networks]
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        })
        .map((network) => network.id)
        .slice(0, MAX_RECENT_NETWORKS);
    });
  }, [networks]);

  const handleSelectNetwork = useCallback((networkId: string) => {
    setSelectedNetworkId(networkId);
    setRecentNetworkIds((prev) => {
      const deduped = prev.filter((id) => id !== networkId);
      return [networkId, ...deduped].slice(0, MAX_RECENT_NETWORKS);
    });
  }, []);

  const handleNewNetwork = useCallback(() => {
    console.info('New network workflow to be implemented.');
  }, []);

  const handleImportNetwork = useCallback(() => {
    console.info('Import network workflow to be implemented.');
  }, []);

  const selectedNetwork = useMemo(
    () => networks.find((network) => network.id === selectedNetworkId) ?? null,
    [networks, selectedNetworkId]
  );

  const sidebarRecentNetworks = useMemo(
    () => recentNetworkIds
      .map((id) => networks.find((network) => network.id === id) || null)
      .filter((network): network is NetworkRecord => Boolean(network)),
    [recentNetworkIds, networks]
  );

  const formatTimestamp = useCallback((value: string | null) => {
    if (!value) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));
    } catch {
      return value;
    }
  }, []);

  const networkSidebarContent = (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleNewNetwork}
          className="w-full rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
          disabled={isLoading}
        >
          + New Network
        </button>
        <button
          type="button"
          onClick={handleImportNetwork}
          className="w-full rounded-lg border border-muted bg-card p-3 text-left text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
          disabled={isLoading}
        >
          Import Network
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Recently opened</h3>
        {isLoading ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-xs text-muted-foreground">
            Loading networks...
          </div>
        ) : sidebarRecentNetworks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-xs text-muted-foreground">
            No networks linked to this project yet.
          </div>
        ) : (
          <div className="space-y-2">
            {sidebarRecentNetworks.map((network) => {
              const createdLabel = formatTimestamp(network.created_at);
              const isActive = network.id === selectedNetworkId;
              return (
                <button
                  key={network.id}
                  type="button"
                  onClick={() => handleSelectNetwork(network.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors", 
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-card hover:border-muted hover:bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground line-clamp-1">{network.name}</span>
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-wide text-primary">Active</span>
                    )}
                  </div>
                  {createdLabel && (
                    <div className="mt-1 text-xs text-muted-foreground">Created {createdLabel}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderMainContent = () => {
    if (!projectId) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Missing project identifier.
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Loading project...
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-4 text-sm text-destructive">
            {loadError}
          </div>
        </div>
      );
    }

    if (!project) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Project details are unavailable.
        </div>
      );
    }

    switch (activeTab) {
      case 'network': {
        if (!selectedNetworkId) {
          return (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Link a network to this project to get started.
            </div>
          );
        }

        return (
          <div className="flex h-full flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-foreground line-clamp-2">
                {selectedNetwork?.name ?? 'Network'}
              </h1>
              {selectedNetwork?.created_at && (
                <span className="text-xs text-muted-foreground">
                  Created {formatTimestamp(selectedNetwork.created_at)}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <NetworkGraph networkId={selectedNetworkId} />
            </div>
          </div>
        );
      }

      case 'projects':
      case 'therapeutics':
      case 'analysis':
      case 'results':
        return (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Workspace for this tab is coming soon.
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <NetworkEditorLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      networkSidebar={networkSidebarContent}
    >
      {renderMainContent()}
    </NetworkEditorLayout>
  );
}