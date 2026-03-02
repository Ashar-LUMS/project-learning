"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useToast } from '@/components/ui/toast';
import { cn } from "@/lib/utils";
import { formatTimestamp } from '@/lib/format';
import type { NetworkData, NetworkNode, NetworkEdge, Rule, CellFate, TherapeuticIntervention } from '@/types/network';
import { importNetwork, exportAndDownloadNetworkAs, SUPPORTED_EXPORT_FORMATS, type ExportFormat } from '@/lib/networkIO';
import { MergeNetworkDialog, type NetworkOption } from './MergeNetworkDialog';
import { CaseStudyDialog } from './CaseStudyDialog';
import NetworkGraph, { type NetworkGraphHandle } from "./NetworkGraph";
import { supabase } from "../../supabaseClient";
import NetworkEditorLayout, { type TabType } from "./layout";
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';
import { useProbabilisticAnalysis } from '@/hooks/useProbabilisticAnalysis';
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import type { AnalysisEdge, AnalysisNode, ProbabilisticAnalysisOptions, WeightedAnalysisOptions, DeterministicAttractor, StateSnapshot } from '@/lib/analysis/types';
import AttractorLandscape from './AttractorLandscape';
import RulesPage from './RulesPage';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inferRulesFromBiomolecules } from "@/lib/openRouter";
import { useProjectNetworks, type ProjectNetworkRecord } from '@/hooks/useProjectNetworks';
import ProbabilisticLandscape from './ProbabilisticLandscape';
import { FateClassificationDialog, AttractorFateBadge } from './FateClassification';
import { TherapeuticsPanel } from './TherapeuticsPanel';
import { applyTherapiesToNetwork } from '@/lib/applyTherapies';
import SeqAnalysisTab from './tabs/SeqAnalysisTab';
import ExomeSeqTab from './tabs/ExomeSeqTab';
import { PatientDrugScoresDialog } from './PatientDrugScoresDialog';
import { Network, FileText, BarChart3, Trash2, Plus, Upload, Download, GitMerge, BookOpen, Eye, Pencil, Waypoints, Play, Pill, FlaskConical, Dna } from 'lucide-react';

type ProjectRecord = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  networks?: string[] | null;
};

