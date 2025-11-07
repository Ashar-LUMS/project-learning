import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import NetworkEditorLayout from './layout';
import ProjectTabComponent from './tabs/ProjectTab';
import NetworkGraph from './NetworkGraph';
import { supabase } from '../../supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
// Using native textarea (no shadcn textarea present)
import { Button } from '@/components/ui/button';
import { performDeterministicAnalysis } from '@/lib/deterministicAnalysis';
import type { AnalysisNode, DeterministicAnalysisResult } from '@/lib/deterministicAnalysis';
import { Download, Play } from 'lucide-react';

type Network = {
  id: string;
  name: string;
  data: any;
  created_at?: string | null;
};

export default function NetworkEditorPage() {
  const [activeTab, setActiveTab] = useState<'projects' | 'network' | 'therapeutics' | 'analysis' | 'results' | 'network-inference' | 'env' | 'cell-circuits' | 'cell-lines' | 'simulation'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(false);
  const [networksError, setNetworksError] = useState<string | null>(null);
  const [rulesText, setRulesText] = useState('');
  const [analysisResult, setAnalysisResult] = useState<DeterministicAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastRulesUsed, setLastRulesUsed] = useState<string[] | null>(null);

  const selectedNetwork = useMemo(() => networks.find(n => n.id === selectedNetworkId) || null, [networks, selectedNetworkId]);

  const inferredNodes: AnalysisNode[] = useMemo(() => {
    // Prefer nodes from network data if present (expecting structure with nodes array of { id, label })
    const fromNetwork: AnalysisNode[] = Array.isArray((selectedNetwork as any)?.data?.nodes)
      ? ((selectedNetwork as any).data.nodes as any[])
          .filter(n => n && (n.id || n.name))
          .map(n => ({ id: String(n.id || n.name), label: n.label || n.name || n.id }))
      : [];
    if (fromNetwork.length) return fromNetwork;
    // Fallback: derive node ids from left-hand sides of rules
    const ids = new Set<string>();
    rulesText.split(/\n+/).forEach(line => {
      const [lhs, rhs] = line.split('=');
      if (lhs && rhs) {
        const id = lhs.trim();
        if (id) ids.add(id);
      }
    });
    return Array.from(ids).map(id => ({ id }));
  }, [selectedNetwork, rulesText]);

  

  const handleRunAnalysis = () => {
    setAnalysisError(null);
    setIsAnalyzing(true);
    try {
      const rules = rulesText
        .split(/\n+/)
        .map(l => l.trim())
        .filter(l => l && l.includes('='));
      if (!rules.length) throw new Error('Provide at least one rule in the form NODE = EXPRESSION');
      if (!inferredNodes.length) throw new Error('Could not infer any nodes. Add rules or select a network with nodes.');
      const result = performDeterministicAnalysis({ nodes: inferredNodes, rules });
      setAnalysisResult(result);
      setLastRulesUsed(rules);
    } catch (e: any) {
      setAnalysisResult(null);
      setAnalysisError(e?.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunDeterministic = () => {
    setAnalysisError(null);
    setIsAnalyzing(true);
    try {
      // Prefer rules from the selected network if available; otherwise use textarea
      const networkRules: string[] = Array.isArray((selectedNetwork as any)?.data?.rules)
        ? ((selectedNetwork as any).data.rules as string[]).filter(r => typeof r === 'string')
        : [];
      const textRules: string[] = rulesText.split(/\n+/).map(l => l.trim()).filter(l => l && l.includes('='));
      const rules = networkRules.length > 0 ? networkRules : textRules;
      if (!rules.length) throw new Error('No rules found. Add rules or select a network that has rules.');
      if (!inferredNodes.length) throw new Error('Could not infer any nodes. Select a network with nodes or add rules including LHS node names.');
      // If we used network rules, mirror them in the editor for transparency
      if (networkRules.length > 0) setRulesText(networkRules.join('\n'));
      const result = performDeterministicAnalysis({ nodes: inferredNodes, rules });
      setAnalysisResult(result);
      setLastRulesUsed(rules);
    } catch (e: any) {
      setAnalysisResult(null);
      setAnalysisError(e?.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadResults = () => {
    if (!analysisResult) return;
    try {
      const payload = {
        meta: {
          generatedAt: new Date().toISOString(),
          projectNetworkId: selectedNetworkId,
          projectNetworkName: selectedNetwork?.name ?? null,
          nodeCount: analysisResult.nodeOrder.length,
        },
        rules: lastRulesUsed ?? rulesText.split(/\n+/).map(l => l.trim()).filter(Boolean),
        result: analysisResult,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `deterministic_analysis_${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // no-op; optional: set error UI
    }
  };

  const handleClear = () => {
    setAnalysisResult(null);
    setAnalysisError(null);
  };

  const handleExample = () => {
    const example = [
      'A = A',
      'B = A AND !C',
      'C = B OR A'
    ].join('\n');
    setRulesText(example);
  };

  // Expose global handlers so default sidebar buttons can invoke actions even without custom sidebar injection
  useEffect(() => {
    (window as any).runDeterministicAnalysis = () => handleRunDeterministic();
    (window as any).downloadDeterministicResults = () => handleDownloadResults();
    return () => {
      try {
        delete (window as any).runDeterministicAnalysis;
        delete (window as any).downloadDeterministicResults;
      } catch {}
    };
  }, [handleRunDeterministic, handleDownloadResults]);

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
              Perform Deterministic Analysis
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
    <NetworkEditorLayout activeTab={activeTab} onTabChange={setActiveTab} inferenceSidebar={inferenceSidebarContent}>
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