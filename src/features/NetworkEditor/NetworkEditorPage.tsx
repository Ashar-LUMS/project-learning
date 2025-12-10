import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import NetworkEditorLayout from './layout';
import ProjectTabComponent from './tabs/ProjectTab';
import NetworkGraph, { type NetworkGraphHandle } from './NetworkGraph';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
// Using native textarea (no shadcn textarea present)
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// analysis node type is internal to the hook now
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';
import { useProbabilisticAnalysis } from '@/hooks/useProbabilisticAnalysis';
import type { AnalysisEdge, AnalysisNode, ProbabilisticAnalysisOptions, WeightedAnalysisOptions } from '@/lib/analysis/types';
import { useProjectNetworks, type ProjectNetworkRecord } from '@/hooks/useProjectNetworks';

import AttractorGraph from './AttractorGraph';

// network type unified via hook's ProjectNetworkRecord
// Last updated: 2025-12-05 - Added weighted analysis support

export default function NetworkEditorPage() {
  console.log('[NetworkEditorPage] Component mounting - weighted analysis enabled');
  const [activeTab, setActiveTab] = useState<'projects' | 'network' | 'therapeutics' | 'analysis' | 'results' | 'network-inference' | 'env' | 'cell-circuits' | 'cell-lines' | 'simulation'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  // networks managed via hook now
  const [rulesText, setRulesText] = useState('');
  // analysis managed via hook

  // use shared hook for project networks
  const { networks, selectedNetworkId, selectedNetwork, isLoading: isLoadingNetworks, error: networksError, selectNetwork, setNetworks } = useProjectNetworks({ projectId: selectedProjectId });

  const {
    inferredNodes,
    isAnalyzing,
    analysisResult,
    analysisError,
    runDeterministic,
    runFromEditorRules,
    downloadResults,
    clear,
  } = useDeterministicAnalysis({
    selectedNetworkId: selectedNetworkId,
    selectedNetworkName: selectedNetwork?.name ?? null,
    networkData: (selectedNetwork as any)?.data ?? null,
    rulesText,
  });

  

  const handleRunAnalysis = () => runFromEditorRules();
  const handleRunDeterministic = () => runDeterministic();
  const {
    result: weightedResult,
    isRunning: isWeightedAnalyzing,
    run: runWeightedAnalysis,
    error: weightedError,
  } = useWeightedAnalysis();
  const {
    result: probabilisticResult,
    isRunning: isProbabilisticAnalyzing,
    error: probabilisticError,
    run: runProbabilisticAnalysis,
    reset: resetProbabilisticAnalysis,
  } = useProbabilisticAnalysis();
  const [isProbabilisticDialogOpen, setIsProbabilisticDialogOpen] = useState(false);
  const [probabilisticForm, setProbabilisticForm] = useState({
    noise: '0.25',
    selfDegradation: '0.1',
    maxIterations: '500',
    tolerance: '1e-4',
    initialProbability: '0.5',
  });
  const [probabilisticFormError, setProbabilisticFormError] = useState<string | null>(null);
  const [inferenceMode, setInferenceMode] = useState<'deterministic' | 'weighted' | 'probabilistic'>('deterministic');
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
  const selectedNetworkData = selectedNetwork ? ((selectedNetwork as any).data ?? selectedNetwork ?? null) : null;
  const selectedNetworkNodes: AnalysisNode[] = Array.isArray(selectedNetworkData?.nodes) ? selectedNetworkData.nodes : [];
  const selectedNetworkEdges: AnalysisEdge[] = Array.isArray(selectedNetworkData?.edges) ? selectedNetworkData.edges : [];
  const selectedNetworkRulesCount = Array.isArray(selectedNetworkData?.rules) ? selectedNetworkData.rules.length : 0;
  const selectedNetworkMetadata: Record<string, any> = selectedNetworkData?.metadata ?? {};
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
    const tieBehaviorCandidate = typeof payload?.tieBehavior === 'string' ? payload.tieBehavior : metadata.tieBehavior;
    const thresholdCandidate = typeof payload?.thresholdMultiplier === 'number'
      ? payload.thresholdMultiplier
      : metadata.thresholdMultiplier;
    const options: WeightedAnalysisOptions = {
      tieBehavior:
        tieBehaviorCandidate === 'zero-as-zero' ||
        tieBehaviorCandidate === 'zero-as-one' ||
        tieBehaviorCandidate === 'hold'
          ? tieBehaviorCandidate
          : 'zero-as-zero',
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
      window.alert('No network selected. Please select a network first.');
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
      window.alert('No nodes found in selected network. Please add nodes in the Network tab first.');
      return;
    }

    const { nodes, edges, options } = normalizeNodesEdges({
      nodes: networkNodes,
      edges: networkEdges,
      tieBehavior: networkData?.metadata?.tieBehavior,
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
        window.alert('No nodes found in the network. Please add nodes before running probabilistic analysis.');
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

      await runProbabilisticAnalysis(nodes, edges, probabilisticOptions);
    };

    resetProbabilisticAnalysis();

    const live = graphRef.current?.getLiveWeightedConfig();
    if (live && Array.isArray(live.nodes) && live.nodes.length > 0) {
      await runWithPayload(live);
      return;
    }

    if (!selectedNetwork) {
      window.alert('No network selected. Please select a network first.');
      return;
    }

    const networkData = (selectedNetwork as any).data || selectedNetwork;
    const networkNodes = networkData?.nodes || [];
    const networkEdges = networkData?.edges || [];

    if (!networkNodes.length) {
      window.alert('No nodes found in selected network. Please add nodes in the Network tab first.');
      return;
    }

    await runWithPayload({
      nodes: networkNodes,
      edges: networkEdges,
      tieBehavior: networkData?.metadata?.tieBehavior,
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
    setIsProbabilisticDialogOpen(false);

    await runProbabilisticWithParams({
      noise,
      selfDegradation,
      maxIterations,
      tolerance,
      initialProbability,
    });

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
                      <NetworkGraph ref={graphRef} networkId={selectedNetworkId} projectId={selectedProjectId} onSaved={(newNetwork) => {
                        setNetworks(prev => [newNetwork, ...prev]);
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
      case 'network-inference':
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
                ) : !selectedNetworkId ? (
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
                            Choose a network from the dropdown above to run deterministic, weighted, or probabilistic analysis.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex-1 flex flex-col space-y-6">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold">
                          {selectedNetwork?.name ?? 'Selected Network'}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Configure once, then reuse the same network state across all inference modes.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <Stat label="Nodes" value={selectedNetworkNodes.length} />
                          <Stat label="Edges" value={selectedNetworkEdges.length} />
                          <Stat label="Rules" value={selectedNetworkRulesCount} />
                          <Stat
                            label="Tie Behavior"
                            value={
                              typeof selectedNetworkMetadata.tieBehavior === 'string'
                                ? String(selectedNetworkMetadata.tieBehavior)
                                : 'zero-as-zero'
                            }
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Weighted and probabilistic runs use the live graph (including unsaved edits). Deterministic analysis respects the rule set shown below.
                        </div>
                      </CardContent>
                    </Card>
                    <Tabs
                      value={inferenceMode}
                      onValueChange={(value) =>
                        setInferenceMode(value as 'deterministic' | 'weighted' | 'probabilistic')
                      }
                      className="flex-1 flex flex-col"
                    >
                      <TabsList className="w-full justify-start">
                        <TabsTrigger value="deterministic">Deterministic</TabsTrigger>
                        <TabsTrigger value="weighted">Weighted</TabsTrigger>
                        <TabsTrigger value="probabilistic">Probabilistic</TabsTrigger>
                      </TabsList>
                      <TabsContent value="deterministic" className="flex-1 flex flex-col space-y-4 mt-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold">Boolean Deterministic Analysis</h3>
                          <p className="text-sm text-muted-foreground">
                            Enter Boolean update rules (one per line, e.g. A = B AND !C) or reuse the rules saved with the network.
                          </p>
                        </div>
                        {selectedNetwork && (
                          <div className="text-xs text-muted-foreground">
                            Using {inferredNodes.length} node(s) from {selectedNetwork.name}
                          </div>
                        )}
                        {isAnalyzing && <div className="text-sm text-muted-foreground">Analyzing…</div>}
                        {!isAnalyzing && analysisResult && !analysisError && (
                          <Alert>
                            <AlertDescription>
                              Analysis complete. Found {analysisResult.attractors.length} attractor(s) · Explored{' '}
                              {analysisResult.exploredStateCount} states.
                            </AlertDescription>
                          </Alert>
                        )}
                        <textarea
                          placeholder={'A = A\nB = A AND !C\nC = B OR A'}
                          className="font-mono text-sm h-48"
                          value={rulesText}
                          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setRulesText(event.target.value)
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={handleRunAnalysis} disabled={isAnalyzing}>
                            {isAnalyzing ? 'Analyzing…' : 'Run (Editor Rules)'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={handleRunDeterministic} disabled={isAnalyzing}>
                            {isAnalyzing ? 'Analyzing…' : 'Run (Saved Rules)'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleExample}>
                            Load Example
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleClear} disabled={!analysisResult && !analysisError}>
                            Clear
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleDownloadResults} disabled={!analysisResult}>
                            Download Results
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Deterministic runs compute the full Boolean state space. Weighted and probabilistic modes ignore the rules text.
                        </div>
                        {analysisError && <div className="text-sm text-red-600">{analysisError}</div>}
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
                                {analysisResult.warnings.map((warning, index) => (
                                  <p key={index}>• {warning}</p>
                                ))}
                              </div>
                            )}
                            <div className="space-y-3">
                              {analysisResult.attractors.map((attractor) => (
                                <div key={attractor.id} className="border rounded-md p-3 bg-background/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium text-sm">
                                      Attractor #{attractor.id + 1} ({attractor.type})
                                    </h3>
                                    <span className="text-xs text-muted-foreground">
                                      Period {attractor.period} • Basin {(attractor.basinShare * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr>
                                            <th className="text-left p-1 font-semibold">State</th>
                                            {analysisResult.nodeOrder.map((nodeId) => (
                                              <th key={nodeId} className="p-1 font-medium">
                                                {analysisResult.nodeLabels[nodeId]}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {attractor.states.map((state, stateIndex) => (
                                            <tr key={stateIndex} className="odd:bg-muted/40">
                                              <td className="p-1 font-mono">{state.binary}</td>
                                              {analysisResult.nodeOrder.map((nodeId) => (
                                                <td key={nodeId} className="p-1 text-center">
                                                  {state.values[nodeId]}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="min-h-[180px]">
                                      <AttractorGraph states={attractor.states} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="weighted" className="flex-1 flex flex-col space-y-4 mt-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold">Weighted Deterministic Analysis</h3>
                          <p className="text-sm text-muted-foreground">
                            Evaluates the live graph using edge weights, per-node biases, and the configured tie behavior.
                          </p>
                        </div>
                        {isWeightedAnalyzing && <div className="text-sm text-muted-foreground">Analyzing…</div>}
                        {!isWeightedAnalyzing && weightedResult && (
                          <Alert>
                            <AlertDescription>
                              Weighted analysis complete. Found {weightedResult.attractors.length} attractor(s) · Explored{' '}
                              {weightedResult.exploredStateCount} states.
                            </AlertDescription>
                          </Alert>
                        )}
                        {weightedError && <div className="text-sm text-red-600">{weightedError}</div>}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={handleRunWeighted} disabled={isWeightedAnalyzing}>
                            {isWeightedAnalyzing ? 'Analyzing…' : 'Run Weighted Analysis'}
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Unsaved changes in the graph editor are included. Adjust tie behavior and threshold in the metadata panel before running.
                        </div>
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
                                {weightedResult.warnings.map((warning: string, index: number) => (
                                  <p key={index}>• {warning}</p>
                                ))}
                              </div>
                            )}
                            <div className="space-y-3">
                              {weightedResult.attractors.map((attractor: any) => (
                                <div key={attractor.id} className="border rounded-md p-3 bg-background/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium text-sm">
                                      Weighted Attractor #{attractor.id + 1} ({attractor.type})
                                    </h3>
                                    <span className="text-xs text-muted-foreground">
                                      Period {attractor.period} • Basin {(attractor.basinShare * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr>
                                            <th className="text-left p-1 font-semibold">State</th>
                                            {weightedResult.nodeOrder.map((nodeId: string) => (
                                              <th key={nodeId} className="p-1 font-medium">
                                                {weightedResult.nodeLabels[nodeId]}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {attractor.states.map((state: any, stateIndex: number) => (
                                            <tr key={stateIndex} className="odd:bg-muted/40">
                                              <td className="p-1 font-mono">{state.binary}</td>
                                              {weightedResult.nodeOrder.map((nodeId: string) => (
                                                <td key={nodeId} className="p-1 text-center">
                                                  {state.values[nodeId]}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="min-h-[180px]">
                                      <AttractorGraph states={attractor.states} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="probabilistic" className="flex-1 flex flex-col space-y-4 mt-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold">Probabilistic Analysis</h3>
                          <p className="text-sm text-muted-foreground">
                            Explore stochastic dynamics with configurable noise (µ), self-degradation (c), and iteration limits.
                          </p>
                        </div>
                        {isProbabilisticAnalyzing && <div className="text-sm text-muted-foreground">Analyzing…</div>}
                        {!isProbabilisticAnalyzing && probabilisticResult && (
                          <Alert>
                            <AlertDescription>
                              Probabilistic analysis complete.{' '}
                              {probabilisticResult.converged
                                ? `Converged in ${probabilisticResult.iterations} iteration(s).`
                                : 'Reached iteration cap before convergence.'}
                            </AlertDescription>
                          </Alert>
                        )}
                        {probabilisticError && <div className="text-sm text-red-600">{probabilisticError}</div>}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleOpenProbabilisticDialog}
                            disabled={isProbabilisticAnalyzing}
                          >
                            {isProbabilisticAnalyzing ? 'Analyzing…' : 'Run Probabilistic Analysis'}
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Current parameters: µ = {probabilisticForm.noise}, c = {probabilisticForm.selfDegradation}, max iterations ={' '}
                          {probabilisticForm.maxIterations}, tolerance = {probabilisticForm.tolerance}, initial probability ={' '}
                          {probabilisticForm.initialProbability}.
                        </div>
                        {probabilisticResult && probabilisticEntries.length > 0 && (
                          <div className="flex-1 overflow-auto border rounded-md p-4 space-y-4 bg-muted/30">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <Stat label="Nodes" value={probabilisticEntries.length} />
                              <Stat label="Iterations" value={probabilisticResult.iterations} />
                              <Stat label="Converged" value={probabilisticResult.converged ? 'Yes' : 'No'} />
                              <Stat label="Avg Probability" value={probabilisticAverageProbability.toFixed(3)} />
                              <Stat label="Min Probability" value={probabilisticMinProbability.toFixed(3)} />
                              <Stat label="Max PE" value={probabilisticMaxPotentialEnergy.toFixed(3)} />
                            </div>
                            {probabilisticResult.warnings.length > 0 && (
                              <div className="text-xs text-amber-600 space-y-1">
                                {probabilisticResult.warnings.map((warning, index) => (
                                  <p key={index}>• {warning}</p>
                                ))}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Potential energy is −ln(Pi); probabilities and energies are reported per node.
                            </div>
                            <div className="overflow-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr>
                                    <th className="p-1 text-left font-semibold">Node</th>
                                    <th className="p-1 text-left font-semibold">Probability</th>
                                    <th className="p-1 text-left font-semibold">Potential Energy</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {probabilisticEntries.map(([nodeId, probability]) => {
                                    const potentialEnergy = probabilisticResult.potentialEnergies[nodeId] ?? 0;
                                    return (
                                      <tr key={nodeId} className="odd:bg-muted/40">
                                        <td className="p-1 font-medium">{nodeId}</td>
                                        <td className="p-1 font-mono">{probability.toFixed(4)}</td>
                                        <td className="p-1 font-mono">{potentialEnergy.toFixed(4)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                    {inferredNodes.length > 0 && (
                      <Card>
                        <CardContent className="p-4 space-y-2 text-xs">
                          <h4 className="font-medium text-sm">Nodes ({inferredNodes.length})</h4>
                          <div className="flex flex-wrap gap-1">
                            {inferredNodes.map((node) => (
                              <span key={node.id} className="px-2 py-0.5 rounded bg-muted">
                                {node.label || node.id}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
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
                        Please select a project from the Projects tab to run deterministic, weighted, or probabilistic analysis.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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

  const inferenceActionsObj = {
    run: handleRunDeterministic,
    runWeighted: handleRunWeighted,
    runProbabilistic: handleOpenProbabilisticDialog,
    download: handleDownloadResults,
    isRunning: isAnalyzing,
    isWeightedRunning: isWeightedAnalyzing,
    isProbabilisticRunning: isProbabilisticAnalyzing,
    hasResult: Boolean(analysisResult || weightedResult || probabilisticResult),
  };

  console.log('[NetworkEditorPage] Rendering with inferenceActions:', inferenceActionsObj);

  return (
    <>
      <NetworkEditorLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        inferenceActions={inferenceActionsObj}
      >
        {renderMainContent()}
      </NetworkEditorLayout>
      <Dialog
        open={isProbabilisticDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsProbabilisticDialogOpen(false);
            setProbabilisticFormError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Probabilistic Analysis Parameters</DialogTitle>
            <DialogDescription>
              Configure noise (µ), self-degradation (c), and iteration limits for probabilistic analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="pa-noise">Noise (µ)</Label>
              <Input
                id="pa-noise"
                type="number"
                step="any"
                min="0"
                value={probabilisticForm.noise}
                onChange={(event) => setProbabilisticForm((prev) => ({ ...prev, noise: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pa-self">Self-degradation (c)</Label>
              <Input
                id="pa-self"
                type="number"
                step="any"
                min="0"
                max="1"
                value={probabilisticForm.selfDegradation}
                onChange={(event) => setProbabilisticForm((prev) => ({ ...prev, selfDegradation: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pa-iterations">Max iterations</Label>
              <Input
                id="pa-iterations"
                type="number"
                step={1}
                min={1}
                value={probabilisticForm.maxIterations}
                onChange={(event) => setProbabilisticForm((prev) => ({ ...prev, maxIterations: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pa-tolerance">Tolerance</Label>
              <Input
                id="pa-tolerance"
                type="number"
                step="any"
                min="0"
                value={probabilisticForm.tolerance}
                onChange={(event) => setProbabilisticForm((prev) => ({ ...prev, tolerance: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pa-initial">Initial probability</Label>
              <Input
                id="pa-initial"
                type="number"
                step="any"
                min="0"
                max="1"
                value={probabilisticForm.initialProbability}
                onChange={(event) => setProbabilisticForm((prev) => ({ ...prev, initialProbability: event.target.value }))}
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Set values between 0 and 1 for probabilities. Larger noise flattens the sigmoid response; higher degradation pulls nodes toward the inactive state.
          </div>
          {probabilisticFormError && (
            <p className="text-sm text-red-600">{probabilisticFormError}</p>
          )}
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsProbabilisticDialogOpen(false);
                setProbabilisticFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleProbabilisticSubmit} disabled={isProbabilisticAnalyzing}>
              {isProbabilisticAnalyzing ? 'Analyzing…' : 'Run Probabilistic Analysis'}
            </Button>
          </DialogFooter>
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
