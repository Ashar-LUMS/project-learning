"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useToast } from '@/components/ui/toast';
import { cn } from "@/lib/utils";
import { formatTimestamp } from '@/lib/format';
import type { NetworkData, NetworkNode, NetworkEdge, Rule, CellFate, TherapeuticIntervention } from '@/types/network';
import NetworkGraph, { type NetworkGraphHandle } from "./NetworkGraph";
import { supabase } from "../../supabaseClient";
import NetworkEditorLayout from "./layout";
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';
import { useProbabilisticAnalysis } from '@/hooks/useProbabilisticAnalysis';
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import type { AnalysisEdge, AnalysisNode, ProbabilisticAnalysisOptions, WeightedAnalysisOptions, DeterministicAttractor, StateSnapshot } from '@/lib/analysis/types';
import AttractorGraph from './AttractorGraph';
import AttractorLandscape from './AttractorLandscape';
import RulesPage from './RulesPage';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { inferRulesFromBiomolecules } from "@/lib/openRouter";
import { useProjectNetworks, type ProjectNetworkRecord } from '@/hooks/useProjectNetworks';
import ProbabilisticLandscape from './ProbabilisticLandscape';
import { FateClassificationDialog, AttractorFateBadge } from './FateClassification';
import { TherapeuticsPanel } from './TherapeuticsPanel';
import { applyTherapiesToNetwork } from '@/lib/applyTherapies';

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
  const [networkGraphRefreshToken, setNetworkGraphRefreshToken] = useState(0);
  const networkGraphRef = useRef<NetworkGraphHandle | null>(null);
  const therapeuticsGraphRef = useRef<NetworkGraphHandle | null>(null);

  // Live interventions state (for therapeutics tab)
  const [liveInterventions, setLiveInterventions] = useState<TherapeuticIntervention[] | null>(null);

  // Sync live interventions when selected network changes
  useEffect(() => {
    setLiveInterventions(selectedNetwork?.therapies || null);
  }, [selectedNetwork?.therapies, selectedNetworkId]);

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

  // Fate classification state
  const [fateDialogOpen, setFateDialogOpen] = useState(false);
  const [selectedAttractorId, setSelectedAttractorId] = useState<number | null>(null);

  // Minimal inference wiring so sidebar actions work here too
  const [rulesText, setRulesText] = useState('');

  const selectedIsRuleBased = useMemo(() => {
    try {
      const data = (selectedNetwork as any)?.data || selectedNetwork;
      const rules = Array.isArray(data?.rules) ? data.rules : [];
      const metaType = data?.metadata?.type || data?.network_data?.metadata?.type;
      return (Array.isArray(rules) && rules.length > 0) || metaType === 'Rule based';
    } catch {
      return false;
    }
  }, [selectedNetwork]);

  // Cell fates derived from selected network metadata (needed early for handlers)
  const cellFates = useMemo<Record<string, CellFate>>(
    () => selectedNetwork?.data?.metadata?.cellFates || {},
    [selectedNetwork]
  );

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

  // Therapeutics-specific analysis hooks (separate from inference tab)
  const {
    result: therapeuticsWeightedResult,
    isRunning: isTherapeuticsWeightedRunning,
    run: runTherapeuticsWeightedAnalysis,
    reset: resetTherapeuticsWeightedAnalysis,
  } = useWeightedAnalysis();

  const {
    result: therapeuticsProbabilisticResult,
    isRunning: isTherapeuticsProbabilisticRunning,
    run: runTherapeuticsProbabilisticAnalysis,
    reset: resetTherapeuticsProbabilisticAnalysis,
  } = useProbabilisticAnalysis();

  const {
    result: therapeuticsRuleBasedResult,
    isRunning: isTherapeuticsRuleBasedRunning,
    run: runTherapeuticsRuleBasedAnalysis,
    reset: resetTherapeuticsRuleBasedAnalysis,
  } = useDeterministicAnalysis();

  // Therapeutics sub-tab state
  const [therapeuticsSubTab, setTherapeuticsSubTab] = useState<'preview' | 'attractors' | 'landscape' | 'comparison'>('preview');
  const [therapeuticsProbabilisticDialogOpen, setTherapeuticsProbabilisticDialogOpen] = useState(false);

  // Comparison data: compare original (inference) results vs therapeutics results
  const comparisonData = useMemo(() => {
    // Get original results
    const originalAttractors = weightedResult?.attractors || ruleBasedResult?.attractors || [];
    const modifiedAttractors = therapeuticsWeightedResult?.attractors || therapeuticsRuleBasedResult?.attractors || [];
    
    const originalProbabilities = probabilisticResult?.probabilities || {};
    const modifiedProbabilities = therapeuticsProbabilisticResult?.probabilities || {};
    
    const hasOriginalDA = !!(weightedResult || ruleBasedResult);
    const hasModifiedDA = !!(therapeuticsWeightedResult || therapeuticsRuleBasedResult);
    const hasOriginalPA = !!probabilisticResult;
    const hasModifiedPA = !!therapeuticsProbabilisticResult;
    
    // Find matching/eliminated/new attractors by comparing state signatures
    const originalStateSignatures = new Set(
      originalAttractors.map((a: DeterministicAttractor) => 
        a.states.map((s: StateSnapshot) => s.binary).sort().join('|')
      )
    );
    const modifiedStateSignatures = new Set(
      modifiedAttractors.map((a: DeterministicAttractor) => 
        a.states.map((s: StateSnapshot) => s.binary).sort().join('|')
      )
    );
    
    const eliminatedAttractors = originalAttractors.filter((a: DeterministicAttractor) => {
      const sig = a.states.map((s: StateSnapshot) => s.binary).sort().join('|');
      return !modifiedStateSignatures.has(sig);
    });
    
    const newAttractors = modifiedAttractors.filter((a: DeterministicAttractor) => {
      const sig = a.states.map((s: StateSnapshot) => s.binary).sort().join('|');
      return !originalStateSignatures.has(sig);
    });
    
    const preservedAttractors = modifiedAttractors.filter((a: DeterministicAttractor) => {
      const sig = a.states.map((s: StateSnapshot) => s.binary).sort().join('|');
      return originalStateSignatures.has(sig);
    });
    
    // Probability changes
    const nodeOrder = therapeuticsProbabilisticResult?.nodeOrder || probabilisticResult?.nodeOrder || [];
    const probabilityChanges = nodeOrder.map((nodeId: string) => {
      const original = originalProbabilities[nodeId] ?? 0;
      const modified = modifiedProbabilities[nodeId] ?? 0;
      return {
        nodeId,
        original,
        modified,
        change: modified - original,
        changePercent: original > 0 ? ((modified - original) / original) * 100 : (modified > 0 ? 100 : 0),
      };
    }).filter((p: { change: number }) => Math.abs(p.change) > 0.001); // Only show significant changes
    
    return {
      hasOriginalDA,
      hasModifiedDA,
      hasOriginalPA,
      hasModifiedPA,
      canCompareDA: hasOriginalDA && hasModifiedDA,
      canComparePA: hasOriginalPA && hasModifiedPA,
      originalAttractorCount: originalAttractors.length,
      modifiedAttractorCount: modifiedAttractors.length,
      eliminatedAttractors,
      newAttractors,
      preservedAttractors,
      probabilityChanges,
    };
  }, [weightedResult, ruleBasedResult, therapeuticsWeightedResult, therapeuticsRuleBasedResult, probabilisticResult, therapeuticsProbabilisticResult]);

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
    // Handle both old format ({ name: "A = B" }) and new format ({ name: "A", action: "B" })
    const ruleStrings = rules.map((r: any) => {
      if (typeof r === 'string') return r;
      if (r.action) return `${r.name} = ${r.action}`;
      if (r.name && r.name.includes('=')) return r.name;
      return '';
    }).filter((s: string) => s.includes('='));

    if (ruleStrings.length === 0) {
      showToast({ 
        title: 'No Valid Rules Found', 
        description: 'The rules could not be parsed. Please check rule format in the Rules tab.',
        variant: 'destructive'
      });
      return;
    }

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

  // Cell fate classification handlers
  const handleOpenFateDialog = useCallback((attractorId: number) => {
    setSelectedAttractorId(attractorId);
    setFateDialogOpen(true);
  }, []);

  const handleSaveFate = useCallback(async (fate: CellFate) => {
    if (!selectedNetwork || selectedAttractorId === null) return;

    const attractorKey = String(selectedAttractorId);
    const updatedCellFates = { ...cellFates, [attractorKey]: fate };

    // Update network metadata in Supabase
    const updatedMetadata = {
      ...selectedNetwork.data?.metadata,
      cellFates: updatedCellFates,
    };

    const { error } = await supabase
      .from('networks')
      .update({ network_data: { ...selectedNetwork.data, metadata: updatedMetadata } })
      .eq('id', selectedNetwork.id);

    if (error) {
      showToast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      showToast({
        title: 'Fate Saved',
        description: `Attractor ${selectedAttractorId} classified as "${fate.name}"`,
      });
      // Trigger refresh by updating networks
      if (networks && selectedNetworkId) {
        const updated: ProjectNetworkRecord[] = networks.map(n =>
          n.id === selectedNetworkId
            ? { 
                ...n, 
                data: { 
                  nodes: n.data?.nodes || [],
                  edges: n.data?.edges || [],
                  rules: n.data?.rules,
                  metadata: updatedMetadata 
                } 
              }
            : n
        );
        setNetworks(updated);
      }
      setFateDialogOpen(false);
    }
  }, [selectedNetwork, selectedAttractorId, cellFates, networks, selectedNetworkId, setNetworks, showToast]);

  const handleRemoveFate = useCallback(async () => {
    if (!selectedNetwork || selectedAttractorId === null) return;

    const attractorKey = String(selectedAttractorId);
    const updatedCellFates = { ...cellFates };
    delete updatedCellFates[attractorKey];

    // Update network metadata in Supabase
    const updatedMetadata = {
      ...selectedNetwork.data?.metadata,
      cellFates: updatedCellFates,
    };

    const { error } = await supabase
      .from('networks')
      .update({ network_data: { ...selectedNetwork.data, metadata: updatedMetadata } })
      .eq('id', selectedNetwork.id);

    if (error) {
      showToast({
        title: 'Remove Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      showToast({
        title: 'Fate Removed',
        description: `Classification removed from attractor ${selectedAttractorId}`,
      });
      // Trigger refresh
      if (networks && selectedNetworkId) {
        const updated: ProjectNetworkRecord[] = networks.map(n =>
          n.id === selectedNetworkId
            ? { 
                ...n, 
                data: { 
                  nodes: n.data?.nodes || [],
                  edges: n.data?.edges || [],
                  rules: n.data?.rules,
                  metadata: updatedMetadata 
                } 
              }
            : n
        );
        setNetworks(updated);
      }
      setFateDialogOpen(false);
    }
  }, [selectedNetwork, selectedAttractorId, cellFates, networks, selectedNetworkId, setNetworks, showToast]);

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

  // Therapeutics analysis handlers (use modified network with interventions)
  const getModifiedNetworkData = useCallback(() => {
    const networkData = selectedNetwork?.data;
    if (!networkData) return null;
    const therapies = selectedNetwork?.therapies;
    const interventionsToApply = liveInterventions || therapies || [];
    if (interventionsToApply.length > 0) {
      return applyTherapiesToNetwork(networkData, interventionsToApply);
    }
    return networkData;
  }, [selectedNetwork, liveInterventions]);

  const handleTherapeuticsWeighted = async () => {
    const modifiedData = getModifiedNetworkData();
    if (!modifiedData) {
      showToast({ title: 'Error', description: 'No network data available.', variant: 'destructive' });
      return;
    }
    const { nodes, edges, options } = normalizeNodesEdges(modifiedData);
    if (nodes.length === 0) {
      showToast({ title: 'Error', description: 'Network has no nodes.', variant: 'destructive' });
      return;
    }
    resetTherapeuticsWeightedAnalysis();
    await runTherapeuticsWeightedAnalysis(nodes, edges, options);
    setTherapeuticsSubTab('attractors');
    showToast({ title: 'Weighted Analysis Complete', description: 'Analysis of therapeutics-modified network completed.' });
  };

  const handleTherapeuticsRuleBased = async () => {
    const modifiedData = getModifiedNetworkData();
    if (!modifiedData) {
      showToast({ title: 'Error', description: 'No network data available.', variant: 'destructive' });
      return;
    }
    // Build rules array from modified network rules
    // Handle both old format ({ name: "A = B" }) and new format ({ name: "A", action: "B" })
    const rules = modifiedData.rules || [];
    const rulesArray = rules.map((r: Rule) => {
      if (r.action) {
        // New format: { name: "A", action: "B && C" }
        return `${r.name} = ${r.action}`;
      } else if (r.name && r.name.includes('=')) {
        // Old format: { name: "A = B && C" }
        return r.name;
      }
      return `${r.name} = ${r.name}`; // Fallback: self-loop
    }).filter((s: string) => s.includes('='));
    
    if (rulesArray.length === 0) {
      showToast({ title: 'Error', description: 'No rules defined. Please define rules first.', variant: 'destructive' });
      return;
    }
    
    // Check for nodes without rules and warn user
    // Rules use node names/labels, so we need to compare against both id and label
    // Parse rule targets from rulesArray to handle both old and new formats
    const ruleTargets = new Set<string>();
    rulesArray.forEach((ruleStr: string) => {
      const match = ruleStr.match(/^([a-zA-Z0-9_]+)\s*=/);
      if (match) ruleTargets.add(match[1]);
    });
    
    const nodeIdentifiers = new Map<string, string>(); // id -> label mapping
    (modifiedData.nodes || []).forEach((n: NetworkNode) => {
      nodeIdentifiers.set(n.id, n.label || n.id);
    });
    
    // A node has a rule if its id OR label matches a rule target
    const nodesWithoutRules = [...nodeIdentifiers.entries()]
      .filter(([id, label]) => !ruleTargets.has(id) && !ruleTargets.has(label))
      .map(([, label]) => label);
    
    if (nodesWithoutRules.length > 0) {
      showToast({ 
        title: 'Warning: Missing Rules', 
        description: `${nodesWithoutRules.length} node(s) have no rules and won't be included in analysis: ${nodesWithoutRules.slice(0, 3).join(', ')}${nodesWithoutRules.length > 3 ? '...' : ''}`,
        variant: 'destructive'
      });
    }
    
    resetTherapeuticsRuleBasedAnalysis();
    await runTherapeuticsRuleBasedAnalysis(rulesArray);
    setTherapeuticsSubTab('attractors');
    showToast({ title: 'Rule-Based Analysis Complete', description: 'Analysis of therapeutics-modified network completed.' });
  };

  const handleTherapeuticsProbabilisticSubmit = async () => {
    const modifiedData = getModifiedNetworkData();
    if (!modifiedData) {
      showToast({ title: 'Error', description: 'No network data available.', variant: 'destructive' });
      return;
    }
    try {
      const noise = parseFloat(probabilisticForm.noise);
      const selfDegradation = parseFloat(probabilisticForm.selfDegradation);
      const maxIterations = parseInt(probabilisticForm.maxIterations, 10);
      const tolerance = parseFloat(probabilisticForm.tolerance);
      const initialProbability = parseFloat(probabilisticForm.initialProbability);
      
      if (isNaN(noise) || noise < 0 || noise > 1) throw new Error('Noise must be between 0 and 1');
      if (isNaN(selfDegradation) || selfDegradation < 0 || selfDegradation > 1) throw new Error('Self-degradation must be between 0 and 1');
      
      const { nodes, edges } = normalizeNodesEdges(modifiedData);
      const probabilisticOptions: ProbabilisticAnalysisOptions = {
        noise,
        selfDegradation,
        maxIterations,
        tolerance,
        initialProbability,
      };
      resetTherapeuticsProbabilisticAnalysis();
      await runTherapeuticsProbabilisticAnalysis(nodes, edges, probabilisticOptions);
      setTherapeuticsProbabilisticDialogOpen(false);
      setTherapeuticsSubTab('landscape');
      showToast({ title: 'Probabilistic Analysis Complete', description: 'Analysis of therapeutics-modified network completed.' });
    } catch (error) {
      showToast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  // Clear analysis results when selected network changes
  useEffect(() => {
    console.log('[ProjectVisualizationPage] Selected network changed, clearing analysis results', {
      selectedNetworkId,
      networkName: selectedNetwork?.name,
    });
    resetWeightedAnalysis();
    resetProbabilisticAnalysis();
    resetRuleBasedAnalysis();
    resetTherapeuticsWeightedAnalysis();
    resetTherapeuticsProbabilisticAnalysis();
    resetTherapeuticsRuleBasedAnalysis();
    setTherapeuticsSubTab('preview');
  }, [selectedNetworkId, resetWeightedAnalysis, resetProbabilisticAnalysis, resetRuleBasedAnalysis, resetTherapeuticsWeightedAnalysis, resetTherapeuticsProbabilisticAnalysis, resetTherapeuticsRuleBasedAnalysis, selectedNetwork?.name]);

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
      if (!importedNetwork && !Array.isArray(importedRules)) throw new Error('Import a rules TXT first.');
      setIsSavingImport(true);
      setImportError(null);

      // Build payload differently depending on whether a full network JSON was provided
      let networkPayload: any;
      if (importedNetwork) {
        networkPayload = {
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
      } else {
        // Construct a rule-based network from uploaded rules
        const rules = importedRules || [];
        const nodeSet = new Set<string>();
        const edgeMap = new Map<string, Set<string>>(); // target -> sources
        rules.forEach(rule => {
          const match = rule.match(/^([a-zA-Z0-9_]+)\s*=/);
          if (match) {
            const target = match[1];
            nodeSet.add(target);

            const exprMatch = rule.match(/=\s*(.+)$/);
            if (exprMatch) {
              const expr = exprMatch[1];
              const identifiers = expr.match(/[a-zA-Z0-9_]+/g) || [];
              identifiers.forEach(id => {
                if (!['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'].includes(id.toUpperCase())) {
                  nodeSet.add(id);
                  if (id !== target) {
                    if (!edgeMap.has(target)) edgeMap.set(target, new Set());
                    edgeMap.get(target)!.add(id);
                  }
                }
              });
            }
          }
        });

        const nodes = Array.from(nodeSet).map((id, i) => ({
          id,
          label: id,
          position: { x: 100 + (i % 5) * 150, y: 100 + Math.floor(i / 5) * 150 }
        }));

        const edges: { source: string; target: string; weight?: number }[] = [];
        for (const [target, sources] of edgeMap.entries()) {
          for (const source of sources) {
            edges.push({ source, target, weight: 1 });
          }
        }

        networkPayload = {
          nodes,
          edges,
          rules: rules.map(r => ({ name: r, enabled: true })),
          metadata: { createdFrom: 'rules', type: 'Rule based', importedAt: new Date().toISOString(), sourceFile: networkFileName, rulesFile: rulesFileName }
        };
      }

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
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{network.name}</span>
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

  // Build therapeutics sidebar content
  const therapeuticsSidebarContent = useMemo(() => {
    if (!selectedNetworkId || !selectedNetwork?.data) {
      return (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Therapeutics
            </h2>
            <p className="text-sm text-muted-foreground">
              Select a network in the Network tab first to configure interventions.
            </p>
          </div>
        </div>
      );
    }

    const networkData = selectedNetwork.data;
    const nodes = networkData.nodes || [];
    const therapies = selectedNetwork.therapies;

    // Build rules map from network data
    const rulesMap: Record<string, string> = {};
    if (networkData.rules) {
      networkData.rules.forEach((rule) => {
        if (rule.name && rule.action) {
          rulesMap[rule.name] = rule.action;
        }
      });
    }

    // Check for rules: original network rules OR modified network rules (after interventions)
    const interventionsToApply = liveInterventions || therapies || [];
    const modifiedData = interventionsToApply.length > 0 
      ? applyTherapiesToNetwork(networkData, interventionsToApply)
      : networkData;
    
    // hasRules is true if either original or modified network has rules
    const originalRulesCount = networkData.rules?.filter(r => r.name && r.action)?.length ?? 0;
    const modifiedRulesCount = modifiedData.rules?.filter(r => r.name && r.action)?.length ?? 0;
    const hasRules = originalRulesCount > 0 || modifiedRulesCount > 0;
    
    const interventionCount = interventionsToApply.length;
    const hasAnalysisResult = !!(therapeuticsWeightedResult || therapeuticsProbabilisticResult || therapeuticsRuleBasedResult);

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Therapeutics
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure interventions for {selectedNetwork.name || 'this network'}
          </p>
        </div>

        <TherapeuticsPanel
          networkId={selectedNetworkId}
          nodes={nodes}
          rules={rulesMap}
          existingTherapies={therapies}
          onTherapiesUpdated={() => {
            refreshNetworks();
          }}
          onInterventionsChange={(interventions) => {
            setLiveInterventions(interventions);
          }}
        />

        <Separator />

        {/* Analysis Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Run Analysis</h3>
            {hasAnalysisResult && (
              <Badge variant="secondary" className="text-xs">Results Ready</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Analyze the network with {interventionCount} intervention{interventionCount !== 1 ? 's' : ''} applied
          </p>

          <div className="space-y-2">
            {/* Rule-Based Analysis */}
            <Button
              onClick={handleTherapeuticsRuleBased}
              variant="outline"
              className="w-full justify-start h-9 text-xs"
              disabled={isTherapeuticsRuleBasedRunning || !hasRules}
              title={!hasRules ? 'No rules defined for this network' : undefined}
            >
              {isTherapeuticsRuleBasedRunning ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                  Running...
                </span>
              ) : (
                'Rule-Based DA'
              )}
            </Button>

            {/* Weighted Analysis */}
            <Button
              onClick={handleTherapeuticsWeighted}
              variant="outline"
              className="w-full justify-start h-9 text-xs"
              disabled={isTherapeuticsWeightedRunning || ((selectedNetwork?.data?.metadata?.type === 'Rule based') || (Array.isArray(selectedNetwork?.data?.rules) && selectedNetwork?.data?.rules.length > 0))}
              title={((selectedNetwork?.data?.metadata?.type === 'Rule based') || (Array.isArray(selectedNetwork?.data?.rules) && selectedNetwork?.data?.rules.length > 0)) ? 'Weighted analysis disabled for rule-based networks' : undefined}
            >
              {isTherapeuticsWeightedRunning ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                  Running...
                </span>
              ) : (
                'Weighted DA'
              )}
            </Button>

            {/* Probabilistic Analysis */}
            <Button
              onClick={() => setTherapeuticsProbabilisticDialogOpen(true)}
              variant="outline"
              className="w-full justify-start h-9 text-xs"
              disabled={isTherapeuticsProbabilisticRunning}
            >
              {isTherapeuticsProbabilisticRunning ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                  Running...
                </span>
              ) : (
                'Probabilistic Analysis'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }, [selectedNetworkId, selectedNetwork, refreshNetworks, liveInterventions, therapeuticsWeightedResult, therapeuticsProbabilisticResult, therapeuticsRuleBasedResult, isTherapeuticsWeightedRunning, isTherapeuticsProbabilisticRunning, isTherapeuticsRuleBasedRunning, handleTherapeuticsWeighted, handleTherapeuticsRuleBased]);

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
          <div className="flex h-full flex-col">
            {/* Compact Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Tabs value={networkSubTab} onValueChange={(v) => setNetworkSubTab(v as 'editor' | 'rules')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="editor" className="text-xs px-3 h-7">Graph</TabsTrigger>
                    <TabsTrigger value="rules" className="text-xs px-3 h-7">Rules</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Separator orientation="vertical" className="h-5" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {selectedNetwork?.name ?? 'No Network'}
                </span>
                {selectedNetwork?.data && (
                  <div className="hidden sm:flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      {selectedNetwork.data.nodes?.length ?? 0} nodes
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      {selectedNetwork.data.edges?.length ?? 0} edges
                    </Badge>
                  </div>
                )}
              </div>
              <div className="hidden md:flex items-center gap-2">
                {/* Determine if selected network is rule-based to disable updates */}
                {/* Support networks with rules or metadata.type === 'Rule based' */}
                
                {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                {(() => {
                  return null;
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedNetworkId || networkSubTab !== 'editor'}
                  onClick={() => networkGraphRef.current?.fitToView()}
                >
                  Fit to View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedNetworkId || networkSubTab !== 'editor'}
                  //disabled={true}
                  onClick={() => networkGraphRef.current?.saveAsNew()}
                >
                  Save as new Weight-Based
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedNetworkId || networkSubTab !== 'editor' || ((selectedNetwork?.data?.metadata?.type === 'Rule based') || (Array.isArray(selectedNetwork?.data?.rules) && selectedNetwork?.data?.rules.length > 0))}
                  //disabled={true}
                  title={((selectedNetwork?.data?.metadata?.type === 'Rule based') || (Array.isArray(selectedNetwork?.data?.rules) && selectedNetwork?.data?.rules.length > 0)) ? 'Cannot update Rule based network' : undefined}
                  onClick={() => networkGraphRef.current?.updateCurrent()}
                >
                  Update Current
                </Button>
              </div>
            </div>
            
            {/* Full-height Content */}
            <div className="flex-1 min-h-0">
              {networkSubTab === 'editor' && (
                <>
                  {!selectedNetworkId ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Link a network to this project to get started.
                    </div>
                  ) : (
                    <NetworkGraph 
                      ref={networkGraphRef}
                      networkId={selectedNetworkId} 
                      projectId={projectId} 
                      refreshToken={networkGraphRefreshToken}
                      hideHeaderActions
                      onSaved={(newNetwork) => {
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
                </>
              )}
              
              {networkSubTab === 'rules' && (
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
                    // Trigger NetworkGraph to refetch data from DB
                    setNetworkGraphRefreshToken(prev => prev + 1);
                  }}
                />
              )}
            </div>
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

                    {/* Attractor Landscape Visualization */}
                    {ruleBasedResult.attractors.length > 0 && (
                      <div className="border rounded-md p-4 bg-background/50">
                        <h4 className="font-medium text-sm mb-3">Attractor Landscape</h4>
                        <AttractorLandscape attractors={ruleBasedResult.attractors} />
                      </div>
                    )}

                    {ruleBasedResult.attractors.map((attr: DeterministicAttractor) => (
                      <div key={attr.id} className="border rounded-md p-3 bg-background/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm">Rule-Based Attractor #{attr.id + 1} ({attr.type})</h3>
                            {cellFates[String(attr.id)] && (
                              <AttractorFateBadge
                                fate={cellFates[String(attr.id)]}
                                onEdit={() => handleOpenFateDialog(attr.id)}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Period {attr.period} • Basin {(attr.basinShare*100).toFixed(1)}%</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenFateDialog(attr.id)}
                            >
                              {cellFates[String(attr.id)] ? 'Edit' : 'Classify'}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="overflow-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr>
                                  {ruleBasedResult.nodeOrder.map((n: string) => (
                                    <th key={n} className="p-1 font-medium">{ruleBasedResult.nodeLabels[n]}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {attr.states.map((s: any, si: number) => (
                                  <tr key={si} className="odd:bg-muted/40">
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm">Weighted Attractor #{attr.id + 1} ({attr.type})</h3>
                            {cellFates[String(attr.id)] && (
                              <AttractorFateBadge
                                fate={cellFates[String(attr.id)]}
                                onEdit={() => handleOpenFateDialog(attr.id)}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Period {attr.period} • Basin {(attr.basinShare*100).toFixed(1)}%</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenFateDialog(attr.id)}
                            >
                              {cellFates[String(attr.id)] ? 'Edit' : 'Classify'}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="overflow-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr>
                                  {weightedResult.nodeOrder.map((n: string) => (
                                    <th key={n} className="p-1 font-medium">{weightedResult.nodeLabels[n]}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {attr.states.map((s: StateSnapshot, si: number) => (
                                  <tr key={si} className="odd:bg-muted/40">
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

        const networkData = selectedNetwork?.data;
        
        // If there's explicitly no stored network data, show a helpful message.
        if (!networkData) {
          // If the selected network exists but its `data` is explicitly null, there's no network content yet.
          if (selectedNetwork && selectedNetwork.data === null) {
            return (
              <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                <div className="text-center">
                  <p className="font-medium">No network data yet</p>
                  <p className="text-xs text-muted-foreground">This network has no nodes or edges. Create or import a network in the Network tab first.</p>
                </div>
              </div>
            );
          }

          // Otherwise, network data is still loading — show spinner.
          return (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                <p>Loading network data...</p>
              </div>
            </div>
          );
        }
        
        const therapies = selectedNetwork?.therapies;

        // Determine which interventions to use: live edits or saved therapies from DB
        const interventionsToApply = liveInterventions || therapies || [];
        
        // Apply therapies to get modified network data for visualization
        const modifiedNetworkData = networkData && interventionsToApply.length > 0
          ? applyTherapiesToNetwork(networkData, interventionsToApply)
          : networkData;

        const hasAttractorResults = !!(therapeuticsWeightedResult || therapeuticsRuleBasedResult);
        const hasLandscapeResults = !!therapeuticsProbabilisticResult;
        const hasComparisonData = comparisonData.canCompareDA || comparisonData.canComparePA;

        return (
          <div className="h-full flex flex-col p-4">
            {/* Header with Tabs */}
            <div className="flex items-center justify-between mb-3">
              <Tabs value={therapeuticsSubTab} onValueChange={(v) => setTherapeuticsSubTab(v as 'preview' | 'attractors' | 'landscape' | 'comparison')}>
                <TabsList className="h-8">
                  <TabsTrigger value="preview" className="text-xs px-3 h-7">
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="attractors" className="text-xs px-3 h-7" disabled={!hasAttractorResults}>
                    Attractors
                    {hasAttractorResults && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 h-4">
                        {(therapeuticsWeightedResult?.attractors?.length || therapeuticsRuleBasedResult?.attractors?.length || 0)}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="landscape" className="text-xs px-3 h-7" disabled={!hasLandscapeResults}>
                    Landscape
                  </TabsTrigger>
                  <TabsTrigger value="comparison" className="text-xs px-3 h-7" disabled={!hasComparisonData}>
                    Comparison
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2">
                {interventionsToApply.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {interventionsToApply.length} intervention{interventionsToApply.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={therapeuticsSubTab !== 'preview'}
                  onClick={() => therapeuticsGraphRef.current?.fitToView()}
                >
                  Fit to View
                </Button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0">
              {therapeuticsSubTab === 'preview' && (
                <div className="h-full border rounded-lg bg-white">
                  <NetworkGraph 
                    ref={therapeuticsGraphRef}
                    key={`therapeutics-${selectedNetworkId}-${interventionsToApply.length}`}
                    networkId={selectedNetworkId} 
                    projectId={projectId}
                    overrideNetworkData={modifiedNetworkData}
                    readOnly={true}
                    hideControls={true}
                    hideHeaderActions={true}
                    highlightNodeIds={interventionsToApply.filter(t => t.type === 'knock-in').map(t => t.nodeName)}
                    onSaved={() => {}}
                  />
                </div>
              )}

              {therapeuticsSubTab === 'attractors' && (
                <div className="h-full overflow-auto">
                  {!hasAttractorResults ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Run Rule-Based or Weighted analysis to see attractors.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Attractor Details */}
                      <div className="border rounded-lg p-4 bg-card">
                        <h3 className="text-sm font-semibold mb-3">Attractor Details</h3>
                        <div className="space-y-4">
                          {(therapeuticsWeightedResult?.attractors || therapeuticsRuleBasedResult?.attractors || []).map((attractor: DeterministicAttractor, idx: number) => (
                            <div key={idx} className="border rounded-md p-3 bg-background">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  Attractor {idx + 1}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {attractor.states.length} state{attractor.states.length !== 1 ? 's' : ''} • Basin: {(attractor.basinShare * 100).toFixed(1)}%
                                </span>
                                {cellFates[attractor.id] && (
                                  <AttractorFateBadge fate={cellFates[attractor.id]} />
                                )}
                              </div>
                              <div className="mb-3">
                                <AttractorGraph 
                                  states={attractor.states}
                                  className="h-32"
                                />
                              </div>
                              <div className="text-xs text-muted-foreground mb-1">States:</div>
                              <div className="flex flex-wrap gap-1">
                                {attractor.states.map((state, stateIdx) => (
                                  <code key={stateIdx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                    {state.binary}
                                  </code>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {therapeuticsSubTab === 'landscape' && (
                <div className="h-full overflow-auto">
                  {!hasLandscapeResults ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Run Probabilistic analysis to see the landscape.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Probabilistic Landscape */}
                      <div className="border rounded-lg p-4 bg-card overflow-hidden">
                        <h3 className="text-sm font-semibold mb-3">Probabilistic Landscape</h3>
                        <div className="h-[350px]">
                          <ProbabilisticLandscape 
                            nodeOrder={therapeuticsProbabilisticResult?.nodeOrder || []}
                            probabilities={therapeuticsProbabilisticResult?.probabilities || {}}
                            potentialEnergies={therapeuticsProbabilisticResult?.potentialEnergies || {}}
                            type="probability"
                          />
                        </div>
                      </div>

                      {/* Node Probabilities */}
                      <div className="border rounded-lg p-4 bg-card">
                        <h3 className="text-sm font-semibold mb-3">Steady-State Probabilities</h3>
                        <div className="overflow-auto max-h-60">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-muted/40">
                                <th className="text-left p-2 font-semibold">Node</th>
                                <th className="text-right p-2 font-semibold">Probability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {therapeuticsProbabilisticResult?.nodeOrder.map((nodeId: string) => (
                                <tr key={nodeId} className="border-t">
                                  <td className="p-2">{nodeId}</td>
                                  <td className="text-right p-2 font-mono">
                                    {((therapeuticsProbabilisticResult?.probabilities[nodeId] ?? 0) * 100).toFixed(2)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {therapeuticsSubTab === 'comparison' && (
                <div className="h-full overflow-auto">
                  {!hasComparisonData ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Run analysis on both original network (Inference tab) and modified network (Therapeutics tab) to see comparison.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="border rounded-lg p-3 bg-card">
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Original Attractors</div>
                          <div className="text-xl font-bold">{comparisonData.originalAttractorCount}</div>
                        </div>
                        <div className="border rounded-lg p-3 bg-card">
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Modified Attractors</div>
                          <div className="text-xl font-bold">{comparisonData.modifiedAttractorCount}</div>
                        </div>
                        <div className="border rounded-lg p-3 bg-card">
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Eliminated</div>
                          <div className="text-xl font-bold text-red-600">{comparisonData.eliminatedAttractors.length}</div>
                        </div>
                        <div className="border rounded-lg p-3 bg-card">
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">New</div>
                          <div className="text-xl font-bold text-green-600">{comparisonData.newAttractors.length}</div>
                        </div>
                      </div>

                      {/* Eliminated Attractors */}
                      {comparisonData.eliminatedAttractors.length > 0 && (
                        <div className="border rounded-lg p-4 bg-card">
                          <h3 className="text-sm font-semibold mb-3 text-red-600">Eliminated Attractors</h3>
                          <div className="space-y-2">
                            {comparisonData.eliminatedAttractors.map((attractor: DeterministicAttractor, idx: number) => (
                              <div key={idx} className="border border-red-200 rounded-md p-3 bg-red-50">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs border-red-300 text-red-700">
                                    {attractor.type === 'fixed-point' ? 'Fixed Point' : `Cycle (${attractor.period})`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Basin: {(attractor.basinShare * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {attractor.states.map((state: StateSnapshot, stateIdx: number) => (
                                    <code key={stateIdx} className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded font-mono">
                                      {state.binary}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* New Attractors */}
                      {comparisonData.newAttractors.length > 0 && (
                        <div className="border rounded-lg p-4 bg-card">
                          <h3 className="text-sm font-semibold mb-3 text-green-600">New Attractors</h3>
                          <div className="space-y-2">
                            {comparisonData.newAttractors.map((attractor: DeterministicAttractor, idx: number) => (
                              <div key={idx} className="border border-green-200 rounded-md p-3 bg-green-50">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                    {attractor.type === 'fixed-point' ? 'Fixed Point' : `Cycle (${attractor.period})`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Basin: {(attractor.basinShare * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {attractor.states.map((state: StateSnapshot, stateIdx: number) => (
                                    <code key={stateIdx} className="text-[10px] bg-green-100 px-1.5 py-0.5 rounded font-mono">
                                      {state.binary}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preserved Attractors */}
                      {comparisonData.preservedAttractors.length > 0 && (
                        <div className="border rounded-lg p-4 bg-card">
                          <h3 className="text-sm font-semibold mb-3 text-blue-600">Preserved Attractors</h3>
                          <div className="space-y-2">
                            {comparisonData.preservedAttractors.map((attractor: DeterministicAttractor, idx: number) => (
                              <div key={idx} className="border border-blue-200 rounded-md p-3 bg-blue-50">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                    {attractor.type === 'fixed-point' ? 'Fixed Point' : `Cycle (${attractor.period})`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Basin: {(attractor.basinShare * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {attractor.states.map((state: StateSnapshot, stateIdx: number) => (
                                    <code key={stateIdx} className="text-[10px] bg-blue-100 px-1.5 py-0.5 rounded font-mono">
                                      {state.binary}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Probability Changes */}
                      {comparisonData.canComparePA && comparisonData.probabilityChanges.length > 0 && (
                        <div className="border rounded-lg p-4 bg-card">
                          <h3 className="text-sm font-semibold mb-3">Probability Changes</h3>
                          <div className="overflow-auto max-h-60">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-muted/40">
                                  <th className="text-left p-2 font-semibold">Node</th>
                                  <th className="text-right p-2 font-semibold">Original</th>
                                  <th className="text-right p-2 font-semibold">Modified</th>
                                  <th className="text-right p-2 font-semibold">Change</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comparisonData.probabilityChanges.map((p: { nodeId: string; original: number; modified: number; change: number }) => (
                                  <tr key={p.nodeId} className="border-t">
                                    <td className="p-2">{p.nodeId}</td>
                                    <td className="text-right p-2 font-mono">{(p.original * 100).toFixed(1)}%</td>
                                    <td className="text-right p-2 font-mono">{(p.modified * 100).toFixed(1)}%</td>
                                    <td className={`text-right p-2 font-mono ${p.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {p.change > 0 ? '+' : ''}{(p.change * 100).toFixed(1)}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* No Changes Message */}
                      {comparisonData.eliminatedAttractors.length === 0 && 
                       comparisonData.newAttractors.length === 0 && 
                       comparisonData.probabilityChanges.length === 0 && (
                        <div className="border rounded-lg p-6 bg-card text-center">
                          <div className="text-muted-foreground text-sm">
                            No significant changes detected between original and modified network.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
      therapeuticsSidebar={therapeuticsSidebarContent}
      inferenceActions={{
        run: handleRunRuleBasedDA,
        runWeighted: handleRunWeighted,
        runProbabilistic: handleOpenProbabilisticDialog,
        download: handleDownloadResults,
        isRunning: isRuleBasedRunning,
        isWeightedRunning: isWeightedAnalyzing,
        isProbabilisticRunning: isProbabilisticAnalyzing,
        isRuleBased: selectedIsRuleBased,
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
            <DialogTitle>Import Rules based Network</DialogTitle>
            <DialogDescription>
              Upload a rules file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-name">Network name</Label>
              <Input id="import-name" value={importNetworkName} onChange={(e) => setImportNetworkName(e.target.value)} />
            </div>

            {/*<div className="space-y-2">
              <Label>Network JSON</Label>
              <Input type="file" accept="application/json,.json" onChange={(e) => onPickNetworkFile(e.target.files?.[0])} />
              {networkFileName && <div className="text-xs text-muted-foreground">Selected: {networkFileName}</div>}
            </div>*/}

            <div className="space-y-2">
              <Label>Rules (TXT)</Label>
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
            <Button onClick={onSaveImportedNetwork} disabled={!(importedNetwork || Array.isArray(importedRules)) || isSavingImport}>
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

      {/* Therapeutics Probabilistic Analysis Dialog */}
      <Dialog open={therapeuticsProbabilisticDialogOpen} onOpenChange={setTherapeuticsProbabilisticDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Probabilistic Analysis (Therapeutics)</DialogTitle>
            <DialogDescription>
              Run probabilistic analysis on the network with interventions applied.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="t-noise">Noise (µ)</Label>
              <Input
                id="t-noise"
                type="number"
                step="0.01"
                value={probabilisticForm.noise}
                onChange={(e) => setProbabilisticForm((prev) => ({ ...prev, noise: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Higher µ flattens responses.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-selfDeg">Self-degradation (c)</Label>
              <Input
                id="t-selfDeg"
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
              <Label htmlFor="t-maxIter">Max iterations</Label>
              <Input
                id="t-maxIter"
                type="number"
                min="1"
                step="1"
                value={probabilisticForm.maxIterations}
                onChange={(e) => setProbabilisticForm((prev) => ({ ...prev, maxIterations: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-tolerance">Tolerance</Label>
              <Input
                id="t-tolerance"
                type="number"
                step="1e-5"
                value={probabilisticForm.tolerance}
                onChange={(e) => setProbabilisticForm((prev) => ({ ...prev, tolerance: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Convergence threshold.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-initialProb">Initial probability</Label>
              <Input
                id="t-initialProb"
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
            <Button variant="outline" onClick={() => setTherapeuticsProbabilisticDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTherapeuticsProbabilisticSubmit} disabled={isTherapeuticsProbabilisticRunning}>
              {isTherapeuticsProbabilisticRunning ? 'Running…' : 'Run Probabilistic Analysis'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fate Classification Dialog */}
      <FateClassificationDialog
        open={fateDialogOpen}
        onOpenChange={setFateDialogOpen}
        attractorId={selectedAttractorId ?? 0}
        currentFate={selectedAttractorId !== null ? cellFates[String(selectedAttractorId)] : undefined}
        availableMarkers={selectedNetwork?.data?.nodes?.map(n => n.label || String(n.id)) || []}
        onSave={handleSaveFate}
        onRemove={handleRemoveFate}
      />
    </NetworkEditorLayout>
  );
}

export default React.memo(ProjectVisualizationPage);