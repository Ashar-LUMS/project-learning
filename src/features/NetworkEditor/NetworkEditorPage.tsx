import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import NetworkEditorLayout from './layout';
import type { NetworkEditorLayoutProps, TabType } from './layout';
import ProjectTabComponent from './tabs/ProjectTab';
import { SeqAnalysisTab } from './tabs/SeqAnalysisTab';

import NetworkGraph, { type NetworkGraphHandle } from './NetworkGraph';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
// Using native textarea (no shadcn textarea present)
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// analysis node type is internal to the hook now
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';
import { useProbabilisticAnalysis } from '@/hooks/useProbabilisticAnalysis';
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import type { AnalysisEdge, AnalysisNode, ProbabilisticAnalysisOptions, WeightedAnalysisOptions } from '@/lib/analysis/types';
import { useProjectNetworks, type ProjectNetworkRecord } from '@/hooks/useProjectNetworks';

import AttractorGraph from './AttractorGraph';
import AttractorLandscape from './AttractorLandscape';
import ProbabilisticLandscape from './ProbabilisticLandscape';
import { TherapeuticsPanel } from './TherapeuticsPanel';

// network type unified via hook's ProjectNetworkRecord
// Last updated: 2025-12-05 - Added weighted analysis support

function NetworkEditorPage() {
  // Development logging
  if (import.meta.env.DEV) {
    (window as any).__networkEditorPageRenderCount = ((window as any).__networkEditorPageRenderCount || 0) + 1;
    console.log('[NetworkEditorPage] Render #' + (window as any).__networkEditorPageRenderCount);
  }
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
      console.log('[NetworkEditorPage] Deterministic analysis state:', { hasResult: !!deterministicResult, error: deterministicError });
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
  const [isProbabilisticDialogOpen, setIsProbabilisticDialogOpen] = useState(false);
  const [probabilisticForm, setProbabilisticForm] = useState({
    noise: '0.25',
    selfDegradation: '0.1',
    maxIterations: '500',
    tolerance: '1e-4',
    initialProbability: '0.5',
  });
  const [probabilisticFormError, setProbabilisticFormError] = useState<string | null>(null);
  // Landscape dialog states
  const [attractorLandscapeOpen, setAttractorLandscapeOpen] = useState(false);
  const [attractorLandscapeData, setAttractorLandscapeData] = useState<any[] | null>(null);
  const [probabilityLandscapeOpen, setProbabilityLandscapeOpen] = useState(false);
  const [energyLandscapeOpen, setEnergyLandscapeOpen] = useState(false);
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
      thresholdMultiplier: typeof thresholdCandidate === 'number' ? thresholdCandidate : 0.5,
      biases,
    };
    return { nodes, edges, options, metadata };
  };



  const handleRunWeighted = async () => {
    console.log('[NetworkEditorPage] handleRunWeighted called', {
      hasGraphRef: !!graphRef.current,
      hasSelectedNetwork: !!selectedNetwork,
      selectedNetworkKeys: selectedNetwork ? Object.keys(selectedNetwork) : [],
    });

    // Prefer live config from the graph (unsaved panel settings)
    const live = graphRef.current?.getLiveWeightedConfig();
    if (live && live.nodes && live.nodes.length > 0) {
      console.log('[NetworkEditorPage] Using live graph config', { nodeCount: live.nodes.length, edgeCount: live.edges.length });
      const { nodes, edges, options } = normalizeNodesEdges(live);
      await runWeightedAnalysis(nodes, edges, options);
      return;
    }

    // Fallback to saved network data
    if (!selectedNetwork) {
      showToast({ 
        title: 'No Network Selected', 
        description: 'Please select a network first.',
        variant: 'destructive'
      });
      return;
    }

    // Try multiple paths for network data
    const networkData = (selectedNetwork as any).data || selectedNetwork;
    const networkNodes = networkData?.nodes || [];
    const networkEdges = networkData?.edges || [];

    console.log('[NetworkEditorPage] Using saved network data', {
      hasData: !!(selectedNetwork as any).data,
      nodeCount: networkNodes.length,
      edgeCount: networkEdges.length,
    });

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
      thresholdMultiplier: networkData?.metadata?.thresholdMultiplier,
      metadata: networkData?.metadata,
    });

    console.log('[NetworkEditorPage] Running weighted analysis', { nodeCount: nodes.length, edgeCount: edges.length, options });
    await runWeightedAnalysis(nodes, edges, options);
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
    console.log('[DEBUG-BUTTON] Perform Probabilistic Analysis button CLICKED');
    console.log('[DEBUG-BUTTON] Current state before opening dialog:', {
      isProbabilisticDialogOpen,
      isProbabilisticAnalyzing,
      probabilisticResult: !!probabilisticResult,
    });
    setProbabilisticFormError(null);
    setIsProbabilisticDialogOpen(true);
    console.log('[DEBUG] Dialog open state changed to true');
  };

  const handleProbabilisticSubmit = async () => {
    console.log('[DEBUG-SUBMIT] Submit clicked, form:', probabilisticForm);
    const noise = Number(probabilisticForm.noise);
    console.log('[DEBUG-SUBMIT] Noise:', noise);
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

      console.log('[handleProbabilisticSubmit] Analysis completed');

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
      case 'seq-data-analysis':
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
                  {isAnalyzing && (
                    <div className="text-sm text-muted-foreground">Analyzing…</div>
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
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={handleRunAnalysis} disabled={isAnalyzing}>{isAnalyzing ? 'Analyzing…' : 'Run Analysis'}</Button>
                    <Button size="sm" variant="secondary" onClick={handleRunDeterministic} disabled={isAnalyzing}>
                      {isAnalyzing ? 'Analyzing…' : 'Deterministic Analysis'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleRunWeighted} disabled={isWeightedAnalyzing || selectedIsRuleBased} title={selectedIsRuleBased ? 'Weighted analysis disabled for rule-based networks' : undefined}>
                      {isWeightedAnalyzing ? 'Analyzing…' : 'Perform Weighted DA'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleOpenProbabilisticDialog} disabled={isProbabilisticAnalyzing}>
                      {isProbabilisticAnalyzing ? 'Analyzing…' : 'Probabilistic Analysis'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExample}>Load Example</Button>
                    <Button size="sm" variant="ghost" onClick={handleClear} disabled={!analysisResult && !analysisError}>Clear</Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadResults} disabled={!analysisResult}>Download Results</Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Weighted analysis uses the graph weights/biases; the rules text is ignored for weighted runs.
                  </div>
                  {analysisError && (
                    <div className="text-sm text-red-600">{analysisError}</div>
                  )}
                  {probabilisticError && (
                    <div className="text-sm text-red-600">{probabilisticError}</div>
                  )}
                  {analysisResult && (
                    <div className="flex-1 overflow-auto border rounded-md p-4 space-y-4 bg-muted/30">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                              <div className="min-h-[180px]">
                                <AttractorGraph states={attr.states} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {weightedResult && (
                    <div className="flex-1 overflow-auto border rounded-md p-4 space-y-4 bg-muted/30">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <Stat label="Nodes" value={weightedResult.nodeOrder.length} />
                        <Stat label="Explored States" value={weightedResult.exploredStateCount} />
                        <Stat label="State Space" value={weightedResult.totalStateSpace} />
                        <Stat label="Attractors" value={weightedResult.attractors.length} />
                      </div>
                      {weightedResult.warnings.length > 0 && (
                        <div className="text-xs text-amber-600 space-y-1">
                          {weightedResult.warnings.map((w: string, i: number) => <p key={i}>• {w}</p>)}
                        </div>
                      )}
                      {/* Attractor Landscape Button */}
                      {weightedResult.attractors.length > 0 && (
                        <Button
                          variant="outline"
                          className="w-full"
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
                          <div key={attr.id} className="border rounded-md p-3 bg-background/50">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-medium text-sm">Weighted Attractor #{attr.id + 1} ({attr.type})</h3>
                              <span className="text-xs text-muted-foreground">Period {attr.period} • Basin { (attr.basinShare*100).toFixed(1) }%</span>
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
                              <div className="min-h-[180px]">
                                <AttractorGraph states={attr.states} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {probabilisticResult && (
                    <div className="flex-1 overflow-auto border rounded-md p-4 space-y-4 bg-muted/30">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <Stat label="Nodes" value={probabilisticResult.nodeOrder.length} />
                        <Stat label="Converged" value={probabilisticResult.converged ? 'Yes' : 'No'} />
                        <Stat label="Iterations" value={probabilisticResult.iterations} />
                        <Stat label="Avg P" value={probabilisticAverageProbability.toFixed(3)} />
                      </div>
                      {probabilisticResult.warnings.length > 0 && (
                        <div className="text-xs text-amber-600 space-y-1">
                          {probabilisticResult.warnings.map((w: string, i: number) => <p key={i}>• {w}</p>)}
                        </div>
                      )}
                      {/* Landscape Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setProbabilityLandscapeOpen(true)}
                        >
                          View Probability Landscape
                        </Button>
                        {Object.keys(probabilisticResult.potentialEnergies).length > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => setEnergyLandscapeOpen(true)}
                          >
                            View Potential Energy Landscape
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="font-semibold text-sm">Steady-state probabilities</div>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr>
                                <th className="text-left p-1 font-semibold">Node</th>
                                <th className="text-left p-1 font-semibold">Probability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {probabilisticEntries.map(([nodeId, prob]: [string, number]) => (
                                <tr key={nodeId} className="odd:bg-muted/40">
                                  <td className="p-1 font-mono">{nodeId}</td>
                                  <td className="p-1">{prob.toFixed(4)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="space-y-2">
                          <div className="font-semibold text-sm">Potential energies (−ln P)</div>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr>
                                <th className="text-left p-1 font-semibold">Node</th>
                                <th className="text-left p-1 font-semibold">PE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {probabilisticEntries.map(([nodeId]: [string, number]) => (
                                <tr key={nodeId} className="odd:bg-muted/40">
                                  <td className="p-1 font-mono">{nodeId}</td>
                                  <td className="p-1">{probabilisticResult.potentialEnergies[nodeId].toFixed(4)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="text-xs text-muted-foreground">Min P = {probabilisticMinProbability.toFixed(4)} · Max PE = {probabilisticMaxPotentialEnergy.toFixed(4)}</div>
                        </div>
                      </div>
                    </div>
                  )}
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
          <div className="h-full w-full flex flex-col" style={{ minHeight: '100%' }}>
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
            <div className="flex-1 w-full" style={{ minHeight: 'calc(100vh - 200px)' }}>
              <iframe
                // src="https://autonetcan.lums.edu.pk/createNetwork"
                src="https://autonetcan.lums.edu.pk/createNetwork"
                className="w-full h-full border-0"
                style={{ minHeight: 'calc(100vh - 200px)' }}
                title="AutoNetCan - Automated Network Construction"
                allow="clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={(e) => {
                  const iframe = e.target as HTMLIFrameElement;
                  console.log('[AutoNetCan iframe] ✓ onLoad fired - iframe element loaded', {
                    src: iframe.src,
                    width: iframe.offsetWidth,
                    height: iframe.offsetHeight,
                  });
                }}
                onError={(e) => {
                  console.error('[AutoNetCan iframe] ✗ onError - network/load error', e);
                }}
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

  console.log('[NetworkEditorPage] CREATED ACTIONS OBJECT - PROPERTIES ADDED ONE BY ONE:', {
    keys: Object.keys(inferenceActionsObj),
    hasRunProbabilistic: 'runProbabilistic' in inferenceActionsObj,
    hasIsProbabilisticRunning: 'isProbabilisticRunning' in inferenceActionsObj,
    hasWeightedResult: 'weightedResult' in inferenceActionsObj,
  });

  useEffect(() => {
    console.log('[NetworkEditorPage] inferenceActionsObj updated:', {
      hasRunProbabilistic: !!inferenceActionsObj.runProbabilistic,
      runProbabilisticName: inferenceActionsObj.runProbabilistic?.name,
      isProbabilisticRunning: inferenceActionsObj.isProbabilisticRunning,
    });
  }, [inferenceActionsObj]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[NetworkEditorPage] weightedResult updated', {
      hasWeightedResult: !!weightedResult,
      attractors: weightedResult?.attractors?.length ?? 0,
    });
  }, [weightedResult]);

  useEffect(() => {
    if (!probabilisticResult) return;
    // eslint-disable-next-line no-console
    console.log('[NetworkEditorPage] probabilisticResult updated', {
      converged: probabilisticResult.converged,
      iterations: probabilisticResult.iterations,
      nodeCount: probabilisticResult.nodeOrder.length,
    });
  }, [probabilisticResult]);

  useEffect(() => {
    console.log('[NetworkEditorPage] isProbabilisticAnalyzing changed:', isProbabilisticAnalyzing);
  }, [isProbabilisticAnalyzing]);

  console.log('[NetworkEditorPage] Rendering with inferenceActions keys:', Object.keys(inferenceActionsObj));
  console.log('[NetworkEditorPage] Has runProbabilistic?', typeof inferenceActionsObj.runProbabilistic);
  console.log('[NetworkEditorPage] Has isProbabilisticRunning?', typeof inferenceActionsObj.isProbabilisticRunning);
  console.log('[NetworkEditorPage] FINAL CHECK BEFORE RETURN:', {
    runProbabilistic: inferenceActionsObj.runProbabilistic?.name || 'MISSING',
    isProbabilisticRunning: inferenceActionsObj.isProbabilisticRunning,
    keysCount: Object.keys(inferenceActionsObj).length,
  });

  return (
    <>
      <NetworkEditorLayout
        activeTab={activeTab}
        onTabChange={(tab: TabType) => setActiveTab(tab)}
        inferenceActions={inferenceActionsObj}
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

      {/* Attractor Landscape Full-Screen Dialog */}
      <Dialog open={attractorLandscapeOpen} onOpenChange={setAttractorLandscapeOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Attractor Landscape</DialogTitle>
            <DialogDescription>
              3D visualization of the attractor landscape. Valleys represent stable attractors (deeper = larger basin), peaks represent transient states.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-[calc(90vh-100px)] p-4">
            {attractorLandscapeData && attractorLandscapeData.length > 0 && (
              <AttractorLandscape attractors={attractorLandscapeData} className="h-full" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Probability Landscape Full-Screen Dialog */}
      <Dialog open={probabilityLandscapeOpen} onOpenChange={setProbabilityLandscapeOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Probability Landscape</DialogTitle>
            <DialogDescription>
              3D visualization of steady-state probabilities. Peaks represent high-probability states that the system is most likely to occupy.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-[calc(90vh-100px)] p-4">
            {probabilisticResult && (
              <ProbabilisticLandscape
                nodeOrder={probabilisticResult.nodeOrder}
                probabilities={probabilisticResult.probabilities}
                potentialEnergies={probabilisticResult.potentialEnergies}
                type="probability"
                className="h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Potential Energy Landscape Full-Screen Dialog */}
      <Dialog open={energyLandscapeOpen} onOpenChange={setEnergyLandscapeOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Potential Energy Landscape</DialogTitle>
            <DialogDescription>
              3D visualization of potential energy (−ln P). Valleys represent stable states (low energy) where the system tends to settle; peaks represent unstable states (high energy).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-[calc(90vh-100px)] p-4">
            {probabilisticResult && (
              <ProbabilisticLandscape
                nodeOrder={probabilisticResult.nodeOrder}
                probabilities={probabilisticResult.probabilities}
                potentialEnergies={probabilisticResult.potentialEnergies}
                type="energy"
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
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default React.memo(NetworkEditorPage);
