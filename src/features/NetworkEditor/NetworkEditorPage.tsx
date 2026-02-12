import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import NetworkEditorLayout from './layout';
import type { NetworkEditorLayoutProps, TabType } from './layout';
import ProjectTabComponent from './tabs/ProjectTab';
import SeqAnalysisTab from './tabs/SeqAnalysisTab';
import ExomeSeqTab from './tabs/ExomeSeqTab';

import NetworkGraph, { type NetworkGraphHandle } from './NetworkGraph';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
// Using native textarea (no shadcn textarea present)
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, BarChart3 } from 'lucide-react';
// analysis node type is internal to the hook now
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';
import { useProbabilisticAnalysis } from '@/hooks/useProbabilisticAnalysis';
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import type { AnalysisEdge, AnalysisNode, ProbabilisticAnalysisOptions, WeightedAnalysisOptions } from '@/lib/analysis/types';
import { useProjectNetworks, type ProjectNetworkRecord } from '@/hooks/useProjectNetworks';

import AttractorLandscape from './AttractorLandscape';
import ProbabilisticLandscape from './ProbabilisticLandscape';
import { TherapeuticsPanel } from './TherapeuticsPanel';

// network type unified via hook's ProjectNetworkRecord
// Last updated: 2025-12-05 - Added weighted analysis support

function NetworkEditorPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  // networks managed via hook now
  const [rulesText, setRulesText] = useState('');
  // analysis managed via hook

  // use shared hook for project networks
  const { networks, selectedNetworkId, selectedNetwork, isLoading: isLoadingNetworks, error: networksError, selectNetwork, refresh: refreshNetworks } = useProjectNetworks({ projectId: selectedProjectId });

  const selectedIsRuleBased = useMemo(() => {
    try {
      const data = (selectedNetwork as any)?.data || selectedNetwork;
      const rules = Array.isArray(data?.rules) ? data.rules : [];
      const metaType = data?.metadata?.type;
      return (Array.isArray(rules) && rules.length > 0) || metaType === 'Rule based';
    } catch {
      return false;
    }
  }, [selectedNetwork]);

  const {
    result: weightedResult,
    isRunning: isWeightedAnalyzing,
    run: runWeightedAnalysis,
  } = useWeightedAnalysis();
  const {
    result: probabilisticResult,
    isRunning: isProbabilisticAnalyzing,
    error: probabilisticError,
    run: runProbabilisticAnalysis,
    reset: resetProbabilisticAnalysis,
  } = useProbabilisticAnalysis();
  const {
    result: deterministicResult,
    isRunning: _isDeterministicAnalyzing,
    error: deterministicError,
    downloadResults: _downloadDeterministicResults,
  } = useDeterministicAnalysis();

  // Log deterministic state for debugging
  useEffect(() => {
    if (deterministicResult || deterministicError) {
      // Deterministic analysis state available
    }
  }, [deterministicResult, deterministicError]);

  // Stub values for removed deterministic analysis
  const inferredNodes: any[] = [];
  const isAnalyzing = false;
  const analysisResult: any = null;  // Type as any to avoid type errors in disabled UI
  const analysisError: any = null;
  const downloadResults = () => {};
  const clear = () => {};
  const handleRunAnalysis = () => {};
  const handleRunDeterministic = () => {};
  
  // Weighted Analysis Dialog State
  const [isWeightedDialogOpen, setIsWeightedDialogOpen] = useState(false);
  const [weightedForm, setWeightedForm] = useState({
    thresholdMultiplier: '0',
    tieBehavior: 'hold' as 'hold' | 'zero-as-zero' | 'zero-as-one',
    mappingType: 'naive-grid' as 'sammon' | 'naive-grid',
  });
  const [weightedFormError, setWeightedFormError] = useState<string | null>(null);
  
  const [isProbabilisticDialogOpen, setIsProbabilisticDialogOpen] = useState(false);
  const [probabilisticForm, setProbabilisticForm] = useState({
    noise: '0.25',
    selfDegradation: '0.1',
    maxIterations: '500',
    tolerance: '1e-4',
    initialProbability: '0.5',
    mappingType: 'naive-grid' as 'sammon' | 'naive-grid',
  });
  const [probabilisticFormError, setProbabilisticFormError] = useState<string | null>(null);
  
  // Landscape dialog states
  const [attractorLandscapeOpen, setAttractorLandscapeOpen] = useState(false);
  const [attractorLandscapeData, setAttractorLandscapeData] = useState<any[] | null>(null);
  const [probabilityLandscapeOpen, setProbabilityLandscapeOpen] = useState(false);
  const [energyLandscapeOpen, setEnergyLandscapeOpen] = useState(false);
  const [showProbabilityTables, setShowProbabilityTables] = useState(false);
  const probabilisticEntries = useMemo(() => {
    if (!probabilisticResult) return [] as Array<[string, number]>;
    return Object.entries(probabilisticResult.probabilities).sort(([, a], [, b]) => b - a);
  }, [probabilisticResult]);
  const probabilisticAverageProbability = useMemo(() => {
    if (!probabilisticResult) return 0;
    const values = Object.values(probabilisticResult.probabilities);
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [probabilisticResult]);
  const probabilisticMinProbability = useMemo(() => {
    if (!probabilisticResult) return 0;
    const values = Object.values(probabilisticResult.probabilities);
    if (!values.length) return 0;
    return Math.min(...values);
  }, [probabilisticResult]);
  const probabilisticMaxPotentialEnergy = useMemo(() => {
    if (!probabilisticResult) return 0;
    const values = Object.values(probabilisticResult.potentialEnergies);
    if (!values.length) return 0;
    return Math.max(...values);
  }, [probabilisticResult]);
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
  const graphRef = useRef<NetworkGraphHandle | null>(null);
  const normalizeNodesEdges = (payload: any): { nodes: AnalysisNode[]; edges: AnalysisEdge[]; options: WeightedAnalysisOptions; metadata: Record<string, any> } => {
    const nodes: AnalysisNode[] = (Array.isArray(payload?.nodes) ? payload.nodes : []).map((n: any) => ({
      id: String(n.id),
      label: String(n.label || n.id),
    }));
    const edges: AnalysisEdge[] = (Array.isArray(payload?.edges) ? payload.edges : []).map((e: any) => ({
      source: String(e.source),
      target: String(e.target),
      weight: Number(e.weight ?? 1),
    }));
    const biasesEntries = Array.isArray(payload?.nodes)
      ? payload.nodes.map((n: any) => [String(n.id), Number(n.properties?.bias ?? 0)])
      : [];
    const biases = Object.fromEntries(biasesEntries);
    const metadata = (payload && typeof payload.metadata === 'object' && payload.metadata !== null) ? payload.metadata : {};
    const thresholdCandidate = typeof payload?.thresholdMultiplier === 'number'
      ? payload.thresholdMultiplier
      : metadata.thresholdMultiplier;
    const options: WeightedAnalysisOptions = {
      tieBehavior: 'hold',
      thresholdMultiplier: typeof thresholdCandidate === 'number' ? thresholdCandidate : 0,
      biases,
    };
    return { nodes, edges, options, metadata };
  };

  // Open weighted analysis dialog
  const handleOpenWeightedDialog = () => {
    setWeightedFormError(null);
    setIsWeightedDialogOpen(true);
  };

  // Execute weighted analysis after dialog submission
  const handleWeightedSubmit = async () => {
    const thresholdMultiplier = Number(weightedForm.thresholdMultiplier);
    if (!Number.isFinite(thresholdMultiplier) || thresholdMultiplier < 0 || thresholdMultiplier > 1) {
      setWeightedFormError('Threshold multiplier must be between 0 and 1.');
      return;
    }
    
    setWeightedFormError(null);
    setIsWeightedDialogOpen(false);

    // Now run the actual analysis
    const live = graphRef.current?.getLiveWeightedConfig();
    if (live && live.nodes && live.nodes.length > 0) {
      const { nodes, edges, options } = normalizeNodesEdges(live);
      options.thresholdMultiplier = thresholdMultiplier;
      options.tieBehavior = weightedForm.tieBehavior;
      await runWeightedAnalysis(nodes, edges, options);
      return;
    }

    if (!selectedNetwork) {
      showToast({ 
        title: 'No Network Selected', 
        description: 'Please select a network first.',
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
        description: 'Please add nodes in the Network tab first.',
        variant: 'destructive'
      });
      return;
    }

    const { nodes, edges, options } = normalizeNodesEdges({
      nodes: networkNodes,
      edges: networkEdges,
      thresholdMultiplier: thresholdMultiplier,
      metadata: networkData?.metadata,
    });
    options.thresholdMultiplier = thresholdMultiplier;
    options.tieBehavior = weightedForm.tieBehavior;

    await runWeightedAnalysis(nodes, edges, options);
  };

  // Legacy handler that now opens the dialog
  const handleRunWeighted = async () => {
    // Open dialog instead of running directly
    handleOpenWeightedDialog();
  };

  const runProbabilisticWithParams = async (params: {
    noise: number;
    selfDegradation: number;
    maxIterations: number;
    tolerance: number;
    initialProbability: number;
  }) => {
    // Clear previous errors up front so the user sees fresh status
    setProbabilisticFormError(null);

    const toNumericMap = (source: any): Record<string, number> | undefined => {
      if (!source || typeof source !== 'object') return undefined;
      const numericEntries = Object.entries(source).reduce<Record<string, number>>((acc, [key, value]) => {
        const num = Number(value);
        if (Number.isFinite(num)) {
          acc[key] = num;
        }
        return acc;
      }, {});
      return Object.keys(numericEntries).length ? numericEntries : undefined;
    };

    const runWithPayload = async (payload: any) => {
      const { nodes, edges, options, metadata } = normalizeNodesEdges(payload);
      if (!nodes.length) {
        const message = 'No nodes found in the network. Please add nodes before running probabilistic analysis.';
        setProbabilisticFormError(message);
        return;
      }

      const probabilisticOptions: ProbabilisticAnalysisOptions = {
        noise: params.noise,
        selfDegradation: params.selfDegradation,
        maxIterations: params.maxIterations,
        tolerance: params.tolerance,
        initialProbability: params.initialProbability,
        biases: options.biases,
      };

      const metadataBasalSource = metadata && typeof metadata.basalActivity === 'object' && metadata.basalActivity !== null
        ? metadata.basalActivity
        : metadata?.probabilistic?.basalActivity;
      const basalActivity = toNumericMap(metadataBasalSource);
      if (basalActivity) {
        probabilisticOptions.basalActivity = basalActivity;
      }

      const metadataInitialSource = metadata && typeof metadata.initialProbabilities === 'object' && metadata.initialProbabilities !== null
        ? metadata.initialProbabilities
        : metadata?.probabilistic?.initialProbabilities;
      const initialProbabilities = toNumericMap(metadataInitialSource);
      if (initialProbabilities) {
        probabilisticOptions.initialProbabilities = initialProbabilities;
      }

      try {
        await runProbabilisticAnalysis(nodes, edges, probabilisticOptions);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Probabilistic analysis failed.';
        setProbabilisticFormError(message);
        throw err;
      }
    };

    resetProbabilisticAnalysis();

    const live = graphRef.current?.getLiveWeightedConfig();
    if (live && Array.isArray(live.nodes) && live.nodes.length > 0) {
      await runWithPayload(live);
      return;
    }

    if (!selectedNetwork) {
      setProbabilisticFormError('No network selected. Please select a network first.');
      return;
    }

    const networkData = (selectedNetwork as any).data || selectedNetwork;
    const networkNodes = networkData?.nodes || [];
    const networkEdges = networkData?.edges || [];

    if (!networkNodes.length) {
      setProbabilisticFormError('No nodes found in selected network. Please add nodes in the Network tab first.');
      return;
    }

    await runWithPayload({
      nodes: networkNodes,
      edges: networkEdges,
      thresholdMultiplier: networkData?.metadata?.thresholdMultiplier,
      metadata: networkData?.metadata,
    });
  };

  const handleOpenProbabilisticDialog = () => {
    setProbabilisticFormError(null);
    setIsProbabilisticDialogOpen(true);
  };

  const handleProbabilisticSubmit = async () => {
    const noise = Number(probabilisticForm.noise);
    if (!Number.isFinite(noise) || noise <= 0) {
      setProbabilisticFormError('Noise (µ) must be a positive number.');
      return;
    }

    const selfDegradation = Number(probabilisticForm.selfDegradation);
    if (!Number.isFinite(selfDegradation) || selfDegradation < 0 || selfDegradation > 1) {
      setProbabilisticFormError('Self-degradation (c) must be between 0 and 1.');
      return;
    }

    let maxIterations = Number(probabilisticForm.maxIterations);
    if (!Number.isFinite(maxIterations) || maxIterations < 1) {
      setProbabilisticFormError('Max iterations must be at least 1.');
      return;
    }
    maxIterations = Math.max(1, Math.floor(maxIterations));

    const tolerance = Number(probabilisticForm.tolerance);
    if (!Number.isFinite(tolerance) || tolerance <= 0) {
      setProbabilisticFormError('Tolerance must be a positive number.');
      return;
    }

    const initialProbability = Number(probabilisticForm.initialProbability);
    if (!Number.isFinite(initialProbability) || initialProbability < 0 || initialProbability > 1) {
      setProbabilisticFormError('Initial probability must be between 0 and 1.');
      return;
    }

    setProbabilisticFormError(null);
    // Don't close dialog yet - wait for the run to complete so we can show errors if needed

    try {
      await runProbabilisticWithParams({
        noise,
        selfDegradation,
        maxIterations,
        tolerance,
        initialProbability,
      });

      // Check if analysis completed successfully before closing
      // Wait a tick to let error state update
      setTimeout(() => {
        if (!probabilisticError && probabilisticResult) {
          setIsProbabilisticDialogOpen(false);
        }
      }, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Probabilistic analysis failed unexpectedly.';
      setProbabilisticFormError(message);
      console.error('[handleProbabilisticSubmit] Error:', err);
    }

    setProbabilisticForm({
      noise: String(noise),
      selfDegradation: String(selfDegradation),
      maxIterations: String(maxIterations),
      tolerance: String(tolerance),
      initialProbability: String(initialProbability),
      mappingType: probabilisticForm.mappingType,
    });
  };
  const handleDownloadResults = () => downloadResults();
  const handleClear = () => clear();

  const handleExample = () => {
    const example = [
      'A = A',
      'B = A AND !C',
      'C = B OR A'
    ].join('\n');
    setRulesText(example);
  };

  // Keyboard shortcuts for common actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd + Enter = Run Weighted Analysis (most common)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isWeightedAnalyzing && !selectedIsRuleBased) {
          handleRunWeighted();
        }
      }
      // Ctrl/Cmd + Shift + Enter = Run Probabilistic Analysis
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (!isProbabilisticAnalyzing) {
          handleOpenProbabilisticDialog();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWeightedAnalyzing, isProbabilisticAnalyzing, selectedIsRuleBased]);

  // No global window handlers; actions are provided via inferenceActions prop below

  // removed local fetch effect in favor of shared hook

  const renderNetworkSelector = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Select Network
      </label>
  <Select value={selectedNetworkId || ''} onValueChange={selectNetwork}>
        <SelectTrigger className="w-80">
          <SelectValue placeholder="Choose a network..." />
        </SelectTrigger>
        <SelectContent>
          {networks.map((network: ProjectNetworkRecord) => (
            <SelectItem key={network.id} value={network.id}>
              <div className="flex items-center justify-between w-full min-w-0">
                <span className="font-medium truncate">{network.name}</span>
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
      case 'rna-seq':
        return (
          <SeqAnalysisTab
            networkNodes={selectedNetwork?.data?.nodes || []}
            networks={networks}
            onNetworkSelect={selectNetwork}
            selectedNetworkId={selectedNetworkId}
            projectId={selectedProjectId}
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
            projectId={selectedProjectId}
            networkId={selectedNetworkId}
            networkName={selectedNetwork?.name}
          />
        );

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
                      <NetworkGraph ref={graphRef} networkId={selectedNetworkId} projectId={selectedProjectId} onSaved={(newNetwork) => {
                        // Refresh the network list to sync with Supabase
                        refreshNetworks();
                        selectNetwork(newNetwork.id);
                      }} />
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

      case 'therapeutics': {
        if (!selectedNetworkId) {
          return (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Select a network first to view therapeutics.
            </div>
          );
        }

        const networkData = selectedNetwork?.data;
        const nodes = networkData?.nodes || [];
        const therapies = selectedNetwork?.therapies;
        
        // Build rules map from network data
        const rulesMap: Record<string, string> = {};
        if (networkData?.rules) {
          networkData.rules.forEach((rule) => {
            if (rule.name && rule.action) {
              rulesMap[rule.name] = rule.action;
            }
          });
        }

        return (
          <div className="h-full p-6">
            <TherapeuticsPanel
              networkId={selectedNetworkId}
              nodes={nodes}
              rules={rulesMap}
              existingTherapies={therapies}
              onTherapiesUpdated={() => {
                refreshNetworks();
              }}
            />
          </div>
        );
      }

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
      case 'network-inference':
        return (
          <div className="h-full p-6 space-y-6">
            <div className="flex flex-col lg:flex-row gap-6 h-full">
              <Card className="flex-1">
                <CardContent className="p-6 space-y-4 h-full flex flex-col">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold">Deterministic Analysis</h2>
                    <p className="text-sm text-muted-foreground">Enter Boolean update rules (one per line, e.g. A = B AND !C)</p>
                  </div>
                  {selectedNetwork && (
                    <div className="text-xs text-muted-foreground">Using {inferredNodes.length} node(s) from {selectedNetwork.name}</div>
                  )}
                  {/* Progress indicators for running analyses */}
                  {(isAnalyzing || isWeightedAnalyzing || isProbabilisticAnalyzing) && (
                    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-primary">
                          {isAnalyzing && 'Running rule-based analysis…'}
                          {isWeightedAnalyzing && 'Running weighted analysis…'}
                          {isProbabilisticAnalyzing && 'Running probabilistic analysis…'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Exploring state space and detecting attractors. This may take a moment for larger networks.
                        </p>
                      </div>
                    </div>
                  )}
                  {!isAnalyzing && analysisResult && !analysisError && (
                    <Alert>
                      <AlertDescription>
                        Analysis complete. Found {analysisResult.attractors.length} attractor(s) · Explored {analysisResult.exploredStateCount} states.
                      </AlertDescription>
                    </Alert>
                  )}
                  {!isWeightedAnalyzing && weightedResult && (
                    <Alert>
                      <AlertDescription>
                        Weighted analysis complete. Found {weightedResult.attractors.length} attractor(s) · Explored {weightedResult.exploredStateCount} states.
                      </AlertDescription>
                    </Alert>
                  )}
                  <textarea
                    placeholder={"A = A\nB = A AND !C\nC = B OR A"}
                    className="font-mono text-sm h-48"
                    value={rulesText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRulesText(e.target.value)}
                  />
                  {/* Analysis Actions - Organized by Function */}
                  <div className="space-y-3">
                    {/* Primary Analysis Actions */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Run Analysis</p>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          onClick={handleRunAnalysis} 
                          disabled={isAnalyzing}
                          title="Run rule-based Boolean network analysis from the text above"
                        >
                          {isAnalyzing ? 'Analyzing…' : 'Rule-Based Analysis'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={handleRunWeighted} 
                          disabled={isWeightedAnalyzing || selectedIsRuleBased} 
                          title={selectedIsRuleBased ? 'Weighted analysis is disabled for rule-based networks' : 'Run weighted analysis using graph edge weights and node biases (Ctrl+Enter)'}
                        >
                          {isWeightedAnalyzing ? 'Analyzing…' : 'Weighted Analysis'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={handleOpenProbabilisticDialog} 
                          disabled={isProbabilisticAnalyzing}
                          title="Run stochastic analysis with noise and degradation parameters (Ctrl+Shift+Enter)"
                        >
                          {isProbabilisticAnalyzing ? 'Analyzing…' : 'Probabilistic Analysis'}
                        </Button>
                      </div>
                    </div>

                    {/* Utilities */}
                    <div className="flex flex-wrap gap-2 pt-1 border-t">
                      <Button size="sm" variant="outline" onClick={handleExample} title="Load a sample Boolean network">
                        Load Example
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleDownloadResults} 
                        disabled={!analysisResult}
                        title="Download analysis results as JSON"
                      >
                        Download Results
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={handleClear} 
                        disabled={!analysisResult && !analysisError}
                        title="Clear current results"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                    <strong>Tip:</strong> Rule-based uses the text rules above. Weighted/Probabilistic use the graph's edge weights and node biases instead.
                  </div>
                  {/* Error Messages with Actionable Guidance */}
                  {analysisError && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4" />
                        inferenceSidebar={(
                          <div className="flex flex-col h-full gap-3">
                            <div className="flex-shrink-0">
                              <h2 className="text-lg font-bold tracking-tight text-foreground">Network Inference</h2>
                            </div>
                            <Separator />
                            {networks.length > 0 && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Network Context</label>
                                <select
                                  value={selectedNetworkId ?? ''}
                                  onChange={(e) => selectNetwork(e.target.value)}
                                  className="w-full border p-2 rounded text-sm"
                                >
                                  <option value="">-- Select a network --</option>
                                  {networks.map(n => (
                                    <option key={n.id} value={n.id}>{n.name || n.id}</option>
                                  ))}
                                </select>
                                {selectedNetworkId ? (
                                  <p className="text-xs text-muted-foreground">Using: {selectedNetwork?.name || selectedNetworkId}</p>
                                ) : (
                                  <p className="text-xs text-amber-600">No network selected</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      <AlertTitle>Analysis Error</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>{analysisError}</p>
                        <div className="text-xs text-red-600/80 pt-1 border-t border-red-200">
                          <strong>Suggestions:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">
                            <li>Check that each rule follows the format: <code>NodeName = Expression</code></li>
                            <li>Verify all referenced nodes exist (e.g., A = B requires node B to be defined)</li>
                            <li>Use AND, OR, NOT operators in uppercase</li>
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  {probabilisticError && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Probabilistic Analysis Error</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>{probabilisticError}</p>
                        <div className="text-xs text-red-600/80 pt-1 border-t border-red-200">
                          <strong>Suggestions:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">
                            <li>Ensure µ (noise) is between 0 and 1</li>
                            <li>Check that c (degradation) is a positive value</li>
                            <li>Verify the network has valid weighted edges</li>
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  {/* Results Container - Scrollable */}
                  <div className="flex-1 overflow-auto min-h-0 space-y-4">
                  {analysisResult && (
                    <div className="border rounded-md p-4 space-y-4 bg-muted/30">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <Stat label="Nodes" value={analysisResult.nodeOrder.length} />
                        <Stat label="Explored States" value={analysisResult.exploredStateCount} />
                        <Stat label="State Space" value={analysisResult.totalStateSpace} />
                        <Stat label="Attractors" value={analysisResult.attractors.length} />
                      </div>
                      {analysisResult.warnings.length > 0 && (
                        <div className="text-xs text-amber-600 space-y-1">
                          {analysisResult.warnings.map((w: any, i: number) => <p key={i}>• {w}</p>)}
                        </div>
                      )}
                      {/* Attractor Landscape Button */}
                      {analysisResult.attractors.length > 0 && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setAttractorLandscapeData(analysisResult.attractors);
                            setAttractorLandscapeOpen(true);
                          }}
                        >
                          View Attractor Landscape
                        </Button>
                      )}
                      <div className="space-y-3">
                        {analysisResult.attractors.map((attr: any) => (
                          <div key={attr.id} className="border rounded-md p-3 bg-background/50">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-medium text-sm">Attractor #{attr.id + 1} ({attr.type})</h3>
                              <span className="text-xs text-muted-foreground">Period {attr.period} • Basin { (attr.basinShare*100).toFixed(1) }%</span>
                            </div>
                            <div className="overflow-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr>
                                    <th className="text-left p-1 font-semibold">State</th>
                                    {analysisResult.nodeOrder.map((n: any) => (
                                      <th key={n} className="p-1 font-medium">{analysisResult.nodeLabels[n]}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {attr.states.map((s: any, si: number) => (
                                    <tr key={si} className="odd:bg-muted/40">
                                      <td className="p-1 font-mono">{s.binary}</td>
                                      {analysisResult.nodeOrder.map((n: any) => (
                                        <td key={n} className="p-1 text-center">{s.values[n]}</td>
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
                  )}
                  {weightedResult && (
                    <div className="space-y-4">
                      {/* Weighted Analysis Section Header */}
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-500">
                        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-base text-blue-900">Weighted Deterministic Analysis</h3>
                          <p className="text-xs text-muted-foreground">Matrix-based Boolean dynamics with threshold tie-breaking</p>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 space-y-4 bg-blue-50/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <Stat label="Nodes" value={weightedResult.nodeOrder.length} />
                          <Stat label="Explored States" value={weightedResult.exploredStateCount} />
                          <Stat label="State Space" value={weightedResult.totalStateSpace} />
                          <Stat label="Attractors" value={weightedResult.attractors.length} />
                        </div>
                        {weightedResult.warnings.length > 0 && (
                          <div className="text-xs text-amber-600 space-y-1 p-2 bg-amber-50 rounded-md border border-amber-200">
                            {weightedResult.warnings.map((w: string, i: number) => <p key={i}>• {w}</p>)}
                          </div>
                        )}
                        {/* Attractor Landscape Button */}
                        {weightedResult.attractors.length > 0 && (
                          <Button
                            variant="outline"
                            className="w-full border-blue-300 hover:bg-blue-100"
                            onClick={() => {
                              setAttractorLandscapeData(weightedResult.attractors);
                              setAttractorLandscapeOpen(true);
                            }}
                          >
                            View Attractor Landscape
                          </Button>
                        )}
                        <div className="space-y-3">
                          {weightedResult.attractors.map((attr: any) => (
                            <div key={attr.id} className="border rounded-md p-3 bg-white shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-medium text-sm text-blue-800">Attractor #{attr.id + 1} ({attr.type})</h3>
                                <span className="text-xs text-muted-foreground">Period {attr.period} • Basin { (attr.basinShare*100).toFixed(1) }%</span>
                              </div>
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
                                    {attr.states.map((s: any, si: number) => (
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
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {probabilisticResult && (
                    <div className="space-y-4">
                      {/* Probabilistic Analysis Section Header */}
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-500">
                        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-base text-purple-900">Probabilistic Analysis</h3>
                          <p className="text-xs text-muted-foreground">Markovian dynamics with noise and self-degradation</p>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 space-y-4 bg-purple-50/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <Stat label="Nodes" value={probabilisticResult.nodeOrder.length} />
                          <Stat label="Converged" value={probabilisticResult.converged ? 'Yes' : 'No'} />
                          <Stat label="Iterations" value={probabilisticResult.iterations} />
                          <Stat label="Avg P" value={probabilisticAverageProbability.toFixed(3)} />
                        </div>
                        {probabilisticResult.warnings.length > 0 && (
                          <div className="text-xs text-amber-600 space-y-1 p-2 bg-amber-50 rounded-md border border-amber-200">
                            {probabilisticResult.warnings.map((w: string, i: number) => <p key={i}>• {w}</p>)}
                          </div>
                        )}
                        {/* Landscape Buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-purple-300 hover:bg-purple-100"
                            onClick={() => setProbabilityLandscapeOpen(true)}
                          >
                            View Probability Landscape
                          </Button>
                          {Object.keys(probabilisticResult.potentialEnergies).length > 0 && (
                            <Button
                              variant="outline"
                              className="border-purple-300 hover:bg-purple-100"
                              onClick={() => setEnergyLandscapeOpen(true)}
                            >
                              View Potential Energy Landscape
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="border-purple-300 hover:bg-purple-100"
                            onClick={() => setShowProbabilityTables(!showProbabilityTables)}
                          >
                            {showProbabilityTables ? 'Hide' : 'Show'} Probability Tables
                          </Button>
                        </div>
                        {showProbabilityTables && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="font-semibold text-sm text-purple-800">Node Steady-State Probabilities</div>
                              <div className="text-xs text-muted-foreground">Each value is the probability that node is ON (0–1). These are independent per-node probabilities, not a distribution.</div>
                              <table className="w-full text-xs border-collapse bg-white rounded shadow-sm">
                                <thead>
                                  <tr>
                                    <th className="text-left p-1 font-semibold">Node</th>
                                    <th className="text-left p-1 font-semibold">Probability</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {probabilisticEntries.map(([nodeId, prob]: [string, number]) => (
                                    <tr key={nodeId} className="odd:bg-muted/40">
                                      <td className="p-1">{nodeIdToLabel[nodeId] || nodeId}</td>
                                      <td className="p-1">{prob.toFixed(4)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="space-y-2">
                              <div className="font-semibold text-sm text-purple-800">Potential energies (−ln P)</div>
                              <table className="w-full text-xs border-collapse bg-white rounded shadow-sm">
                                <thead>
                                  <tr>
                                    <th className="text-left p-1 font-semibold">Node</th>
                                    <th className="text-left p-1 font-semibold">PE</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {probabilisticEntries.map(([nodeId]: [string, number]) => (
                                    <tr key={nodeId} className="odd:bg-muted/40">
                                      <td className="p-1">{nodeIdToLabel[nodeId] || nodeId}</td>
                                      <td className="p-1">{probabilisticResult.potentialEnergies[nodeId].toFixed(4)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="text-xs text-muted-foreground">Min P = {probabilisticMinProbability.toFixed(4)} · Max PE = {probabilisticMaxPotentialEnergy.toFixed(4)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                </CardContent>
              </Card>
              <div className="w-full lg:w-80 space-y-6">
                <Card>
                  <CardContent className="p-4 space-y-3 text-sm">
                    <h3 className="font-semibold">How it works</h3>
                    <p>Enumerates synchronous Boolean dynamics to find fixed points and limit cycles. Each rule uses operators: AND, OR, XOR, NAND, NOR, ! (NOT), parentheses.</p>
                    <p className="text-muted-foreground">State space is truncated if too large (cap in library).</p>
                  </CardContent>
                </Card>
                {inferredNodes.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-2 text-xs">
                      <h4 className="font-medium text-sm">Nodes ({inferredNodes.length})</h4>
                      <div className="flex flex-wrap gap-1">
                        {inferredNodes.map(n => (
                          <span key={n.id} className="px-2 py-0.5 rounded bg-muted">{n.label || n.id}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        );

      case 'autonetcan':
        return (
          <div className="h-full w-full flex flex-col overflow-hidden">
            {/* Header with fallback options */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
              <div className="space-y-0.5">
                <h2 className="text-lg font-semibold">AutoNetCan</h2>
                <p className="text-xs text-muted-foreground">Automated Network Construction for Cancer Systems Biology</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://autonetcan.lums.edu.pk/createNetwork', '_blank')}
                >
                  Open in New Tab ↗
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open('https://autonetcan.lums.edu.pk/createNetwork', '_blank')}
                >
                  Homepage
                </Button>
              </div>
            </div>
            {/* Iframe container */}
            <div className="flex-1 w-full overflow-hidden">
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
        return (
          <div className="h-full">
            <ProjectTabComponent onProjectSelect={setSelectedProjectId} />
          </div>
        );
    }
  };

  const inferenceActionsObj: NetworkEditorLayoutProps['inferenceActions'] = {};
  inferenceActionsObj.run = handleRunDeterministic;
  inferenceActionsObj.runWeighted = handleRunWeighted;
  inferenceActionsObj.runProbabilistic = handleOpenProbabilisticDialog;
  inferenceActionsObj.download = handleDownloadResults;
  inferenceActionsObj.isRunning = isAnalyzing;
  inferenceActionsObj.isWeightedRunning = isWeightedAnalyzing;
  inferenceActionsObj.isProbabilisticRunning = isProbabilisticAnalyzing;
  inferenceActionsObj.weightedResult = weightedResult;
  inferenceActionsObj.hasResult = Boolean(analysisResult || weightedResult || probabilisticResult);
  inferenceActionsObj.isRuleBased = selectedIsRuleBased;

  // Seq Analysis Sidebar with network selector
  const seqAnalysisSidebarContent = (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10">
            <BarChart3 className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Seq Analysis
            </h2>
            <p className="text-xs text-muted-foreground">
              RNA-seq data processing
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Network Context Selector */}
      {networks.length > 0 && ( 
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Select a Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <select
              value={selectedNetworkId ?? ''}
              onChange={(e) => {
                const val = e.target.value || null;
                if (val) selectNetwork(val);
              }}
              className="w-full border p-2 rounded text-sm"
            >
              <option value="">-- Select a network --</option>
              {networks.map(n => (
                <option key={n.id} value={n.id}>{n.name || n.id}</option>
              ))}
            </select>
            {selectedNetworkId ? (
              <p className="text-xs text-muted-foreground">Filtering by: {selectedNetwork?.name || selectedNetworkId}</p>
            ) : (
              <p className="text-xs text-amber-600">No network selected — analysis will show all genes</p>
            )}
          </CardContent>
        </Card>
      )}

      <Separator className="bg-border/50" />

      {/* Requirements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Required Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1.5 text-xs">
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
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <NetworkEditorLayout
        activeTab={activeTab}
        onTabChange={(tab: TabType) => setActiveTab(tab)}
        inferenceActions={inferenceActionsObj}
        seqAnalysisSidebar={seqAnalysisSidebarContent}
      >
        {renderMainContent()}
      </NetworkEditorLayout>

      <Dialog open={isProbabilisticDialogOpen} onOpenChange={setIsProbabilisticDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Probabilistic Analysis</DialogTitle>
            <DialogDescription>
              Configure noise (µ), self-degradation (c), iteration cap, tolerance, and global initial probability.
            </DialogDescription>
          </DialogHeader>

          {probabilisticFormError && (
            <Alert variant="destructive">
              <AlertDescription>{probabilisticFormError}</AlertDescription>
            </Alert>
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mappingType">Landscape Mapping</Label>
              <Select
                value={probabilisticForm.mappingType}
                onValueChange={(value: 'sammon' | 'naive-grid') => setProbabilisticForm((prev) => ({ ...prev, mappingType: value }))}
              >
                <SelectTrigger id="mappingType">
                  <SelectValue placeholder="Select mapping type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sammon" disabled>Sammon Mapping (Distance-preserving)</SelectItem>
                  <SelectItem value="naive-grid">Naive Grid (Simple layout)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sammon mapping preserves distances between states; Naive Grid uses a simple uniform layout.</p>
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

      {/* Weighted Analysis Dialog */}
      <Dialog open={isWeightedDialogOpen} onOpenChange={setIsWeightedDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Weighted Deterministic Analysis</DialogTitle>
            <DialogDescription>
              Configure threshold multiplier, tie behavior, and landscape visualization settings.
            </DialogDescription>
          </DialogHeader>

          {weightedFormError && (
            <Alert variant="destructive">
              <AlertDescription>{weightedFormError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="thresholdMultiplier">Threshold Multiplier</Label>
              <Input
                id="thresholdMultiplier"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={weightedForm.thresholdMultiplier}
                onChange={(e) => setWeightedForm((prev) => ({ ...prev, thresholdMultiplier: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">0–1; threshold = inDegree × multiplier</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tieBehavior">Tie Behavior</Label>
              <Select
                value={weightedForm.tieBehavior}
                onValueChange={(value: 'hold' | 'zero-as-zero' | 'zero-as-one') => setWeightedForm((prev) => ({ ...prev, tieBehavior: value }))}
              >
                <SelectTrigger id="tieBehavior">
                  <SelectValue placeholder="Select tie behavior" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hold">Hold (keep current state)</SelectItem>
                  <SelectItem value="zero-as-zero">Zero as Zero (set to OFF)</SelectItem>
                  <SelectItem value="zero-as-one">Zero as One (set to ON)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Behavior when weighted sum equals threshold.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="weightedMappingType">Landscape Mapping</Label>
              <Select
                value={weightedForm.mappingType}
                onValueChange={(value: 'sammon' | 'naive-grid') => setWeightedForm((prev) => ({ ...prev, mappingType: value }))}
              >
                <SelectTrigger id="weightedMappingType">
                  <SelectValue placeholder="Select mapping type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sammon" disabled>Sammon Mapping (Distance-preserving)</SelectItem>
                  <SelectItem value="naive-grid">Naive Grid (Simple layout)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sammon mapping preserves distances between states; Naive Grid uses a simple uniform layout.</p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsWeightedDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleWeightedSubmit} disabled={isWeightedAnalyzing}>
              {isWeightedAnalyzing ? 'Running…' : 'Run Weighted Analysis'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {probabilisticResult && (
              <ProbabilisticLandscape
                nodeOrder={probabilisticResult.nodeOrder}
                probabilities={probabilisticResult.probabilities}
                potentialEnergies={probabilisticResult.potentialEnergies}
                type="probability"
                mappingType="naive-grid"
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
            {probabilisticResult && (
              <ProbabilisticLandscape
                nodeOrder={probabilisticResult.nodeOrder}
                probabilities={probabilisticResult.probabilities}
                potentialEnergies={probabilisticResult.potentialEnergies}
                type="energy"
                mappingType="naive-grid"
                className="h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Small stat cell component
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col p-2 rounded-md bg-muted/40">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default React.memo(NetworkEditorPage);
