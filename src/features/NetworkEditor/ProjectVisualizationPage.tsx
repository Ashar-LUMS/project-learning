"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useToast } from '@/components/ui/toast';
import { cn } from "@/lib/utils";
import { formatTimestamp } from '@/lib/format';
import type { NetworkData, NetworkNode, NetworkEdge, Rule } from '@/types/network';
import NetworkGraph from "./NetworkGraph";
import { supabase } from "../../supabaseClient";
import NetworkEditorLayout from "./layout";
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';
import { useProbabilisticAnalysis } from '@/hooks/useProbabilisticAnalysis';
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import type { AnalysisEdge, AnalysisNode, ProbabilisticAnalysisOptions, WeightedAnalysisOptions, DeterministicAttractor, StateSnapshot } from '@/lib/analysis/types';
import AttractorGraph from './AttractorGraph';
import RulesPage from './RulesPage';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inferRulesFromBiomolecules } from "@/lib/openRouter";
import { useProjectNetworks, type ProjectNetworkRecord } from '@/hooks/useProjectNetworks';
import ProbabilisticLandscape from './ProbabilisticLandscape';

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

function ProjectVisualizationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('network');
  const [networkSubTab, setNetworkSubTab] = useState<'editor' | 'rules'>('editor');
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const { networks, selectedNetworkId, selectedNetwork, selectNetwork, setNetworks, refresh: refreshNetworks } = useProjectNetworks({ projectId });
  const [recentNetworkIds, setRecentNetworkIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Probabilistic analysis dialog state

  // Probabilistic analysis dialog state
  const [isProbabilisticDialogOpen, setIsProbabilisticDialogOpen] = useState(false);
  const [probabilisticForm, setProbabilisticForm] = useState({
    noise: '0.25',
    selfDegradation: '0.1',
    maxIterations: '500',
    tolerance: '1e-4',
    initialProbability: '0.5',
  });
  const [probabilisticFormError, setProbabilisticFormError] = useState<string | null>(null);

  // New Network dialog state
  const [isNewNetworkDialogOpen, setIsNewNetworkDialogOpen] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState<string>("");
  const [isCreatingNetwork, setIsCreatingNetwork] = useState(false);

  // Import Network dialog state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importNetworkName, setImportNetworkName] = useState<string>("Imported Network");
  const [networkFileName, setNetworkFileName] = useState<string>("");
  const [rulesFileName, setRulesFileName] = useState<string>("");
  const [importedNetwork, setImportedNetwork] = useState<NetworkData | null>(null);
  const [importedRules, setImportedRules] = useState<string[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isInferring, setIsInferring] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);

  // Minimal inference wiring so sidebar actions work here too
  const [rulesText, setRulesText] = useState('');

  const {
    result: weightedResult,
    isRunning: isWeightedAnalyzing,
    run: runWeightedAnalysis,
    reset: resetWeightedAnalysis,
  } = useWeightedAnalysis();

  const {
    result: probabilisticResult,
    isRunning: isProbabilisticAnalyzing,
    error: probabilisticError,
    run: runProbabilisticAnalysis,
    reset: resetProbabilisticAnalysis,
  } = useProbabilisticAnalysis();

  // Simple rule-based deterministic analysis (legacy, mostly for rules tab)
  const {
    result: ruleBasedResult,
    isRunning: isRuleBasedRunning,
    error: ruleBasedError,
    run: runRuleBasedAnalysis,
    downloadResults: downloadRuleBasedResults,
    reset: resetRuleBasedAnalysis,
  } = useDeterministicAnalysis();

  const normalizeNodesEdges = (payload: { nodes?: NetworkNode[]; edges?: NetworkEdge[]; thresholdMultiplier?: number; metadata?: Record<string, unknown> }): { nodes: AnalysisNode[]; edges: AnalysisEdge[]; options: WeightedAnalysisOptions } => {
    const nodes: AnalysisNode[] = (Array.isArray(payload?.nodes) ? payload.nodes : []).map((n: NetworkNode) => ({
      id: String(n.id),
      label: String(n.label || n.id),
    }));
    const edges: AnalysisEdge[] = (Array.isArray(payload?.edges) ? payload.edges : []).map((e: NetworkEdge) => ({
      source: String(e.source),
      target: String(e.target),
      weight: Number(e.weight ?? 1),
    }));
    const biasesEntries = Array.isArray(payload?.nodes)
      ? payload.nodes.map((n: NetworkNode) => [String(n.id), Number(n.properties?.bias ?? 0)])
      : [];
    const biases = Object.fromEntries(biasesEntries);
    const options: WeightedAnalysisOptions = {
      tieBehavior: 'hold',
      thresholdMultiplier: typeof payload?.thresholdMultiplier === 'number' ? payload.thresholdMultiplier : 0.5,
      biases,
    };
    return { nodes, edges, options };
  };

  const handleRunWeighted = async () => {
    console.log('[ProjectVisualizationPage] handleRunWeighted called', {
      hasSelectedNetwork: !!selectedNetwork,
      selectedNetworkId,
      networkName: selectedNetwork?.name,
      hasData: !!selectedNetwork?.data,
      nodeCount: selectedNetwork?.data?.nodes?.length ?? 0,
      edgeCount: selectedNetwork?.data?.edges?.length ?? 0,
    });

    if (!selectedNetwork) {
      showToast({ 
        title: 'No Network Selected', 
        description: 'Please select a network in the Network tab first.',
        variant: 'destructive'
      });
      return;
    }

    const networkData = (selectedNetwork as any).data || selectedNetwork;
    const networkNodes = networkData?.nodes || [];
    const networkEdges = networkData?.edges || [];

    if (!networkNodes.length) {
      showToast({ 
        title: 'No Nodes Found', 
        description: 'The selected network has no nodes. Please add nodes in the Network tab first.',
        variant: 'destructive'
      });
      return;
    }

    showToast({
      title: 'Running Weighted Analysis',
      description: `Analyzing network "${selectedNetwork.name}" with ${networkNodes.length} nodes...`,
    });

    const { nodes, edges, options } = normalizeNodesEdges({
      nodes: networkNodes,
      edges: networkEdges,
      thresholdMultiplier: networkData?.metadata?.thresholdMultiplier,
    });

    await runWeightedAnalysis(nodes, edges, options);
  };

  const handleDownloadResults = useCallback(() => {
    // Download whichever result is available
    if (weightedResult) {
      const data = {
        analysis: 'weighted-deterministic',
        timestamp: new Date().toISOString(),
        networkName: selectedNetwork?.name,
        nodeOrder: weightedResult.nodeOrder,
        nodeLabels: weightedResult.nodeLabels,
        attractors: weightedResult.attractors.map(att => ({
          id: att.id,
          type: att.type,
          period: att.period,
          basinSize: att.basinSize,
          basinShare: att.basinShare,
          states: att.states,
        })),
        exploredStateCount: weightedResult.exploredStateCount,
        totalStateSpace: weightedResult.totalStateSpace,
        truncated: weightedResult.truncated,
        warnings: weightedResult.warnings,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weighted-analysis-${selectedNetwork?.name || 'network'}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast({
        title: 'Results Downloaded',
        description: 'Weighted analysis results saved successfully.',
      });
    } else if (probabilisticResult) {
      const data = {
        analysis: 'probabilistic',
        timestamp: new Date().toISOString(),
        networkName: selectedNetwork?.name,
        nodeOrder: probabilisticResult.nodeOrder,
        probabilities: probabilisticResult.probabilities,
        potentialEnergies: probabilisticResult.potentialEnergies,
        converged: probabilisticResult.converged,
        iterations: probabilisticResult.iterations,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `probabilistic-analysis-${selectedNetwork?.name || 'network'}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast({
        title: 'Results Downloaded',
        description: 'Probabilistic analysis results saved successfully.',
      });
    } else if (ruleBasedResult) {
      downloadRuleBasedResults();
      showToast({
        title: 'Results Downloaded',
        description: 'Rule-based analysis results saved successfully.',
      });
    } else {
      showToast({
        title: 'No Results',
        description: 'Run an analysis first to download results.',
        variant: 'destructive',
      });
    }
  }, [weightedResult, probabilisticResult, ruleBasedResult, selectedNetwork?.name, downloadRuleBasedResults, showToast]);

  const handleRunRuleBasedDA = useCallback(async () => {
    if (!selectedNetwork) {
      showToast({ 
        title: 'No Network Selected', 
        description: 'Please select a network in the Network tab first.',
        variant: 'destructive'
      });
      return;
    }

    const networkData = (selectedNetwork as any).data || selectedNetwork;
    const rules = networkData?.rules || [];

    if (!Array.isArray(rules) || rules.length === 0) {
      showToast({ 
        title: 'No Rules Found', 
        description: 'The selected network has no rules. Please add rules in the Rules Analysis tab first.',
        variant: 'destructive'
      });
      return;
    }

    // Convert Rule objects to strings if needed
    const ruleStrings = rules.map((r: any) => typeof r === 'string' ? r : r.name || '');

    showToast({
      title: 'Running Rule-Based Analysis',
      description: `Analyzing network "${selectedNetwork.name}" with ${ruleStrings.length} rules...`,
    });

    try {
      await runRuleBasedAnalysis(ruleStrings);
      showToast({
        title: 'Analysis Complete',
        description: `Rule-based analysis of "${selectedNetwork.name}" completed successfully.`,
      });
    } catch (error) {
      showToast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [selectedNetwork, runRuleBasedAnalysis, showToast]);

  const handleOpenProbabilisticDialog = () => {
    setProbabilisticFormError(null);
    setIsProbabilisticDialogOpen(true);
  };

  const handleProbabilisticSubmit = async () => {
    console.log('[ProjectVisualizationPage] handleProbabilisticSubmit called', {
      hasSelectedNetwork: !!selectedNetwork,
      selectedNetworkId,
      networkName: selectedNetwork?.name,
    });

    if (!selectedNetwork) {
      setProbabilisticFormError('No network selected. Please select a network in the Network tab first.');
      return;
    }

    try {
      const noise = parseFloat(probabilisticForm.noise);
      const selfDegradation = parseFloat(probabilisticForm.selfDegradation);
      const maxIterations = parseInt(probabilisticForm.maxIterations, 10);
      const tolerance = parseFloat(probabilisticForm.tolerance);
      const initialProbability = parseFloat(probabilisticForm.initialProbability);

      if (isNaN(noise) || isNaN(selfDegradation) || isNaN(maxIterations) || isNaN(tolerance) || isNaN(initialProbability)) {
        setProbabilisticFormError('Invalid parameters. Please check your inputs.');
        return;
      }

      const networkData = (selectedNetwork.data || selectedNetwork) as NetworkData | null;
      const nodes: AnalysisNode[] = (Array.isArray(networkData?.nodes) ? networkData.nodes : []).map((n: NetworkNode) => ({
        id: String(n.id),
        label: String(n.label || n.id),
      }));
      const edges: AnalysisEdge[] = (Array.isArray(networkData?.edges) ? networkData.edges : []).map((e: NetworkEdge) => ({
        source: String(e.source),
        target: String(e.target),
        weight: Number(e.weight ?? 1),
      }));

      if (nodes.length === 0) {
        setProbabilisticFormError('The selected network has no nodes. Please add nodes in the Network tab first.');
        return;
      }

      const probabilisticOptions: ProbabilisticAnalysisOptions = {
        noise,
        selfDegradation,
        maxIterations,
        tolerance,
        initialProbability,
      };

      resetProbabilisticAnalysis();
      await runProbabilisticAnalysis(nodes, edges, probabilisticOptions);
      setIsProbabilisticDialogOpen(false);
      
      showToast({
        title: 'Probabilistic Analysis Complete',
        description: `Analysis of "${selectedNetwork.name}" completed successfully.`,
      });
    } catch (error) {
      setProbabilisticFormError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  useEffect(() => {
    if (probabilisticError) {
      setProbabilisticFormError(probabilisticError);
    }
  }, [probabilisticError]);

  // Clear analysis results when selected network changes
  useEffect(() => {
    console.log('[ProjectVisualizationPage] Selected network changed, clearing analysis results', {
      selectedNetworkId,
      networkName: selectedNetwork?.name,
    });
    resetWeightedAnalysis();
    resetProbabilisticAnalysis();
    resetRuleBasedAnalysis();
  }, [selectedNetworkId, resetWeightedAnalysis, resetProbabilisticAnalysis, resetRuleBasedAnalysis, selectedNetwork?.name]);

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
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load project.';
        if (isMounted) {
          setProject(null);
          setLoadError(errorMessage);
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

  const handleOpenNewNetworkDialog = useCallback(() => {
    setNewNetworkName("");
    setIsNewNetworkDialogOpen(true);
  }, []);

  const handleCreateNewNetwork = useCallback(async () => {
    try {
      if (!projectId) {
        setLoadError('Missing project identifier.');
        return;
      }

      const networkName = newNetworkName.trim() || `Untitled Network ${new Date().toLocaleString()}`;
      setIsCreatingNetwork(true);

      // 1) Create a new empty network record
      const { data: createdNetwork, error: createErr } = await supabase
        .from('networks')
        .insert([{ name: networkName, network_data: null }])
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
      if (currentIds.includes(newNetworkId)) {
        console.warn('[handleCreateNewNetwork] Network already in project, skipping update');
      } else {
        const updatedIds = [...currentIds, newNetworkId];
        const { error: updateErr } = await supabase
          .from('projects')
          .update({ networks: updatedIds })
          .eq('id', projectId);

        if (updateErr) throw updateErr;
      }

      // Refresh networks from Supabase to ensure consistency
      refreshNetworks();
      selectNetwork(createdNetwork.id);
      setRecentNetworkIds((prev) => [createdNetwork.id, ...prev.filter((id) => id !== createdNetwork.id)].slice(0, MAX_RECENT_NETWORKS));
      
      setIsNewNetworkDialogOpen(false);
      showToast({
        title: 'Network Created',
        description: `Network "${networkName}" created successfully.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create and link a new network.';
      setLoadError(errorMessage);
      showToast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingNetwork(false);
    }
  }, [projectId, newNetworkName, refreshNetworks, selectNetwork, setRecentNetworkIds, showToast]);

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
    const badNode = nodes.find((n: NetworkNode) => !n || typeof n.id !== 'string');
    if (badNode) throw new Error('Each node must have an id (string)');
    const badEdge = edges.find((e: NetworkEdge) => !e || typeof e.source !== 'string' || typeof e.target !== 'string');
    if (badEdge) throw new Error('Each edge must have source and target (string)');
    const rules = Array.isArray(obj.rules) ? obj.rules.map((r: string) => ({ name: r })) : undefined;
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
        // Convert Rule objects back to string names for the rules text area
        setImportedRules(parsed.rules.map((r: Rule) => r.name));
      }
      // default name from file base
      const base = file.name.replace(/\.[^.]+$/, "");
      setImportNetworkName((prev) => (prev?.startsWith('Imported Network') ? base : prev));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read network file';
      setImportedNetwork(null);
      setImportError(errorMessage);
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read rules file';
      setImportedRules(null);
      setImportError(errorMessage);
    }
  };

  const onInferRules = async () => {
    try {
      setImportError(null);
      if (!importedNetwork || !Array.isArray(importedNetwork.nodes) || importedNetwork.nodes.length === 0) {
        throw new Error('Import a network JSON first to infer rules.');
      }
      const biomolecules = importedNetwork.nodes
        .map((n: NetworkNode) => (typeof n?.id === 'string' ? n.id.trim() : ''))
        .filter(Boolean);
      if (biomolecules.length === 0) {
        throw new Error('No valid node identifiers found to infer rules.');
      }
      setIsInferring(true);
      const rules = await inferRulesFromBiomolecules(biomolecules);
      setImportedRules(rules);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to infer rules';
      setImportError(errorMessage);
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

      // Refresh networks from Supabase to ensure consistency
      refreshNetworks();
      selectNetwork(created.id);
      setRecentNetworkIds((prev) => [created.id, ...prev.filter((id) => id !== created.id)].slice(0, MAX_RECENT_NETWORKS));
      setIsImportOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save imported network';
      setImportError(errorMessage);
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
          onClick={handleOpenNewNetworkDialog}
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
            
            <Tabs value={networkSubTab} onValueChange={(v) => setNetworkSubTab(v as 'editor' | 'rules')} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="editor">Graph Editor</TabsTrigger>
                <TabsTrigger value="rules">Rules Analysis</TabsTrigger>
              </TabsList>
              
              <TabsContent value="editor" className="flex-1 min-h-0 mt-4">
                {!selectedNetworkId ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Link a network to this project to get started.
                  </div>
                ) : (
                  <NetworkGraph networkId={selectedNetworkId} projectId={projectId} onSaved={(newNetwork) => {
                    setNetworks(prev => {
                      const existingIndex = prev.findIndex(n => n.id === newNetwork.id);
                      if (existingIndex >= 0) {
                        // Update: replace the existing network
                        const updated = [...prev];
                        updated[existingIndex] = newNetwork;
                        return updated;
                      } else {
                        // New save: prepend to list
                        return [newNetwork, ...prev];
                      }
                    });
                    selectNetwork(newNetwork.id);
                    setRecentNetworkIds(prev => [newNetwork.id, ...prev.filter(id => id !== newNetwork.id)].slice(0, MAX_RECENT_NETWORKS));
                  }} />
                )}
              </TabsContent>
              
              <TabsContent value="rules" className="flex-1 min-h-0 mt-0">
                <RulesPage 
                  projectId={projectId}
                  selectedNetworkId={selectedNetworkId}
                  selectedNetwork={selectedNetwork}
                  onNetworkCreated={(newNetwork: ProjectNetworkRecord) => {
                    setNetworks(prev => [newNetwork, ...prev]);
                    selectNetwork(newNetwork.id);
                    setRecentNetworkIds(prev => [newNetwork.id, ...prev.filter(id => id !== newNetwork.id)].slice(0, MAX_RECENT_NETWORKS));
                  }}
                  onNetworkUpdated={(updatedNetwork: ProjectNetworkRecord) => {
                    setNetworks(prev => {
                      const index = prev.findIndex(n => n.id === updatedNetwork.id);
                      if (index >= 0) {
                        const updated = [...prev];
                        updated[index] = updatedNetwork;
                        return updated;
                      }
                      return prev;
                    });
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        );
      }

      case 'network-inference': {
        return (
          <div className="flex h-full flex-col gap-4 p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h1 className="text-2xl font-semibold text-foreground line-clamp-2">Inference</h1>
                  {selectedNetwork?.name && (
                    <span className="text-sm text-muted-foreground">Network: <strong>{selectedNetwork.name}</strong></span>
                  )}
                </div>
                {selectedNetwork && selectedNetwork.data && (
                  <div className="flex gap-3 text-xs">
                    <Badge variant="outline">{selectedNetwork.data.nodes?.length ?? 0} nodes</Badge>
                    <Badge variant="outline">{selectedNetwork.data.edges?.length ?? 0} edges</Badge>
                  </div>
                )}
              </div>
              {!selectedNetworkId && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  ⚠️ No network selected. Please select a network in the Network tab first.
                </div>
              )}
              {selectedNetworkId && !selectedNetwork?.data?.nodes?.length && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  ⚠️ Selected network has no nodes. Please add nodes in the Network tab first.
                </div>
              )}
            </div>
            {!selectedNetworkId ? (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Select a network in the Network tab to run analysis.</div>
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
                {isRuleBasedRunning && <div className="text-sm text-muted-foreground">Analyzing rules…</div>}
                {ruleBasedError && <div className="text-sm text-red-600">{ruleBasedError}</div>}
                {ruleBasedResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Nodes</span><span className="text-sm font-semibold">{ruleBasedResult.nodeOrder.length}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Explored States</span><span className="text-sm font-semibold">{ruleBasedResult.exploredStateCount}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">State Space</span><span className="text-sm font-semibold">{ruleBasedResult.totalStateSpace}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Attractors</span><span className="text-sm font-semibold">{ruleBasedResult.attractors.length}</span></div>
                    </div>
                    {ruleBasedResult.attractors.map((attr: DeterministicAttractor) => (
                      <div key={attr.id} className="border rounded-md p-3 bg-background/50">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-sm">Rule-Based Attractor #{attr.id + 1} ({attr.type})</h3>
                          <span className="text-xs text-muted-foreground">Period {attr.period} • Basin {(attr.basinShare*100).toFixed(1)}%</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="overflow-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr>
                                  <th className="text-left p-1 font-semibold">State</th>
                                  {ruleBasedResult.nodeOrder.map((n: string) => (
                                    <th key={n} className="p-1 font-medium">{ruleBasedResult.nodeLabels[n]}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {attr.states.map((s: any, si: number) => (
                                  <tr key={si} className="odd:bg-muted/40">
                                    <td className="p-1 font-mono">{s.binary}</td>
                                    {ruleBasedResult.nodeOrder.map((n: string) => (
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
                  <div className="text-sm text-muted-foreground">Use the sidebar "Perform DA" button to run rule-based analysis on this network.</div>
                )}

                {isWeightedAnalyzing && (
                  <div className="text-sm text-muted-foreground">Running weighted deterministic analysis…</div>
                )}

                {weightedResult && !isWeightedAnalyzing && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Nodes</span><span className="text-sm font-semibold">{weightedResult.nodeOrder.length}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Explored States</span><span className="text-sm font-semibold">{weightedResult.exploredStateCount}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">State Space</span><span className="text-sm font-semibold">{weightedResult.totalStateSpace}</span></div>
                      <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Attractors</span><span className="text-sm font-semibold">{weightedResult.attractors.length}</span></div>
                    </div>
                    {weightedResult.warnings.length > 0 && (
                      <div className="text-xs text-amber-600 space-y-1">
                        {weightedResult.warnings.map((w: string, i: number) => <p key={i}>• {w}</p>)}
                      </div>
                    )}
                    {weightedResult.attractors.map((attr: DeterministicAttractor) => (
                      <div key={attr.id} className="border rounded-md p-3 bg-background/50">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-sm">Weighted Attractor #{attr.id + 1} ({attr.type})</h3>
                          <span className="text-xs text-muted-foreground">Period {attr.period} • Basin {(attr.basinShare*100).toFixed(1)}%</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="overflow-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr>
                                  <th className="text-left p-1 font-semibold">State</th>
                                  {weightedResult.nodeOrder.map((n: string) => (
                                    <th key={n} className="p-1 font-medium">{weightedResult.nodeLabels[n]}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {attr.states.map((s: StateSnapshot, si: number) => (
                                  <tr key={si} className="odd:bg-muted/40">
                                    <td className="p-1 font-mono">{s.binary}</td>
                                    {weightedResult.nodeOrder.map((n: string) => (
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
                )}

                {isProbabilisticAnalyzing && (
                  <div className="text-sm text-muted-foreground">Running probabilistic analysis…</div>
                )}

                {probabilisticResult && !isProbabilisticAnalyzing && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-sm mb-3">Probabilistic Analysis Results</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Nodes</span><span className="text-sm font-semibold">{probabilisticResult.nodeOrder.length}</span></div>
                        <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Converged</span><span className="text-sm font-semibold">{probabilisticResult.converged ? 'Yes' : 'No'}</span></div>
                        <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Iterations</span><span className="text-sm font-semibold">{probabilisticResult.iterations}</span></div>
                        <div className="flex flex-col p-2 rounded-md bg-muted/40"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg P</span><span className="text-sm font-semibold">{(Object.values(probabilisticResult.probabilities).reduce((a, b) => a + b, 0) / probabilisticResult.nodeOrder.length * 100).toFixed(1)}%</span></div>
                      </div>
                    </div>

                    {/* Probability Landscape - 3D Visualization */}
                    <div className="border rounded-md p-4 bg-background/50">
                      <ProbabilisticLandscape
                        nodeOrder={probabilisticResult.nodeOrder}
                        probabilities={probabilisticResult.probabilities}
                        potentialEnergies={probabilisticResult.potentialEnergies}
                        type="probability"
                        className="w-full"
                      />
                    </div>

                    {/* Potential Energy Landscape - 3D Visualization */}
                    {Object.keys(probabilisticResult.potentialEnergies).length > 0 && (
                      <div className="border rounded-md p-4 bg-background/50">
                        <ProbabilisticLandscape
                          nodeOrder={probabilisticResult.nodeOrder}
                          probabilities={probabilisticResult.probabilities}
                          potentialEnergies={probabilisticResult.potentialEnergies}
                          type="energy"
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Node probabilities table */}
                    <div className="border rounded-md p-3 bg-background/50">
                      <h4 className="font-medium text-sm mb-2">Node Steady-State Probabilities</h4>
                      <div className="overflow-auto max-h-60">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="text-left p-2 font-semibold">Node</th>
                              <th className="text-right p-2 font-semibold">Probability</th>
                            </tr>
                          </thead>
                          <tbody>
                            {probabilisticResult.nodeOrder.map((nodeId: string) => (
                              <tr key={nodeId} className="border-t">
                                <td className="p-2">{nodeId}</td>
                                <td className="text-right p-2 font-mono">{(probabilisticResult.probabilities[nodeId] * 100).toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Potential energies table */}
                    {Object.keys(probabilisticResult.potentialEnergies).length > 0 && (
                      <div className="border rounded-md p-3 bg-background/50">
                        <h4 className="font-medium text-sm mb-2">Potential Energies</h4>
                        <div className="overflow-auto max-h-60">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-muted/40">
                                <th className="text-left p-2 font-semibold">Node</th>
                                <th className="text-right p-2 font-semibold">Energy</th>
                              </tr>
                            </thead>
                            <tbody>
                              {probabilisticResult.nodeOrder.map((nodeId: string) => (
                                <tr key={nodeId} className="border-t">
                                  <td className="p-2">{nodeId}</td>
                                  <td className="text-right p-2 font-mono">{probabilisticResult.potentialEnergies[nodeId]?.toFixed(4) ?? 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {probabilisticResult.warnings.length > 0 && (
                      <div className="text-xs text-amber-600 space-y-1 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="font-semibold">Warnings:</p>
                        {probabilisticResult.warnings.map((w: string, i: number) => <p key={i}>• {w}</p>)}
                      </div>
                    )}
                  </div>
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
                setNetworks(prev => {
                  const existingIndex = prev.findIndex(n => n.id === newNetwork.id);
                  if (existingIndex >= 0) {
                    // Update: replace the existing network
                    const updated = [...prev];
                    updated[existingIndex] = newNetwork;
                    return updated;
                  } else {
                    // New save: prepend to list
                    return [newNetwork, ...prev];
                  }
                });
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
        run: handleRunRuleBasedDA,
        runWeighted: handleRunWeighted,
        runProbabilistic: handleOpenProbabilisticDialog,
        download: handleDownloadResults,
        isRunning: isRuleBasedRunning,
        isWeightedRunning: isWeightedAnalyzing,
        isProbabilisticRunning: isProbabilisticAnalyzing,
        hasResult: Boolean(ruleBasedResult || weightedResult || probabilisticResult),
      }}
    >
      {renderMainContent()}

      {/* New Network Dialog */}
      <Dialog open={isNewNetworkDialogOpen} onOpenChange={setIsNewNetworkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Network</DialogTitle>
            <DialogDescription>
              Enter a name for your new network. Leave blank for auto-generated name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-network-name">Network Name</Label>
              <Input
                id="new-network-name"
                placeholder="My Network"
                value={newNetworkName}
                onChange={(e) => setNewNetworkName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreatingNetwork) {
                    handleCreateNewNetwork();
                  }
                }}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewNetworkDialogOpen(false)} disabled={isCreatingNetwork}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewNetwork} disabled={isCreatingNetwork}>
              {isCreatingNetwork ? 'Creating...' : 'Create Network'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Probabilistic Analysis Dialog */}
      <Dialog open={isProbabilisticDialogOpen} onOpenChange={setIsProbabilisticDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Probabilistic Analysis</DialogTitle>
            <DialogDescription>
              Configure noise (µ), self-degradation (c), iteration cap, tolerance, and global initial probability.
            </DialogDescription>
          </DialogHeader>

          {probabilisticFormError && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {probabilisticFormError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="noise">Noise (µ)</Label>
              <Input
                id="noise"
                type="number"
                step="0.01"
                value={probabilisticForm.noise}
                onChange={(e) => setProbabilisticForm((prev) => ({ ...prev, noise: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Higher µ flattens responses.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="selfDeg">Self-degradation (c)</Label>
              <Input
                id="selfDeg"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={probabilisticForm.selfDegradation}
                onChange={(e) => setProbabilisticForm((prev) => ({ ...prev, selfDegradation: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">0..1; higher pushes decay.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxIter">Max iterations</Label>
              <Input
                id="maxIter"
                type="number"
                min="1"
                step="1"
                value={probabilisticForm.maxIterations}
                onChange={(e) => setProbabilisticForm((prev) => ({ ...prev, maxIterations: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tolerance">Tolerance</Label>
              <Input
                id="tolerance"
                type="number"
                step="1e-5"
                value={probabilisticForm.tolerance}
                onChange={(e) => setProbabilisticForm((prev) => ({ ...prev, tolerance: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Convergence threshold.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="initialProb">Initial probability</Label>
              <Input
                id="initialProb"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={probabilisticForm.initialProbability}
                onChange={(e) => setProbabilisticForm((prev) => ({ ...prev, initialProbability: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Fallback when per-node initial P is absent.</p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsProbabilisticDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProbabilisticSubmit} disabled={isProbabilisticAnalyzing}>
              {isProbabilisticAnalyzing ? 'Running…' : 'Run Probabilistic Analysis'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NetworkEditorLayout>
  );
}

export default React.memo(ProjectVisualizationPage);