// network records provided by useProjectNetworks

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
  const [newNetworkType, setNewNetworkType] = useState<'rules' | 'weights'>('weights');
  const [isCreatingNetwork, setIsCreatingNetwork] = useState(false);

  // Import Network dialog state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<'type' | 'upload'>('type');
  const [importNetworkType, setImportNetworkType] = useState<'rules' | 'weights'>('weights');
  const [importNetworkName, setImportNetworkName] = useState<string>("Imported Network");
  const [networkFileName, setNetworkFileName] = useState<string>("");
  const [rulesFileName, setRulesFileName] = useState<string>("");
  const [importedNetwork, setImportedNetwork] = useState<NetworkData | null>(null);
  const [importedRules, setImportedRules] = useState<string[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isInferring, setIsInferring] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);

  // Export Network dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedExportFormats, setSelectedExportFormats] = useState<ExportFormat[]>(['csv']);

  // Merge Network dialog state
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);

  // Case Study dialog state
  const [isCaseStudyDialogOpen, setIsCaseStudyDialogOpen] = useState(false);

  // Delete Network confirmation state
  const [networkToDelete, setNetworkToDelete] = useState<ProjectNetworkRecord | null>(null);
  const [isDeletingNetwork, setIsDeletingNetwork] = useState(false);

  // Fate classification state
  const [fateDialogOpen, setFateDialogOpen] = useState(false);
  const [selectedAttractorId, setSelectedAttractorId] = useState<number | null>(null);

  // Patient Drug Scores dialog state
  const [patientDrugScoresDialogOpen, setPatientDrugScoresDialogOpen] = useState(false);

  // Landscape dialog states
  const [attractorLandscapeOpen, setAttractorLandscapeOpen] = useState(false);
  const [attractorLandscapeData, setAttractorLandscapeData] = useState<DeterministicAttractor[] | null>(null);
  const [probabilityLandscapeOpen, setProbabilityLandscapeOpen] = useState(false);
  const [energyLandscapeOpen, setEnergyLandscapeOpen] = useState(false);
  const [showProbabilityTables, setShowProbabilityTables] = useState(false);
  const [landscapeProbabilisticData, setLandscapeProbabilisticData] = useState<{
    nodeOrder: string[];
    probabilities: Record<string, number>;
    potentialEnergies: Record<string, number>;
  } | null>(null);

  // Minimal inference wiring so sidebar actions work here too

  const [ruleBasedNodeLimitWarning, setRuleBasedNodeLimitWarning] = useState<string | null>(null);

  // Map of node ID to label for display purposes
  const nodeIdToLabel = useMemo(() => {
    const map: Record<string, string> = {};
    const networkData = (selectedNetwork as any)?.data || selectedNetwork;
    const nodes = networkData?.nodes || [];
    for (const node of nodes) {
      map[node.id] = node.label || node.id;
    }
    return map;
  }, [selectedNetwork]);

  const selectedIsRuleBased = useMemo(() => {
    try {
      const data = (selectedNetwork as any)?.data || selectedNetwork;
      const rules = Array.isArray(data?.rules) ? data.rules : [];
      const metaType = data?.metadata?.type || data?.network_data?.metadata?.type;
      return (Array.isArray(rules) && rules.length > 0) || metaType === 'Rule Based';
    } catch {
      return false;
    }
  }, [selectedNetwork]);

  useEffect(() => {
    setRuleBasedNodeLimitWarning(null);
  }, [selectedNetworkId]);

  // Reset networkSubTab to 'editor' when switching to a weight-based network
  useEffect(() => {
    if (!selectedIsRuleBased && networkSubTab === 'rules') {
      setNetworkSubTab('editor');
    }
  }, [selectedIsRuleBased, networkSubTab]);

  // Cell fates derived from selected network metadata (needed early for handlers)
  const cellFates = useMemo<Record<string, CellFate>>(
    () => selectedNetwork?.data?.metadata?.cellFates || {},
    [selectedNetwork]
  );

  const {
    result: weightedResult,
    isRunning: isWeightedAnalyzing,
    error: weightedError,
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
      thresholdMultiplier: typeof payload?.thresholdMultiplier === 'number' ? payload.thresholdMultiplier : 0,
      biases,
    };
    return { nodes, edges, options };
  };

  const handleRunWeighted = async () => {
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

    setRuleBasedNodeLimitWarning(null);

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
    // Check if network has nodes before opening the dialog
    if (!selectedNetwork) {
      showToast({
        title: 'No Network Selected',
        description: 'Please select a network first.',
        variant: 'destructive'
      });
      return;
    }

    const networkData = (selectedNetwork.data || selectedNetwork) as NetworkData | null;
    const nodes = Array.isArray(networkData?.nodes) ? networkData.nodes : [];

    if (nodes.length === 0) {
      showToast({
        title: 'No Nodes Found',
        description: 'The selected network has no nodes. Please add nodes in the Network tab first.',
        variant: 'destructive'
      });
      return;
    }

    setProbabilisticFormError(null);
    setIsProbabilisticDialogOpen(true);
  };

  const handleProbabilisticSubmit = async () => {
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

  const handleOpenTherapeuticsProbabilisticDialog = () => {
    // Check if network has nodes before opening the dialog
    if (!selectedNetwork) {
      showToast({
        title: 'No Network Selected',
        description: 'Please select a network first.',
        variant: 'destructive'
      });
      return;
    }

    const networkData = (selectedNetwork.data || selectedNetwork) as NetworkData | null;
    const nodes = Array.isArray(networkData?.nodes) ? networkData.nodes : [];

    if (nodes.length === 0) {
      showToast({
        title: 'No Nodes Found',
        description: 'The selected network has no nodes. Please add nodes in the Network tab first.',
        variant: 'destructive'
      });
      return;
    }

    setTherapeuticsProbabilisticDialogOpen(true);
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
    setNewNetworkType('weights');
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

      // Build initial network_data with type metadata
      const initialNetworkData = {
        nodes: [],
        edges: [],
        rules: newNetworkType === 'rules' ? [] : undefined,
        metadata: {
          type: newNetworkType === 'rules' ? 'Rule Based' : 'Weight Based',
        },
      };

      // 1) Create a new empty network record with type metadata
      const { data: createdNetwork, error: createErr } = await supabase
        .from('networks')
        .insert([{ name: networkName, network_data: initialNetworkData }])
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
        // Network already in project, skipping update
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
      
      // If rule-based, switch to rules sub-tab
      if (newNetworkType === 'rules') {
        setNetworkSubTab('rules');
      } else {
        setNetworkSubTab('editor');
      }
      
      showToast({
        title: 'Network Created',
        description: `${newNetworkType === 'rules' ? 'Rule-based' : 'Weight-based'} network "${networkName}" created successfully.`,
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
  }, [projectId, newNetworkName, newNetworkType, refreshNetworks, selectNetwork, setRecentNetworkIds, showToast]);

  const handleImportNetwork = useCallback(() => {
    // Open the Import dialog and reset to type selection step
    setImportError(null);
    setImportedNetwork(null);
    setImportedRules(null);
    setNetworkFileName("");
    setRulesFileName("");
    setImportNetworkName(`Imported Network ${new Date().toLocaleString()}`);
    setImportStep('type');
    setImportNetworkType('weights');
    setIsImportOpen(true);
  }, []);

  const handleMergeNetwork = useCallback(() => {
    if (networks.length < 2) {
      showToast({
        title: 'Not Enough Networks',
        description: 'You need at least 2 networks in this project to merge.',
        variant: 'destructive',
      });
      return;
    }
    setIsMergeDialogOpen(true);
  }, [networks.length, showToast]);

  const handleSaveMergedNetwork = useCallback(async (mergedData: NetworkData, name: string) => {
    try {
      console.log('[handleSaveMergedNetwork] Starting save...');
      console.log('[handleSaveMergedNetwork] Data:', 'Nodes:', mergedData.nodes?.length, 'Edges:', mergedData.edges?.length, 'Rules:', mergedData.rules?.length);
      
      if (!projectId) throw new Error('Missing project identifier.');

      // Clean/optimize the network data to reduce payload size
      const cleanedData: NetworkData = {
        nodes: mergedData.nodes.map(n => ({
          id: n.id,
          label: n.label,
          ...(n.type && { type: n.type }),
          ...(n.weight !== undefined && { weight: n.weight }),
          ...(n.properties && Object.keys(n.properties).length > 0 && { properties: n.properties }),
        })),
        edges: mergedData.edges.map(e => ({
          source: e.source,
          target: e.target,
          ...(e.interaction && { interaction: e.interaction }),
          ...(e.weight !== undefined && { weight: e.weight }),
          ...(e.properties && Object.keys(e.properties).length > 0 && { properties: e.properties }),
        })),
        ...(mergedData.rules && mergedData.rules.length > 0 && { rules: mergedData.rules }),
        ...(mergedData.metadata && Object.keys(mergedData.metadata).length > 0 && { metadata: mergedData.metadata }),
      };

      const payloadSize = JSON.stringify(cleanedData).length;
      console.log('[handleSaveMergedNetwork] Cleaned payload size:', (payloadSize / 1024).toFixed(2), 'KB');

      // 1) Insert merged network
      console.log('[handleSaveMergedNetwork] Inserting network...');
      const { data: created, error: createErr } = await supabase
        .from('networks')
        .insert([{ name, network_data: cleanedData }])
        .select('id, name, network_data, created_at')
        .single();
      if (createErr) {
        console.error('[handleSaveMergedNetwork] Insert error:', createErr);
        // Check for timeout errors specifically
        if (createErr.message?.toLowerCase().includes('timeout')) {
          throw new Error(
            `Database timeout: The network is too large (${mergedData.nodes.length} nodes, ${mergedData.edges.length} edges). ` +
            `Try reducing the network size or increase the statement_timeout in Supabase Dashboard > Database > Settings.`
          );
        }
        throw new Error(`Failed to insert network: ${createErr.message}${createErr.details ? ` (${createErr.details})` : ''}`);
      }
      console.log('[handleSaveMergedNetwork] Network created with ID:', created.id);

      // 2) Link to project
      console.log('[handleSaveMergedNetwork] Linking to project...');
      const { data: projRow, error: projErr } = await supabase
        .from('projects')
        .select('networks')
        .eq('id', projectId)
        .maybeSingle();
      if (projErr) {
        console.error('[handleSaveMergedNetwork] Project fetch error:', projErr);
        throw new Error(`Failed to fetch project: ${projErr.message}`);
      }
      const currentIds = Array.isArray(projRow?.networks) ? (projRow!.networks as string[]) : [];
      const updatedIds = Array.from(new Set([...(currentIds || []), created.id]));
      const { error: updErr } = await supabase
        .from('projects')
        .update({ networks: updatedIds })
        .eq('id', projectId);
      if (updErr) {
        console.error('[handleSaveMergedNetwork] Project update error:', updErr);
        throw new Error(`Failed to link network to project: ${updErr.message}`);
      }
      console.log('[handleSaveMergedNetwork] Network linked to project');

      // Refresh networks and select the new one
      refreshNetworks();
      selectNetwork(created.id);
      setRecentNetworkIds((prev) => [created.id, ...prev.filter((id) => id !== created.id)].slice(0, MAX_RECENT_NETWORKS));

      showToast({
        title: 'Networks Merged',
        description: `Merged network "${name}" created with ${mergedData.nodes.length} nodes and ${mergedData.edges.length} edges.`,
      });
    } catch (err) {
      console.error('[handleSaveMergedNetwork] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save merged network';
      showToast({
        title: 'Merge Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [projectId, refreshNetworks, selectNetwork, setRecentNetworkIds, showToast]);

  // Handle loading a case study from the samples table
  const handleLoadCaseStudy = useCallback(async (networkData: NetworkData, name: string) => {
    try {
      if (!projectId) throw new Error('Missing project identifier.');

      // 1) Insert case study network
      const { data: created, error: createErr } = await supabase
        .from('networks')
        .insert([{ name, network_data: networkData }])
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

      // Refresh networks and select the new one
      refreshNetworks();
      selectNetwork(created.id);
      setRecentNetworkIds((prev) => [created.id, ...prev.filter((id) => id !== created.id)].slice(0, MAX_RECENT_NETWORKS));

      showToast({
        title: 'Case Study Loaded',
        description: `Network "${name}" loaded with ${networkData.nodes?.length ?? 0} nodes and ${networkData.edges?.length ?? 0} edges.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load case study';
      showToast({
        title: 'Load Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [projectId, refreshNetworks, selectNetwork, setRecentNetworkIds, showToast]);

  // Unified file picker: handles CSV (weighted) or TXT (rules)
  const onPickNetworkFile = async (file?: File | null) => {
    try {
      setImportError(null);
      if (!file) return;
      setNetworkFileName(file.name);
      const text = await file.text();
      
      // Use the unified importer
      const parsed = importNetwork(text, file.name);
      setImportedNetwork(parsed);
      
      // If it's rule-based, extract rules as strings
      if (parsed.rules && parsed.rules.length > 0) {
        const ruleStrings = parsed.rules.map(r => 
          typeof r === 'string' ? r : r.name
        ).filter(Boolean);
        setImportedRules(ruleStrings);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse network file';
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
      if (!importedNetwork && !Array.isArray(importedRules)) throw new Error('Import a rules TXT first.');
      setIsSavingImport(true);
      setImportError(null);

      // Determine the final network type based on user selection
      const finalType = importNetworkType === 'rules' ? 'Rule Based' : 'Weight Based';

      // Build payload differently depending on whether a full network JSON was provided
      let networkPayload: any;
      if (importedNetwork) {
        networkPayload = {
          nodes: importedNetwork.nodes ?? [],
          edges: importedNetwork.edges ?? [],
          rules: importNetworkType === 'rules' ? (importedRules ?? importedNetwork.rules ?? []) : undefined,
          metadata: {
            ...(importedNetwork.metadata || {}),
            type: finalType,
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
          metadata: { createdFrom: 'rules', type: 'Rule Based', importedAt: new Date().toISOString(), sourceFile: networkFileName, rulesFile: rulesFileName }
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

  // Helper to determine network type from data
  const getNetworkType = useCallback((network: ProjectNetworkRecord): 'rule-based' | 'weight-based' => {
    const data = network.data;
    if (!data) return 'weight-based'; // Default to weight-based if no data
    
    // Check metadata.type first (authoritative source)
    // Support both 'Weight based' and legacy 'weight based' casing
    const metaType = data.metadata?.type;
    if (metaType === 'Rule Based') return 'rule-based';
    if (metaType === 'Weight Based' || metaType === 'weight based') return 'weight-based';
    
    // Fallback: check if network has rules
    if (Array.isArray(data.rules) && data.rules.length > 0) return 'rule-based';
    
    return 'weight-based';
  }, []);

  // Bifurcate networks by type
  const { ruleBasedNetworks, weightBasedNetworks } = useMemo(() => {
    const ruleBased: ProjectNetworkRecord[] = [];
    const weightBased: ProjectNetworkRecord[] = [];
    
    // Use recent networks order for display
    sidebarRecentNetworks.forEach(network => {
      if (getNetworkType(network) === 'rule-based') {
        ruleBased.push(network);
      } else {
        weightBased.push(network);
      }
    });
    
    return { ruleBasedNetworks: ruleBased, weightBasedNetworks: weightBased };
  }, [sidebarRecentNetworks, getNetworkType]);

  // Handle network deletion
  const handleDeleteNetwork = useCallback(async () => {
    if (!networkToDelete || !projectId) return;
    setIsDeletingNetwork(true);
    try {
      // Remove from networks table
      const { error: deleteError } = await supabase
        .from('networks')
        .delete()
        .eq('id', networkToDelete.id);
      if (deleteError) throw deleteError;

      // Remove from project's networks array
      const updatedNetworkIds = networks
        .filter(n => n.id !== networkToDelete.id)
        .map(n => n.id);
      const { error: updateError } = await supabase
        .from('projects')
        .update({ networks: updatedNetworkIds })
        .eq('id', projectId);
      if (updateError) throw updateError;

      // Update local state
      setNetworks(prev => prev.filter(n => n.id !== networkToDelete.id));
      if (selectedNetworkId === networkToDelete.id) {
        const remaining = networks.filter(n => n.id !== networkToDelete.id);
        selectNetwork(remaining[0]?.id || '');
      }
      showToast({ title: 'Network Deleted', description: `"${networkToDelete.name}" has been removed.` });
    } catch (e) {
      showToast({ title: 'Delete Failed', description: e instanceof Error ? e.message : 'Failed to delete network', variant: 'destructive' });
    } finally {
      setIsDeletingNetwork(false);
      setNetworkToDelete(null);
    }
  }, [networkToDelete, projectId, networks, selectedNetworkId, setNetworks, selectNetwork, showToast]);

  // Render a single network item in the sidebar
  const renderNetworkItem = useCallback((network: ProjectNetworkRecord) => {
    const createdLabel = formatTimestamp(network.created_at);
    const isActive = network.id === selectedNetworkId;
    const networkType = getNetworkType(network);
    const isRuleBased = networkType === 'rule-based';
    return (
      <div
        key={network.id}
        className={cn(
          "w-full rounded border p-1 text-left transition-colors group relative", 
          isActive
            ? "border-primary bg-primary/10 text-primary"
            : "border-transparent bg-card hover:border-muted hover:bg-muted"
        )}
      >
        <button
          type="button"
          onClick={() => handleSelectNetwork(network.id)}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between gap-1 pr-4">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span
                className={cn(
                  "inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-extrabold flex-shrink-0 ring-1",
                  isRuleBased
                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 ring-blue-500/30"
                    : "bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-amber-500/30"
                )}
                title={isRuleBased ? 'Rule-Based' : 'Weight-Based'}
              >
                {isRuleBased ? 'R' : 'W'}
              </span>
              <span className="text-[11px] font-medium text-foreground break-words flex-1 min-w-0">{network.name}</span>
            </div>
            {isActive && (
              <span className="text-[10px] uppercase tracking-wide text-primary flex-shrink-0 whitespace-nowrap">Active</span>
            )}
          </div>
          {createdLabel && (
            <div className="mt-0.5 text-[10px] text-muted-foreground pl-[22px]">Created {createdLabel}</div>
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setNetworkToDelete(network);
          }}
          className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
          title="Delete network"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }, [selectedNetworkId, handleSelectNetwork, getNetworkType]);

  // removed local timestamp formatter in favor of shared utility

  const networkSidebarContent = (
    <div className="space-y-4 flex-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-500/10">
          <Network className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Network Editor</h2>
          <p className="text-xs text-muted-foreground">
            {networks.length} network{networks.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Actions */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Actions</p>
        <button
          type="button"
          onClick={handleOpenNewNetworkDialog}
          className="w-full flex items-center gap-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          disabled={isLoading}
        >
          <Plus className="w-3.5 h-3.5" />
          New Network
        </button>
        <button
          type="button"
          onClick={handleImportNetwork}
          className="w-full flex items-center gap-2.5 rounded-lg border border-muted bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          disabled={isLoading}
        >
          <Upload className="w-3.5 h-3.5" />
          Import Network
        </button>
        <button
          type="button"
          onClick={() => {
            if (!selectedNetwork) {
              showToast({ title: 'No Network Selected', description: 'Select a network to export', variant: 'destructive' });
              return;
            }
            if (!selectedNetwork.data) {
              showToast({ title: 'No Data', description: 'Selected network has no data', variant: 'destructive' });
              return;
            }
            setSelectedExportFormats([selectedIsRuleBased ? 'txt' : 'csv']);
            setIsExportDialogOpen(true);
          }}
          className="w-full flex items-center gap-2.5 rounded-lg border border-muted bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          disabled={isLoading || !selectedNetwork}
        >
          <Download className="w-3.5 h-3.5" />
          Export Network
        </button>
        <button
          type="button"
          onClick={handleMergeNetwork}
          className="w-full flex items-center gap-2.5 rounded-lg border border-muted bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          disabled={isLoading || networks.length < 2}
        >
          <GitMerge className="w-3.5 h-3.5" />
          Merge Networks
        </button>
        <button
          type="button"
          onClick={() => setIsCaseStudyDialogOpen(true)}
          className="w-full flex items-center gap-2.5 rounded-lg border border-muted bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          disabled={isLoading}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Load Case Studies
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-xs text-muted-foreground text-center">
          Loading networks...
        </div>
      ) : sidebarRecentNetworks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center space-y-1.5">
          <Network className="w-6 h-6 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No networks linked yet</p>
        </div>
      ) : (
        <>
          <Separator className="bg-border/50" />
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Networks</p>

          {/* Rule-Based Networks Section */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-500/15 text-[9px] font-extrabold text-blue-600 dark:text-blue-400">R</span>
              <h3 className="text-xs font-semibold text-muted-foreground flex-1">Rule-Based</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {ruleBasedNetworks.length}
              </Badge>
            </div>
            {ruleBasedNetworks.length === 0 ? (
              <div className="rounded border border-dashed border-muted-foreground/20 p-2 text-[11px] text-muted-foreground/60 italic text-center">
                None
              </div>
            ) : (
              <div 
                className="space-y-1" 
                style={ruleBasedNetworks.length > 2 ? {
                  maxHeight: '120px',
                  overflowY: 'auto',
                  scrollbarWidth: 'thin'
                } : undefined}
              >
                {ruleBasedNetworks.map(renderNetworkItem)}
              </div>
            )}
          </div>

          {/* Weight-Based Networks Section */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-500/15 text-[9px] font-extrabold text-amber-600 dark:text-amber-400">W</span>
              <h3 className="text-xs font-semibold text-muted-foreground flex-1">Weight-Based</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {weightBasedNetworks.length}
              </Badge>
            </div>
            {weightBasedNetworks.length === 0 ? (
              <div className="rounded border border-dashed border-muted-foreground/20 p-2 text-[11px] text-muted-foreground/60 italic text-center">
                None
              </div>
            ) : (
              <div 
                className="space-y-1" 
                style={weightBasedNetworks.length > 2 ? {
                  maxHeight: '120px',
                  overflowY: 'auto',
                  scrollbarWidth: 'thin'
                } : undefined}
              >
                {weightBasedNetworks.map(renderNetworkItem)}
              </div>
            )}
          </div>
        </>
      )}

      {/* View Mode Selector */}
      {selectedNetworkId && (
        <>
          <Separator className="bg-border/50" />
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">View Mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setNetworkSubTab('editor')}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                  networkSubTab === 'editor'
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "border-muted bg-card hover:border-muted-foreground/50 hover:bg-muted/50"
                )}
              >
                <Eye className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs font-medium">Topology</span>
              </button>
              <button
                type="button"
                onClick={() => selectedIsRuleBased && setNetworkSubTab('rules')}
                disabled={!selectedIsRuleBased}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                  networkSubTab === 'rules'
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "border-muted bg-card",
                  !selectedIsRuleBased
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:border-muted-foreground/50 hover:bg-muted/50"
                )}
                title={!selectedIsRuleBased ? "Only available for rule-based networks" : undefined}
              >
                <Pencil className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs font-medium">Rules</span>
              </button>
            </div>
            {!selectedIsRuleBased && (
              <p className="text-xs text-muted-foreground italic">
                Rules editing is only available for rule-based networks
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Seq Analysis sidebar content with network selector
  const seqAnalysisSidebarContent = (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-sky-500/10">
          <Dna className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Seq Analysis</h2>
          <p className="text-xs text-muted-foreground">Sequencing data processing</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Network Context Selector */}
      {networks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Network</p>
          <Select
            value={selectedNetworkId ?? ""}
            onValueChange={(val) => {
              if (val) selectNetwork(val);
            }}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Select a network..." />
            </SelectTrigger>
            <SelectContent>
              {networks.map(n => (
                <SelectItem key={n.id} value={n.id}>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {n.data?.nodes?.length || 0}
                    </Badge>
                    <span className="truncate">{n.name || n.id}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedNetworkId ? (
            <p className="text-[11px] text-muted-foreground px-1">Filtering by: {selectedNetwork?.name || selectedNetworkId}</p>
          ) : (
            <p className="text-[11px] text-amber-600 px-1">No network selected — all genes shown</p>
          )}
        </div>
      )}

      <Separator className="bg-border/50" />

      {/* Requirements */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Required Files</p>
        <div className="space-y-1.5 text-xs px-1">
          <div className="flex items-start gap-2">
            <span className="font-medium text-sky-600 shrink-0">R1:</span>
            <span className="text-muted-foreground">Forward reads (.fastq.gz)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sky-600 shrink-0">R2:</span>
            <span className="text-muted-foreground">Reverse reads (.fastq.gz)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sky-600 shrink-0">Ref:</span>
            <span className="text-muted-foreground">Reference genome (.fa.gz)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sky-600 shrink-0">Ann:</span>
            <span className="text-muted-foreground">Gene annotation (.gff3.gz)</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Inference sidebar content with network selector
  const inferenceSidebarContent = (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Waypoints className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Network Analysis</h2>
          <p className="text-xs text-muted-foreground">Inference &amp; simulation</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Network Selector */}
      {networks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Network</p>
          <Select
            value={selectedNetworkId ?? ""}
            onValueChange={(val) => {
              if (val) selectNetwork(val);
            }}
          >
            <SelectTrigger className="h-8 text-xs overflow-hidden">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {networks.map(n => (
                <SelectItem key={n.id} value={n.id}>
                  <span className="flex items-center gap-1.5 max-w-[180px]">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                      {n.data?.nodes?.length || 0}
                    </Badge>
                    <span className="truncate">{n.name || n.id}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator className="bg-border/50" />

      {/* Deterministic Analysis */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Deterministic</p>
        <div className="flex gap-1.5">
          <Button
            className="h-8 text-xs px-3 gap-1.5"
            onClick={handleRunRuleBasedDA}
            disabled={Boolean(isRuleBasedRunning) || !selectedIsRuleBased}
            variant={selectedIsRuleBased ? "default" : "outline"}
            title={!selectedIsRuleBased ? 'Rule-based networks only' : 'Run rule-based analysis'}
            size="sm"
          >
            <FileText className="w-3 h-3" />
            Rule-based
          </Button>
          <Button
            className="h-8 text-xs px-3 gap-1.5"
            onClick={handleRunWeighted}
            disabled={isWeightedAnalyzing || selectedIsRuleBased}
            variant={!selectedIsRuleBased ? "default" : "outline"}
            title={selectedIsRuleBased ? 'Weight-based networks only' : 'Run weighted analysis'}
            size="sm"
          >
            <BarChart3 className="w-3 h-3" />
            Weighted
          </Button>
        </div>
      </div>

      {/* Probabilistic Analysis */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Probabilistic</p>
        <Button
          className="h-8 text-xs px-3 gap-1.5"
          onClick={handleOpenProbabilisticDialog}
          disabled={Boolean(isProbabilisticAnalyzing)}
          variant="secondary"
          size="sm"
        >
          <Play className="w-3 h-3" />
          Run Analysis
        </Button>
      </div>

      {/* ODE */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">ODE</p>
        <Button
          className="h-8 text-xs px-3 gap-1.5"
          variant="outline"
          disabled
          size="sm"
        >
          <FlaskConical className="w-3 h-3" />
          Coming Soon
        </Button>
      </div>

      <Separator className="bg-border/50" />

      {/* Download Results */}
      <div>
        <Button
          variant="outline"
          className="h-8 text-xs px-3 gap-1.5 w-full"
          onClick={handleDownloadResults}
          disabled={!Boolean(ruleBasedResult || weightedResult || probabilisticResult)}
        >
          <Download className="w-3 h-3" />
          Download Results
        </Button>
      </div>
    </div>
  );

  // Build therapeutics sidebar content
  const therapeuticsSidebarContent = useMemo(() => {
    if (!selectedNetworkId || !selectedNetwork?.data) {
      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Pill className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Therapeutics</h2>
              <p className="text-xs text-muted-foreground">Configure interventions</p>
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center space-y-1.5">
            <Pill className="w-6 h-6 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Select a network first</p>
          </div>

          {/* Show available networks even when none is selected */}
          {networks && networks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Network</p>
              <Select
                value=""
                onValueChange={(networkId) => {
                  selectNetwork(networkId);
                  setActiveTab('therapeutics');
                }}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Choose a network..." />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((net) => (
                    <SelectItem key={net.id} value={net.id}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {net.data?.nodes?.length || 0}
                        </Badge>
                        {net.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <Pill className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Therapeutics</h2>
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
              {selectedNetwork.name || 'Network'}
            </p>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Network Selector */}
        {networks && networks.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Network</p>
            <Select
              value={selectedNetworkId || ""}
              onValueChange={(networkId) => {
                selectNetwork(networkId);
              }}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="Choose a network..." />
              </SelectTrigger>
              <SelectContent>
                {networks.map((net) => (
                  <SelectItem key={net.id} value={net.id}>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {net.data?.nodes?.length || 0}
                      </Badge>
                      <span className="truncate">{net.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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

        <Separator className="bg-border/50" />

        {/* Analysis Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Run Analysis</p>
            {hasAnalysisResult && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Ready</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            {interventionCount} intervention{interventionCount !== 1 ? 's' : ''} applied
          </p>

          <div className="space-y-1.5">
            {/* Rule-Based Analysis */}
            <Button
              onClick={handleTherapeuticsRuleBased}
              variant="outline"
              className="w-full justify-start h-8 text-xs gap-1.5"
              disabled={isTherapeuticsRuleBasedRunning || !hasRules}
              title={!hasRules ? 'No rules defined for this network' : undefined}
            >
              {isTherapeuticsRuleBasedRunning ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                  Running...
                </span>
              ) : (
                <>
                  <FileText className="w-3 h-3" />
                  Rule-Based DA
                </>
              )}
            </Button>

            {/* Weighted Analysis */}
            <Button
              onClick={handleTherapeuticsWeighted}
              variant="outline"
              className="w-full justify-start h-8 text-xs gap-1.5"
              disabled={isTherapeuticsWeightedRunning || ((selectedNetwork?.data?.metadata?.type === 'Rule Based') || (Array.isArray(selectedNetwork?.data?.rules) && selectedNetwork?.data?.rules.length > 0))}
              title={((selectedNetwork?.data?.metadata?.type === 'Rule Based') || (Array.isArray(selectedNetwork?.data?.rules) && selectedNetwork?.data?.rules.length > 0)) ? 'Weighted analysis disabled for rule-based networks' : undefined}
            >
              {isTherapeuticsWeightedRunning ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                  Running...
                </span>
              ) : (
                <>
                  <BarChart3 className="w-3 h-3" />
                  Weighted DA
                </>
              )}
            </Button>

            {/* Probabilistic Analysis */}
            <Button
              onClick={handleOpenTherapeuticsProbabilisticDialog}
              variant="outline"
              className="w-full justify-start h-8 text-xs gap-1.5"
              disabled={isTherapeuticsProbabilisticRunning}
            >
              {isTherapeuticsProbabilisticRunning ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                  Running...
                </span>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Probabilistic Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }, [selectedNetworkId, selectedNetwork, networks, selectNetwork, setActiveTab, refreshNetworks, liveInterventions, therapeuticsWeightedResult, therapeuticsProbabilisticResult, therapeuticsRuleBasedResult, isTherapeuticsWeightedRunning, isTherapeuticsProbabilisticRunning, isTherapeuticsRuleBasedRunning, handleTherapeuticsWeighted, handleTherapeuticsRuleBased]);

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
            {/* Compact Header - Clean without view toggle (moved to sidebar) */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold truncate max-w-[250px]">
                  {selectedNetwork?.name ?? 'No Network Selected'}
                </span>
                {selectedNetwork?.data && (
                  <>
                    <Badge 
                      variant={selectedIsRuleBased ? "default" : "secondary"} 
                      className="text-xs px-2 py-0.5"
                    >
                      {selectedIsRuleBased ? 'Rule-based' : 'Weight-based'}
                    </Badge>
                    <div className="hidden sm:flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                        {selectedNetwork.data.nodes?.length ?? 0} nodes
                      </Badge>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                        {selectedNetwork.data.edges?.length ?? 0} edges
                      </Badge>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedNetworkId && networkSubTab === 'editor' && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => networkGraphRef.current?.updateCurrent()}
                    >
                      Save
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Full-height Content */}
            <div className="flex-1 min-h-0 flex flex-col">
              {networkSubTab === 'editor' && (
                <>
                  {!selectedNetworkId ? (
                    <div className="flex-1 flex items-center justify-center text-xl font-bold text-foreground">
                      Link a network to this project to get started.
                    </div>
                  ) : (
                    <NetworkGraph 
                      ref={networkGraphRef}
                      networkId={selectedNetworkId} 
                      projectId={projectId} 
                      refreshToken={networkGraphRefreshToken}
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
                      // Bump refresh token to ensure NetworkGraph refetches fresh data after save
                      setNetworkGraphRefreshToken(prev => prev + 1);
                      // Also refresh the networks hook to ensure data consistency
                      refreshNetworks();
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
        const hasAnyResult = ruleBasedResult || weightedResult || probabilisticResult;
        return (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="p-4 space-y-4 max-w-6xl pb-8">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedNetwork?.name && (
                    <span className="text-sm font-medium truncate max-w-[240px]" title={selectedNetwork.name}>{selectedNetwork.name}</span>
                  )}
                  {selectedNetwork?.data && (
                    <div className="flex gap-1.5">
                      <Badge variant="secondary" className="text-xs">{selectedNetwork.data.nodes?.length ?? 0} nodes</Badge>
                      <Badge variant="secondary" className="text-xs">{selectedNetwork.data.edges?.length ?? 0} edges</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {!selectedNetworkId && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No network selected. Select one from the sidebar.
                </div>
              )}
              {selectedNetworkId && !selectedNetwork?.data?.nodes?.length && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Network has no nodes.
                </div>
              )}
              {ruleBasedNodeLimitWarning && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {ruleBasedNodeLimitWarning}
                </div>
              )}

              {/* Loading States */}
              {isRuleBasedRunning && <div className="text-xs text-muted-foreground">Analyzing rules…</div>}
              {isWeightedAnalyzing && <div className="text-xs text-muted-foreground">Running weighted analysis…</div>}
              {isProbabilisticAnalyzing && <div className="text-xs text-muted-foreground">Running probabilistic analysis…</div>}

              {/* Errors */}
              {ruleBasedError && <div className="text-xs text-red-600 rounded bg-red-50 px-3 py-2">{ruleBasedError}</div>}
              {weightedError && <div className="text-xs text-red-600 rounded bg-red-50 px-3 py-2">{weightedError}</div>}
              {probabilisticError && <div className="text-xs text-red-600 rounded bg-red-50 px-3 py-2">{probabilisticError}</div>}

              {/* No Results State */}
              {!hasAnyResult && !isRuleBasedRunning && !isWeightedAnalyzing && !isProbabilisticAnalyzing && selectedNetworkId && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Run an analysis from the sidebar to see results here.
                </div>
              )}

              {/* Weighted Deterministic Results */}
              {weightedResult && !isWeightedAnalyzing && (
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                    <span className="text-xs font-semibold uppercase tracking-wide">Weighted Deterministic</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{weightedResult.nodeOrder.length} nodes</span>
                      <span>{weightedResult.exploredStateCount.toLocaleString()} states</span>
                      <span>{weightedResult.attractors.length} attractors</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {weightedResult.warnings.length > 0 && (
                      <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                        {weightedResult.warnings.map((w: string, i: number) => <span key={i} className="block">• {w}</span>)}
                      </div>
                    )}
                    {weightedResult.attractors.length > 0 && (
                      <Button
                        className="h-9 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-medium shadow-md"
                        onClick={() => {
                          setAttractorLandscapeData(weightedResult.attractors);
                          setAttractorLandscapeOpen(true);
                        }}
                      >
                        View Attractor Landscape
                      </Button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {weightedResult.attractors.map((attr: DeterministicAttractor) => (
                        <div key={attr.id} className="border rounded bg-background/50">
                          <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-muted/20">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">Attractor #{attr.id + 1}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{attr.type}</Badge>
                              {cellFates[String(attr.id)] && (
                                <AttractorFateBadge fate={cellFates[String(attr.id)]} onEdit={() => handleOpenFateDialog(attr.id)} />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">P:{attr.period} B:{(attr.basinShare*100).toFixed(0)}%</span>
                              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => handleOpenFateDialog(attr.id)}>
                                {cellFates[String(attr.id)] ? 'Edit' : 'Classify'}
                              </Button>
                            </div>
                          </div>
                          <div>
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="bg-muted/30">
                                  <th className="px-1.5 py-1 font-medium text-left">Node</th>
                                  {attr.states.map((_: StateSnapshot, si: number) => (
                                    <th key={si} className="px-1.5 py-1 font-medium text-center">S{si + 1}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {weightedResult.nodeOrder.map((n: string) => (
                                  <tr key={n} className="border-t border-muted/50">
                                    <td className="px-1.5 py-0.5 font-medium whitespace-nowrap">{weightedResult.nodeLabels[n]}</td>
                                    {attr.states.map((s: StateSnapshot, si: number) => (
                                      <td key={si} className={`px-1.5 py-0.5 text-center ${s.values[n] === 1 ? 'bg-primary/10 font-medium' : ''}`}>{s.values[n]}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Rule-Based Results */}
              {ruleBasedResult && (
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                    <span className="text-xs font-semibold uppercase tracking-wide">Rule-Based Deterministic</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{ruleBasedResult.nodeOrder.length} nodes</span>
                      <span>{ruleBasedResult.exploredStateCount.toLocaleString()} states</span>
                      <span>{ruleBasedResult.attractors.length} attractors</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {ruleBasedResult.attractors.length > 0 && (
                      <Button
                        className="h-9 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-medium shadow-md"
                        onClick={() => {
                          setAttractorLandscapeData(ruleBasedResult.attractors);
                          setAttractorLandscapeOpen(true);
                        }}
                      >
                        View Attractor Landscape
                      </Button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {ruleBasedResult.attractors.map((attr: DeterministicAttractor) => (
                        <div key={attr.id} className="border rounded bg-background/50">
                          <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-muted/20">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">Attractor #{attr.id + 1}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{attr.type}</Badge>
                              {cellFates[String(attr.id)] && (
                                <AttractorFateBadge fate={cellFates[String(attr.id)]} onEdit={() => handleOpenFateDialog(attr.id)} />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">P:{attr.period} B:{(attr.basinShare*100).toFixed(0)}%</span>
                              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => handleOpenFateDialog(attr.id)}>
                                {cellFates[String(attr.id)] ? 'Edit' : 'Classify'}
                              </Button>
                            </div>
                          </div>
                          <div>
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="bg-muted/30">
                                  <th className="px-1.5 py-1 font-medium text-left">Node</th>
                                  {attr.states.map((_: any, si: number) => (
                                    <th key={si} className="px-1.5 py-1 font-medium text-center">S{si + 1}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {ruleBasedResult.nodeOrder.map((n: string) => (
                                  <tr key={n} className="border-t border-muted/50">
                                    <td className="px-1.5 py-0.5 font-medium whitespace-nowrap">{ruleBasedResult.nodeLabels[n]}</td>
                                    {attr.states.map((s: any, si: number) => (
                                      <td key={si} className={`px-1.5 py-0.5 text-center ${s.values[n] === 1 ? 'bg-primary/10 font-medium' : ''}`}>{s.values[n]}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Probabilistic Results */}
              {probabilisticResult && !isProbabilisticAnalyzing && (
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-purple-50/50 dark:bg-purple-950/30">
                    <span className="text-xs font-semibold uppercase tracking-wide">Probabilistic</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{probabilisticResult.nodeOrder.length} nodes</span>
                      <span>{probabilisticResult.converged ? 'Converged' : 'Not converged'}</span>
                      <span>{probabilisticResult.iterations} iter</span>
                      <span>{(Object.values(probabilisticResult.probabilities).reduce((a, b) => a + b, 0) / probabilisticResult.nodeOrder.length * 100).toFixed(0)}% avg</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        className="h-9 px-4 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white text-sm font-medium shadow-md"
                        onClick={() => {
                          setLandscapeProbabilisticData({
                            nodeOrder: probabilisticResult.nodeOrder,
                            probabilities: probabilisticResult.probabilities,
                            potentialEnergies: probabilisticResult.potentialEnergies,
                          });
                          setProbabilityLandscapeOpen(true);
                        }}
                      >
                        View Probability Landscape
                      </Button>
                      {Object.keys(probabilisticResult.potentialEnergies).length > 0 && (
                        <Button
                          className="h-9 px-4 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white text-sm font-medium shadow-md"
                          onClick={() => {
                            setLandscapeProbabilisticData({
                              nodeOrder: probabilisticResult.nodeOrder,
                              probabilities: probabilisticResult.probabilities,
                              potentialEnergies: probabilisticResult.potentialEnergies,
                            });
                            setEnergyLandscapeOpen(true);
                          }}
                        >
                          View Energy Landscape
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="h-9 px-4 text-sm border-purple-300 hover:bg-purple-100"
                        onClick={() => setShowProbabilityTables(!showProbabilityTables)}
                      >
                        {showProbabilityTables ? 'Hide' : 'Show'} Tables
                      </Button>
                    </div>

                    {showProbabilityTables && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="border rounded bg-background/50 overflow-hidden">
                          <div className="px-2.5 py-1.5 bg-muted/30 text-xs font-medium">Node Probabilities</div>
                          <div>
                            <table className="w-full text-[10px]">
                              <tbody>
                                {probabilisticResult.nodeOrder.map((nodeId: string) => (
                                  <tr key={nodeId} className="border-t border-muted/50">
                                    <td className="px-2 py-0.5">{nodeIdToLabel[nodeId] || nodeId}</td>
                                    <td className="px-2 py-0.5 text-right font-mono">{(probabilisticResult.probabilities[nodeId] * 100).toFixed(1)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {Object.keys(probabilisticResult.potentialEnergies).length > 0 && (
                          <div className="border rounded bg-background/50 overflow-hidden">
                            <div className="px-2.5 py-1.5 bg-muted/30 text-xs font-medium">Potential Energies</div>
                            <div>
                              <table className="w-full text-[10px]">
                                <tbody>
                                  {probabilisticResult.nodeOrder.map((nodeId: string) => (
                                    <tr key={nodeId} className="border-t border-muted/50">
                                      <td className="px-2 py-0.5">{nodeIdToLabel[nodeId] || nodeId}</td>
                                      <td className="px-2 py-0.5 text-right font-mono">{probabilisticResult.potentialEnergies[nodeId]?.toFixed(3) ?? 'N/A'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {probabilisticResult.warnings.length > 0 && (
                      <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                        {probabilisticResult.warnings.map((w: string, i: number) => <span key={i} className="block">• {w}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'rna-seq':
        return (
          <SeqAnalysisTab
            networkNodes={selectedNetwork?.data?.nodes || []}
            networks={networks}
            onNetworkSelect={selectNetwork}
            selectedNetworkId={selectedNetworkId}
            projectId={projectId}
            networkId={selectedNetworkId}
            networkName={selectedNetwork?.name}
          />
        );

      case 'exome-seq':
        return (
          <ExomeSeqTab
            networkNodes={selectedNetwork?.data?.nodes || []}
            networks={networks}
            onNetworkSelect={selectNetwork}
            selectedNetworkId={selectedNetworkId}
            projectId={projectId}
            networkId={selectedNetworkId}
            networkName={selectedNetwork?.name}
          />
        );

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
              <div className="flex items-center gap-3">
                <Tabs value={therapeuticsSubTab} onValueChange={(v) => setTherapeuticsSubTab(v as 'preview' | 'attractors' | 'landscape' | 'comparison')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="preview" className="text-xs px-3 h-7">
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="attractors" className="text-xs px-3 h-7" disabled={!hasAttractorResults}>
                      Attractors
                      {hasAttractorResults && (
                        <Badge variant="secondary" className="ml-1.5 text-xs px-1 py-0 h-4">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPatientDrugScoresDialogOpen(true)}
                  className="text-xs h-7"
                >
                  Patient Drug Scores
                </Button>
              </div>
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
                <div className="h-full border rounded-lg bg-card">
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
                              <div className="text-xs text-muted-foreground mb-1">States:</div>
                              <div className="flex flex-wrap gap-1">
                                {attractor.states.map((state, stateIdx) => (
                                  <code key={stateIdx} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
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
                      {/* Landscape Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="h-9 px-4 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white text-sm font-medium shadow-md"
                          onClick={() => {
                            if (therapeuticsProbabilisticResult) {
                              setLandscapeProbabilisticData({
                                nodeOrder: therapeuticsProbabilisticResult.nodeOrder,
                                probabilities: therapeuticsProbabilisticResult.probabilities,
                                potentialEnergies: therapeuticsProbabilisticResult.potentialEnergies,
                              });
                              setProbabilityLandscapeOpen(true);
                            }
                          }}
                        >
                          View Probability Landscape
                        </Button>
                        {therapeuticsProbabilisticResult && Object.keys(therapeuticsProbabilisticResult.potentialEnergies).length > 0 && (
                          <Button
                            className="h-9 px-4 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white text-sm font-medium shadow-md"
                            onClick={() => {
                              setLandscapeProbabilisticData({
                                nodeOrder: therapeuticsProbabilisticResult.nodeOrder,
                                probabilities: therapeuticsProbabilisticResult.probabilities,
                                potentialEnergies: therapeuticsProbabilisticResult.potentialEnergies,
                              });
                              setEnergyLandscapeOpen(true);
                            }}
                          >
                            View Energy Landscape
                          </Button>
                        )}
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
                                  <td className="p-2">{nodeIdToLabel[nodeId] || nodeId}</td>
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
                          <div className="text-xs uppercase text-muted-foreground mb-1">Original Attractors</div>
                          <div className="text-xl font-bold">{comparisonData.originalAttractorCount}</div>
                        </div>
                        <div className="border rounded-lg p-3 bg-card">
                          <div className="text-xs uppercase text-muted-foreground mb-1">Modified Attractors</div>
                          <div className="text-xl font-bold">{comparisonData.modifiedAttractorCount}</div>
                        </div>
                        <div className="border rounded-lg p-3 bg-card">
                          <div className="text-xs uppercase text-muted-foreground mb-1">Eliminated</div>
                          <div className="text-xl font-bold text-red-600">{comparisonData.eliminatedAttractors.length}</div>
                        </div>
                        <div className="border rounded-lg p-3 bg-card">
                          <div className="text-xs uppercase text-muted-foreground mb-1">New</div>
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
                                    <code key={stateIdx} className="text-xs bg-red-100 px-1.5 py-0.5 rounded font-mono">
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
                                    <code key={stateIdx} className="text-xs bg-green-100 px-1.5 py-0.5 rounded font-mono">
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
                                    <code key={stateIdx} className="text-xs bg-blue-100 px-1.5 py-0.5 rounded font-mono">
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
                  )}                </div>
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

      case 'autonetcan':
        return (
          <div className="flex-1 w-full min-h-0 flex flex-col overflow-hidden">
            {/* Iframe container */}
            <div className="flex-1 w-full min-h-0 overflow-hidden">
              <iframe
                src="https://autonetcan.lums.edu.pk/createNetwork"
                className="w-full h-full border-0"
                title="AutoNetCan - Automated Network Construction"
                allow="clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => {}}
                onError={() => {}}
              />
            </div>
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
      inferenceSidebar={inferenceSidebarContent}
      therapeuticsSidebar={therapeuticsSidebarContent}
      seqAnalysisSidebar={seqAnalysisSidebarContent}
      disableAfterTherapeutics
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
              Provide a name and choose a network type.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Network Name */}
            <div className="space-y-2">
              <Label htmlFor="new-network-name">Network Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
              />
            </div>

            {/* Network Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Network Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewNetworkType('weights')}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    newNetworkType === 'weights'
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      newNetworkType === 'weights' ? "border-primary" : "border-muted-foreground/50"
                    )}>
                      {newNetworkType === 'weights' && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="font-semibold text-sm">Weight-based</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Define edge weights for weighted deterministic analysis
                  </p>
                </button>
                
                <button
                  type="button"
                  onClick={() => setNewNetworkType('rules')}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    newNetworkType === 'rules'
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      newNetworkType === 'rules' ? "border-primary" : "border-muted-foreground/50"
                    )}>
                      {newNetworkType === 'rules' && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="font-semibold text-sm">Rule-based</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Define Boolean rules (AND, OR, NOT) for rule-based analysis
                  </p>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewNetworkDialogOpen(false)} disabled={isCreatingNetwork}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewNetwork} disabled={isCreatingNetwork}>
              {isCreatingNetwork ? 'Creating...' : `Create ${newNetworkType === 'rules' ? 'Rule-based' : 'Weight-based'} Network`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Network Format Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Network</DialogTitle>
            <DialogDescription>
              Choose format(s) for exporting "{selectedNetwork?.name || 'network'}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              {SUPPORTED_EXPORT_FORMATS.map((format) => {
                const isSelected = selectedExportFormats.includes(format.id);
                return (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => {
                      setSelectedExportFormats(prev => 
                        isSelected 
                          ? prev.filter(f => f !== format.id)
                          : [...prev, format.id]
                      );
                    }}
                    className={cn(
                      "w-full p-3 rounded-lg border-2 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center",
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground/50"
                        )}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{format.label}</div>
                          <div className="text-xs text-muted-foreground">{format.description}</div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">{format.extension}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Prefer live data from the graph (includes current positions), fall back to saved data
                const liveData = networkGraphRef.current?.getLiveNetworkData();
                const exportData = liveData || selectedNetwork?.data;
                
                // Debug: log what we're exporting
                console.log('[Export] liveData:', liveData);
                console.log('[Export] selectedNetwork?.data:', selectedNetwork?.data);
                console.log('[Export] exportData:', exportData);
                console.log('[Export] nodes:', exportData?.nodes?.length, 'edges:', exportData?.edges?.length);
                
                if (exportData && (exportData.nodes?.length > 0 || exportData.edges?.length > 0)) {
                  // Export to all selected formats
                  selectedExportFormats.forEach(format => {
                    exportAndDownloadNetworkAs(
                      exportData as NetworkData, 
                      selectedNetwork?.name || 'network',
                      format
                    );
                  });
                  setIsExportDialogOpen(false);
                  showToast({
                    title: 'Network Exported',
                    description: `Exported as ${selectedExportFormats.map(f => SUPPORTED_EXPORT_FORMATS.find(fmt => fmt.id === f)?.extension || f).join(', ')}`,
                  });
                } else {
                  showToast({
                    title: 'Export Failed',
                    description: 'No network data available to export. Make sure you are on the Editor tab.',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={selectedExportFormats.length === 0}
            >
              Export {selectedExportFormats.length > 1 ? `(${selectedExportFormats.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Network Dialog */}
      <MergeNetworkDialog
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        networks={networks.map(n => ({ id: n.id, name: n.name, data: n.data })) as NetworkOption[]}
        selectedNetworkId={selectedNetworkId}
        onMerge={handleSaveMergedNetwork}
      />

      {/* Case Study Dialog */}
      <CaseStudyDialog
        open={isCaseStudyDialogOpen}
        onOpenChange={setIsCaseStudyDialogOpen}
        onSelect={handleLoadCaseStudy}
      />

      {/* Delete Network Confirmation Dialog */}
      <Dialog open={!!networkToDelete} onOpenChange={(open) => { if (!open) setNetworkToDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Network</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{networkToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setNetworkToDelete(null)}
              disabled={isDeletingNetwork}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteNetwork}
              disabled={isDeletingNetwork}
            >
              {isDeletingNetwork ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Network Dialog - Two-step flow */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Network</DialogTitle>
            <DialogDescription>
              {importStep === 'type' 
                ? 'Choose the type of network you want to import.'
                : 'Upload a network file: CSV, TXT, SIF, or SBML-qual'}
            </DialogDescription>
          </DialogHeader>

          {importStep === 'type' ? (
            <>
              {/* Step 1: Network Type Selection */}
              <div className="space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Network Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setImportNetworkType('weights')}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        importNetworkType === 'weights'
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                          importNetworkType === 'weights' ? "border-primary" : "border-muted-foreground/50"
                        )}>
                          {importNetworkType === 'weights' && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="font-semibold text-sm">Weight-based</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Import networks with edge weights for weighted deterministic analysis
                      </p>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setImportNetworkType('rules')}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        importNetworkType === 'rules'
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                          importNetworkType === 'rules' ? "border-primary" : "border-muted-foreground/50"
                        )}>
                          {importNetworkType === 'rules' && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="font-semibold text-sm">Rule-based</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Import networks with Boolean rules (AND, OR, NOT)
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setImportStep('upload')}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Step 2: File Upload */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Badge variant="outline">
                    {importNetworkType === 'rules' ? 'Rule-based' : 'Weight-based'}
                  </Badge>
                  <button 
                    className="text-primary text-xs hover:underline"
                    onClick={() => setImportStep('type')}
                  >
                    Change type
                  </button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="import-name">Network name</Label>
                  <Input id="import-name" value={importNetworkName} onChange={(e) => setImportNetworkName(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Network File (CSV or TXT)</Label>
                  <Input 
                    type="file" 
                    accept=".csv,.txt,text/csv,text/plain" 
                    onChange={(e) => onPickNetworkFile(e.target.files?.[0])} 
                  />
                  {networkFileName && (
                    <div className="text-xs text-muted-foreground">
                      Selected: {networkFileName}
                    </div>
                  )}
                </div>

                {importNetworkType === 'rules' && (
                  <div className="space-y-2 border-t pt-4">
                    <Label className="text-muted-foreground">Or upload separate Rules file (optional)</Label>
                    <Input type="file" accept="text/plain,.txt" onChange={(e) => onPickRulesFile(e.target.files?.[0])} />
                    <div className="flex items-center gap-2 pt-1">
                      <Button type="button" variant="outline" size="sm" onClick={onInferRules} disabled={isInferring || !importedNetwork}>
                        {isInferring ? 'Inferring…' : 'Infer Rules from AI'}
                      </Button>
                      {Array.isArray(importedRules) && (
                        <span className="text-xs text-muted-foreground">{importedRules.length} rules loaded</span>
                      )}
                    </div>
                  </div>
                )}

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
                    {importNetworkType === 'rules' && (
                      <div>Rules: {Array.isArray(importedRules) ? importedRules.length : (Array.isArray(importedNetwork.rules) ? importedNetwork.rules!.length : 0)}</div>
                    )}
                    <div>Type: {importNetworkType === 'rules' ? 'Rule Based' : 'Weight Based'}</div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep('type')}>
                  Back
                </Button>
                <Button onClick={onSaveImportedNetwork} disabled={!(importedNetwork || Array.isArray(importedRules)) || isSavingImport}>
                  {isSavingImport ? 'Saving…' : 'Save & Link'}
                </Button>
              </DialogFooter>
            </>
          )}
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

      {/* Attractor Landscape Full-Screen Dialog */}
      <Dialog open={attractorLandscapeOpen} onOpenChange={setAttractorLandscapeOpen}>
        <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle>Attractor Landscape</DialogTitle>
            <DialogDescription>
              3D visualization of the attractor landscape. Valleys represent stable attractors (deeper = larger basin), peaks represent transient states.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4" style={{ height: 'calc(100vh - 80px)' }}>
            {attractorLandscapeData && attractorLandscapeData.length > 0 && (
              <AttractorLandscape attractors={attractorLandscapeData} mappingType="naive-grid" className="h-full" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Probability Landscape Full-Screen Dialog */}
      <Dialog open={probabilityLandscapeOpen} onOpenChange={setProbabilityLandscapeOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle>Probability Landscape</DialogTitle>
            <DialogDescription>
              3D visualization of steady-state probabilities. Peaks represent high-probability states that the system is most likely to occupy.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4" style={{ height: 'calc(90vh - 80px)' }}>
            {landscapeProbabilisticData && (
              <ProbabilisticLandscape
                nodeOrder={landscapeProbabilisticData.nodeOrder}
                probabilities={landscapeProbabilisticData.probabilities}
                potentialEnergies={landscapeProbabilisticData.potentialEnergies}
                type="probability"
                mappingType="naive-grid"
                nodeIdToLabel={nodeIdToLabel}
                className="h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Potential Energy Landscape Full-Screen Dialog */}
      <Dialog open={energyLandscapeOpen} onOpenChange={setEnergyLandscapeOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle>Potential Energy Landscape</DialogTitle>
            <DialogDescription>
              3D visualization of potential energy (−ln P). Valleys represent stable states (low energy) where the system tends to settle; peaks represent unstable states (high energy).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4" style={{ height: 'calc(90vh - 80px)' }}>
            {landscapeProbabilisticData && (
              <ProbabilisticLandscape
                nodeOrder={landscapeProbabilisticData.nodeOrder}
                probabilities={landscapeProbabilisticData.probabilities}
                potentialEnergies={landscapeProbabilisticData.potentialEnergies}
                type="energy"
                mappingType="naive-grid"
                nodeIdToLabel={nodeIdToLabel}
                className="h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Drug Scores Dialog */}
      <PatientDrugScoresDialog
        open={patientDrugScoresDialogOpen}
        onOpenChange={setPatientDrugScoresDialogOpen}
      />
    </NetworkEditorLayout>
  );
}

export default React.memo(ProjectVisualizationPage);