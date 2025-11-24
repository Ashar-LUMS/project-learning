"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatTimestamp } from '@/lib/format';
import NetworkGraph from "./NetworkGraph";
import { supabase } from "../../supabaseClient";
import NetworkEditorLayout from "./layout";
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import AttractorGraph from './AttractorGraph';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { inferRulesFromBiomolecules } from "@/lib/openRouter";
import { useProjectNetworks, type ProjectNetworkRecord } from '@/hooks/useProjectNetworks';

type ProjectRecord = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  networks?: string[] | null;
};

// network records provided by useProjectNetworks

type TabType = 'projects' | 'network' | 'therapeutics' | 'analysis' | 'results' | 'network-inference' | 'env' | 'cell-circuits' | 'cell-lines' | 'simulation';

const MAX_RECENT_NETWORKS = 10;

export default function ProjectVisualizationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('network');
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const { networks, selectedNetworkId, selectedNetwork, selectNetwork, setNetworks } = useProjectNetworks({ projectId });
  const [recentNetworkIds, setRecentNetworkIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Import Network dialog state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importNetworkName, setImportNetworkName] = useState<string>("Imported Network");
  const [networkFileName, setNetworkFileName] = useState<string>("");
  const [rulesFileName, setRulesFileName] = useState<string>("");
  const [importedNetwork, setImportedNetwork] = useState<{ nodes?: any[]; edges?: any[]; rules?: string[] | null; metadata?: any } | null>(null);
  const [importedRules, setImportedRules] = useState<string[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isInferring, setIsInferring] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);

  // Minimal inference wiring so sidebar actions work here too
  const [rulesText, setRulesText] = useState('');
  const {
    isAnalyzing,
    analysisResult,
    analysisError,
    runDeterministic,
    runFromEditorRules,
    downloadResults,
  } = useDeterministicAnalysis({
    selectedNetworkId: selectedNetworkId,
    selectedNetworkName: selectedNetwork?.name ?? null,
    networkData: (selectedNetwork as any)?.data ?? null,
    rulesText,
  });

  useEffect(() => {
    let isMounted = true;
    if (!projectId) {
      setLoadError('Missing project identifier.');
      setIsLoading(false);
      return () => { isMounted = false; };
    }
    const fetchProject = async () => {
      setIsLoading(true); setLoadError(null);
      try {
        const { data: projectRow, error: projectError } = await supabase
          .from('projects')
          .select('id, name, assignees, created_at, networks')
          .eq('id', projectId)
          .maybeSingle();
        if (projectError) throw projectError;
        if (!projectRow) throw new Error('Project not found.');
        if (isMounted) setProject(projectRow as ProjectRecord);
      } catch (e: any) {
        if (isMounted) {
          setProject(null);
          setLoadError(e?.message || 'Failed to load project.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchProject();
    return () => { isMounted = false; };
  }, [projectId]);

  useEffect(() => {
    if (!networks.length) {
      setRecentNetworkIds([]);
      return;
    }
    setRecentNetworkIds(prev => {
      const validPrev = prev.filter(id => networks.some(n => n.id === id));
      if (validPrev.length) {
        const appended = networks.map(n => n.id).filter(id => !validPrev.includes(id));
        return [...validPrev, ...appended].slice(0, MAX_RECENT_NETWORKS);
      }
      return networks.slice(0, MAX_RECENT_NETWORKS).map(n => n.id);
    });
  }, [networks]);

  const handleSelectNetwork = useCallback((networkId: string) => {
    selectNetwork(networkId);
    setRecentNetworkIds(prev => [networkId, ...prev.filter(id => id !== networkId)].slice(0, MAX_RECENT_NETWORKS));
  }, [selectNetwork]);

  const handleNewNetwork = useCallback(() => {
    (async () => {
      try {
        if (!projectId) {
          setLoadError('Missing project identifier.');
          return;
        }

        // 1) Create a new empty network record
        const defaultName = `Untitled Network ${new Date().toLocaleString()}`;
        const { data: createdNetwork, error: createErr } = await supabase
          .from('networks')
          .insert([{ name: defaultName, network_data: null }])
          .select('id, name, network_data, created_at')
          .single();

        if (createErr) throw createErr;
        const newNetworkId = createdNetwork.id as string;

        // 2) Fetch current networks array for the project
        const { data: projRow, error: projErr } = await supabase
          .from('projects')
          .select('networks')
          .eq('id', projectId)
          .maybeSingle();

        if (projErr) throw projErr;
        const currentIds = Array.isArray(projRow?.networks)
          ? (projRow!.networks as string[]).filter((id): id is string => typeof id === 'string')
          : [];

        // 3) Append new network id uniquely and update project
        const updatedIds = Array.from(new Set([...(currentIds || []), newNetworkId]));
        const { error: updateErr } = await supabase
          .from('projects')
          .update({ networks: updatedIds })
          .eq('id', projectId);

        if (updateErr) throw updateErr;

        // 4) Update local state to reflect the new network without full reload
        const newNetwork: ProjectNetworkRecord = {
          id: createdNetwork.id,
          name: createdNetwork.name,
          created_at: createdNetwork.created_at ?? null,
          data: createdNetwork.network_data ?? null,
        };

        setNetworks((prev) => [newNetwork, ...prev]);
        selectNetwork(createdNetwork.id);
        setRecentNetworkIds((prev) => [createdNetwork.id, ...prev.filter((id) => id !== createdNetwork.id)].slice(0, MAX_RECENT_NETWORKS));
      } catch (err: any) {
        setLoadError(err?.message || 'Failed to create and link a new network.');
      }
    })();
  }, [projectId, setNetworks, setRecentNetworkIds, selectNetwork]);

  const handleImportNetwork = useCallback(() => {
    // Open the Import dialog
    setImportError(null);
    setImportedNetwork(null);
    setImportedRules(null);
    setNetworkFileName("");
    setRulesFileName("");
    setImportNetworkName(`Imported Network ${new Date().toLocaleString()}`);
    setIsImportOpen(true);
  }, []);

  const parseNetworkJson = (text: string) => {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') throw new Error('Invalid JSON');
    const nodes = Array.isArray(obj.nodes) ? obj.nodes : [];
    const edges = Array.isArray(obj.edges) ? obj.edges : [];
    if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new Error('JSON must contain arrays: nodes and edges');
    // minimal shape checks
    const badNode = nodes.find((n: any) => !n || typeof n.id !== 'string');
    if (badNode) throw new Error('Each node must have an id (string)');
    const badEdge = edges.find((e: any) => !e || typeof e.source !== 'string' || typeof e.target !== 'string');
    if (badEdge) throw new Error('Each edge must have source and target (string)');
    const rules = Array.isArray(obj.rules) ? (obj.rules as string[]) : null;
    const metadata = obj.metadata ?? {};
    return { nodes, edges, rules, metadata };
  };

  const onPickNetworkFile = async (file?: File | null) => {
    try {
      setImportError(null);
      if (!file) return;
      setNetworkFileName(file.name);
      const text = await file.text();
      const parsed = parseNetworkJson(text);
      setImportedNetwork(parsed);
      // if the JSON contains rules, respect them unless a rules file is also provided
      if (parsed.rules && parsed.rules.length > 0) {
        setImportedRules(parsed.rules);
      }
      // default name from file base
      const base = file.name.replace(/\.[^.]+$/, "");
      setImportNetworkName((prev) => (prev?.startsWith('Imported Network') ? base : prev));
    } catch (err: any) {
      setImportedNetwork(null);
      setImportError(err?.message || 'Failed to read network file');
    }
  };

  const onPickRulesFile = async (file?: File | null) => {
    try {
      setImportError(null);
      if (!file) return;
      setRulesFileName(file.name);
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) throw new Error('Rules file is empty.');
      setImportedRules(lines);
    } catch (err: any) {
      setImportedRules(null);
      setImportError(err?.message || 'Failed to read rules file');
    }
  };

  const onInferRules = async () => {
    try {
      setImportError(null);
      if (!importedNetwork || !Array.isArray(importedNetwork.nodes) || importedNetwork.nodes.length === 0) {
        throw new Error('Import a network JSON first to infer rules.');
      }
      const biomolecules = importedNetwork.nodes
        .map((n: any) => (typeof n?.id === 'string' ? n.id.trim() : ''))
        .filter(Boolean);
      if (biomolecules.length === 0) {
        throw new Error('No valid node identifiers found to infer rules.');
      }
      setIsInferring(true);
      const rules = await inferRulesFromBiomolecules(biomolecules);
      setImportedRules(rules);
    } catch (err: any) {
      setImportError(err?.message || 'Failed to infer rules');
    } finally {
      setIsInferring(false);
    }
  };

  const onSaveImportedNetwork = async () => {
    try {
      if (!projectId) throw new Error('Missing project identifier.');
      if (!importedNetwork) throw new Error('Import a network JSON first.');
      setIsSavingImport(true);
      setImportError(null);

      const networkPayload = {
        nodes: importedNetwork.nodes ?? [],
        edges: importedNetwork.edges ?? [],
        rules: importedRules ?? importedNetwork.rules ?? null,
        metadata: {
          ...(importedNetwork.metadata || {}),
          importedAt: new Date().toISOString(),
          sourceFile: networkFileName || undefined,
          rulesFile: rulesFileName || undefined,
        },
      };

      // 1) Insert network
      const { data: created, error: createErr } = await supabase
        .from('networks')
        .insert([{ name: importNetworkName || `Imported Network ${new Date().toLocaleString()}`, network_data: networkPayload }])
        .select('id, name, network_data, created_at')
        .single();
      if (createErr) throw createErr;

      // 2) Link to project
      const { data: projRow, error: projErr } = await supabase
        .from('projects')
        .select('networks')
        .eq('id', projectId)
        .maybeSingle();
      if (projErr) throw projErr;
      const currentIds = Array.isArray(projRow?.networks) ? (projRow!.networks as string[]) : [];
      const updatedIds = Array.from(new Set([...(currentIds || []), created.id]));
      const { error: updErr } = await supabase
        .from('projects')
        .update({ networks: updatedIds })
        .eq('id', projectId);
      if (updErr) throw updErr;

      // 3) Update local state
      const newNet: ProjectNetworkRecord = {
        id: created.id,
        name: created.name,
        created_at: created.created_at ?? null,
        data: created.network_data ?? null,
      };
      setNetworks((prev) => [newNet, ...prev]);
      selectNetwork(created.id);
      setRecentNetworkIds((prev) => [created.id, ...prev.filter((id) => id !== created.id)].slice(0, MAX_RECENT_NETWORKS));
      setIsImportOpen(false);
    } catch (err: any) {
      setImportError(err?.message || 'Failed to save imported network');
    } finally {
      setIsSavingImport(false);
    }
  };
  const sidebarRecentNetworks = useMemo(
    () => recentNetworkIds
      .map(id => networks.find(n => n.id === id) || null)
      .filter((n): n is ProjectNetworkRecord => Boolean(n)),
    [recentNetworkIds, networks]
  );

  // removed local timestamp formatter in favor of shared utility

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
              <NetworkGraph networkId={selectedNetworkId} projectId={projectId} onSaved={(newNetwork) => {
                setNetworks(prev => [newNetwork, ...prev]);
                selectNetwork(newNetwork.id);
                setRecentNetworkIds(prev => [newNetwork.id, ...prev.filter(id => id !== newNetwork.id)].slice(0, MAX_RECENT_NETWORKS));
              }} />
            </div>
          </div>
        );
      }

      case 'network-inference': {
        return (
          <div className="flex h-full flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-foreground line-clamp-2">Inference</h1>
              {selectedNetwork?.name && (
                <span className="text-xs text-muted-foreground">Selected: {selectedNetwork.name}</span>
              )}
            </div>
            {!selectedNetworkId ? (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Select a network in the Network tab first.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2 items-center text-xs text-muted-foreground">
                  <span>Rules source: network rules or editor text</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="hidden" // keep rules support minimal; full editor lives in main editor page
                    value={rulesText}
                    onChange={(e) => setRulesText(e.target.value)}
                  />
                </div>
                {isAnalyzing && <div className="text-sm text-muted-foreground">Analyzing…</div>}
                {analysisError && <div className="text-sm text-red-600">{analysisError}</div>}
                {analysisResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Nodes</span><span className="text-sm font-semibold">{analysisResult.nodeOrder.length}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Explored States</span><span className="text-sm font-semibold">{analysisResult.exploredStateCount}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">State Space</span><span className="text-sm font-semibold">{analysisResult.totalStateSpace}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Attractors</span><span className="text-sm font-semibold">{analysisResult.attractors.length}</span></div>
                    </div>
                    {analysisResult.attractors.map(attr => (
                      <div key={attr.id} className="border rounded-md p-3 bg-background/50">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-sm">Attractor #{attr.id + 1} ({attr.type})</h3>
                          <span className="text-xs text-muted-foreground">Period {attr.period} • Basin {(attr.basinShare*100).toFixed(1)}%</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="overflow-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr>
                                  <th className="text-left p-1 font-semibold">State</th>
                                  {analysisResult.nodeOrder.map(n => (
                                    <th key={n} className="p-1 font-medium">{analysisResult.nodeLabels[n]}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {attr.states.map((s, si) => (
                                  <tr key={si} className="odd:bg-muted/40">
                                    <td className="p-1 font-mono">{s.binary}</td>
                                    {analysisResult.nodeOrder.map(n => (
                                      <td key={n} className="p-1 text-center">{s.values[n]}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="min-h-[180px]">
                            <AttractorGraph states={attr.states as any} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Use the sidebar actions to run deterministic analysis.</div>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'projects':
        return (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Workspace for this tab is coming soon.
          </div>
        );

      case 'therapeutics': {
        if (!selectedNetworkId) {
          return (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Select a network in the Network tab first to view therapeutics.
            </div>
          );
        }

        return (
          <div className="flex h-full flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-foreground line-clamp-2">Therapeutics</h1>
              {selectedNetwork?.name && (
                <span className="text-xs text-muted-foreground">Selected: {selectedNetwork.name}</span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <NetworkGraph networkId={selectedNetworkId} projectId={projectId} onSaved={(newNetwork) => {
                setNetworks(prev => [newNetwork, ...prev]);
                selectNetwork(newNetwork.id);
                setRecentNetworkIds(prev => [newNetwork.id, ...prev.filter(id => id !== newNetwork.id)].slice(0, MAX_RECENT_NETWORKS));
              }} />
            </div>
          </div>
        );
      }

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
      inferenceActions={{
        run: () => (rulesText ? runFromEditorRules() : runDeterministic()),
        download: downloadResults,
        isRunning: isAnalyzing,
        hasResult: Boolean(analysisResult),
      }}
    >
      {renderMainContent()}

      {/* Import Network Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Network</DialogTitle>
            <DialogDescription>
              Upload a network JSON file, optionally add a rules file, or infer rules from node IDs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-name">Network name</Label>
              <Input id="import-name" value={importNetworkName} onChange={(e) => setImportNetworkName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Network JSON</Label>
              <Input type="file" accept="application/json,.json" onChange={(e) => onPickNetworkFile(e.target.files?.[0])} />
              {networkFileName && <div className="text-xs text-muted-foreground">Selected: {networkFileName}</div>}
            </div>

            <div className="space-y-2">
              <Label>Rules (optional, TXT)</Label>
              <Input type="file" accept="text/plain,.txt" onChange={(e) => onPickRulesFile(e.target.files?.[0])} />
              <div className="flex items-center gap-2 pt-1">
                <Button type="button" variant="outline" onClick={onInferRules} disabled={isInferring || !importedNetwork}>
                  {isInferring ? 'Inferring…' : 'Infer Rules'}
                </Button>
                {Array.isArray(importedRules) && (
                  <span className="text-xs text-muted-foreground">{importedRules.length} rules loaded</span>
                )}
              </div>
            </div>

            {importError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
                {importError}
              </div>
            )}

            {importedNetwork && (
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                <div><strong>Preview</strong></div>
                <div>Nodes: {Array.isArray(importedNetwork.nodes) ? importedNetwork.nodes.length : 0}</div>
                <div>Edges: {Array.isArray(importedNetwork.edges) ? importedNetwork.edges.length : 0}</div>
                <div>Rules: {Array.isArray(importedRules) ? importedRules.length : (Array.isArray(importedNetwork.rules) ? importedNetwork.rules!.length : 0)}</div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSaveImportedNetwork} disabled={!importedNetwork || isSavingImport}>
              {isSavingImport ? 'Saving…' : 'Save & Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NetworkEditorLayout>
  );
}