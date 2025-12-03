import type React from 'react';
import { useRef, useState } from 'react';
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
// analysis node type is internal to the hook now
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import { performWeightedDeterministicAnalysis, edgesToMatrix, type WeightedNode, type WeightedEdge } from '@/lib/weightedDeterministicAnalysis';
import { useProjectNetworks, type ProjectNetworkRecord } from '@/hooks/useProjectNetworks';
import { Download, Play } from 'lucide-react';
import AttractorGraph from './AttractorGraph';

// network type unified via hook's ProjectNetworkRecord

export default function NetworkEditorPage() {
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
  const [isWeightedAnalyzing, setIsWeightedAnalyzing] = useState(false);
  const [weightedResult, setWeightedResult] = useState<any>(null);
  const graphRef = useRef<NetworkGraphHandle | null>(null);
  const handleDownloadWeightedResults = () => {
    if (!weightedResult) return;
    try {
      const live = graphRef.current?.getLiveWeightedConfig();
      const payload = {
        meta: {
          generatedAt: new Date().toISOString(),
          projectNetworkId: selectedNetworkId ?? null,
          projectNetworkName: selectedNetwork?.name ?? null,
          nodeCount: weightedResult.nodeOrder.length,
          mode: 'weighted',
          tieBehavior: (live?.tieBehavior as any) ?? (selectedNetwork as any)?.data?.metadata?.tieBehavior ?? 'hold',
        },
        result: weightedResult,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `weighted_deterministic_analysis_${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // swallow download error
    }
  };
  const handleRunWeighted = () => {
    try {
      setIsWeightedAnalyzing(true);
      // Prefer live config from editor (unsaved panel settings)
      const live = graphRef.current?.getLiveWeightedConfig();
      if (live && live.nodes && live.edges) {
        const nodes: WeightedNode[] = live.nodes.map((n: any) => ({ id: String(n.id), label: String(n.label || n.id) }));
        const edges: WeightedEdge[] = live.edges.map((e: any) => ({ source: String(e.source), target: String(e.target), weight: Number(e.weight ?? 1) }));
        const W = edgesToMatrix(nodes, edges);
        const biases = live.nodes.map((n: any) => Number(n.properties?.bias ?? 0));
        const result = performWeightedDeterministicAnalysis({ nodes, weights: W, biases }, { tieBehavior: live.tieBehavior as any });
        setWeightedResult(result);
        return;
      }
      // Fallback to saved network data
      if (!selectedNetwork?.data) return;
      const data = selectedNetwork.data as any;
      const nodes: WeightedNode[] = (Array.isArray(data.nodes) ? data.nodes : []).map((n: any) => ({ id: String(n.id), label: String(n.label || n.id) }));
      const edges: WeightedEdge[] = (Array.isArray(data.edges) ? data.edges : []).map((e: any) => ({ source: String(e.source), target: String(e.target), weight: Number(e.weight ?? 1) }));
      const W = edgesToMatrix(nodes, edges);
      const biases = nodes.map((n: any) => Number(n.properties?.bias ?? 0));
      const tieBehavior = (data.metadata?.tieBehavior as any) || 'hold';
      const result = performWeightedDeterministicAnalysis({ nodes, weights: W, biases }, { tieBehavior });
      // Reuse deterministic result presentation by setting local state
      // We reassign analysisResult through the deterministic hook’s setter via clear + fake run
      // Simpler: keep local result state for weighted (below)
      setWeightedResult(result);
    } catch (e) {
    } finally {
      setIsWeightedAnalyzing(false);
    }
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

  // No global window handlers; actions are provided via injected sidebar below

  const inferenceSidebarContent = (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Inference Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            <Button
              className="w-full justify-start gap-3 h-11 px-4"
              onClick={handleRunDeterministic}
              disabled={isAnalyzing}
            >
              <Play className="w-4 h-4" />
              Perform DA
            </Button>
            <Button
              className="w-full justify-start gap-3 h-11 px-4"
              onClick={handleRunWeighted}
              disabled={isWeightedAnalyzing}
              variant="secondary"
            >
              <Play className="w-4 h-4" />
              Perform Weighted DA
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-11 px-4"
              onClick={handleDownloadResults}
              disabled={!analysisResult}
            >
              <Download className="w-4 h-4" />
              Download Results
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-11 px-4"
              onClick={handleDownloadWeightedResults}
              disabled={!weightedResult}
            >
              <Download className="w-4 h-4" />
              Download Weighted Results
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <div>Selected network: {selectedNetwork ? selectedNetwork.name : 'None'}</div>
          <div>Nodes detected: {inferredNodes.length}</div>
          <div>Result: {analysisResult ? `${analysisResult.attractors.length} attractor(s)` : '—'}</div>
        </CardContent>
      </Card>
    </div>
  );

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
                    <Button size="sm" variant="outline" onClick={handleExample}>Load Example</Button>
                    <Button size="sm" variant="ghost" onClick={handleClear} disabled={!analysisResult && !analysisError}>Clear</Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadResults} disabled={!analysisResult}>Download Results</Button>
                  </div>
                  {analysisError && (
                    <div className="text-sm text-red-600">{analysisError}</div>
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
                          {analysisResult.warnings.map((w,i) => <p key={i}>• {w}</p>)}
                        </div>
                      )}
                      <div className="space-y-3">
                        {analysisResult.attractors.map(attr => (
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
    <NetworkEditorLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      inferenceSidebar={inferenceSidebarContent}
      inferenceActions={{
        run: handleRunDeterministic,
        download: handleDownloadResults,
        isRunning: isAnalyzing,
        hasResult: Boolean(analysisResult),
      }}
    >
      {renderMainContent()}
    </NetworkEditorLayout>
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
