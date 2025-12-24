import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { useDeterministicAnalysis } from '@/hooks/useDeterministicAnalysis';
import { useToast } from '@/components/ui/toast';
import AttractorGraph from './AttractorGraph';
import { Download, Play, Trash2, Save, Plus } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import type { ProjectNetworkRecord } from '@/hooks/useProjectNetworks';
import type { NetworkData } from '@/types/network';

type RulesPageProps = {
  projectId?: string;
  selectedNetworkId?: string | null;
  selectedNetwork?: ProjectNetworkRecord | null;
  onNetworkCreated?: (network: ProjectNetworkRecord) => void;
  onNetworkUpdated?: (network: ProjectNetworkRecord) => void;
};

export default function RulesPage({ 
  projectId, 
  selectedNetworkId, 
  selectedNetwork,
  onNetworkCreated,
  onNetworkUpdated 
}: RulesPageProps) {
  const [rulesText, setRulesText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { result, isRunning, error, run, reset, downloadResults } = useDeterministicAnalysis();
  const { showToast } = useToast();

  // Load rules from selected network
  useEffect(() => {
    if (selectedNetwork?.data?.rules) {
      const loadedRules = Array.isArray(selectedNetwork.data.rules) 
        ? selectedNetwork.data.rules.map(r => typeof r === 'string' ? r : r.name || '').join('\n')
        : '';
      setRulesText(loadedRules);
    } else if (selectedNetworkId) {
      // Clear rules when network has no rules
      setRulesText('');
    }
  }, [selectedNetworkId, selectedNetwork]);

  const handleRun = useCallback(async () => {
    if (!rulesText.trim()) {
      return;
    }

    const rules = rulesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));

    await run(rules);
  }, [rulesText, run]);

  const handleClear = useCallback(() => {
    reset();
    setRulesText('');
  }, [reset]);

  const handleSaveToNetwork = useCallback(async () => {
    if (!selectedNetworkId || !selectedNetwork) {
      showToast({ title: 'No network selected', description: 'Please select a network first.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const rules = rulesText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));

      // Extract nodes and edges from rules
      const nodeSet = new Set<string>();
      const edgeMap = new Map<string, Set<string>>(); // target -> sources
      
      rules.forEach(rule => {
        const match = rule.match(/^([a-zA-Z0-9_]+)\s*=/);
        if (match) {
          const target = match[1];
          nodeSet.add(target);
          
          // Extract identifiers from expression (right side of =)
          const exprMatch = rule.match(/=\s*(.+)$/);
          if (exprMatch) {
            const expr = exprMatch[1];
            const identifiers = expr.match(/[a-zA-Z0-9_]+/g) || [];
            identifiers.forEach(id => {
              if (!['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'].includes(id.toUpperCase())) {
                nodeSet.add(id);
                // Create edge from source to target
                if (id !== target) {
                  if (!edgeMap.has(target)) {
                    edgeMap.set(target, new Set());
                  }
                  edgeMap.get(target)!.add(id);
                }
              }
            });
          }
        }
      });

      // Get existing nodes to preserve positions
      const existingNodes = selectedNetwork.data?.nodes || [];
      const existingNodeMap = new Map(existingNodes.map(n => [n.id, n]));

      // Create/update nodes
      const nodes = Array.from(nodeSet).map((id, i) => {
        const existing = existingNodeMap.get(id);
        return existing || {
          id,
          label: id,
          position: { 
            x: 100 + (i % 5) * 150, 
            y: 100 + Math.floor(i / 5) * 150 
          }
        };
      });

      // Create edges
      const edges = [];
      for (const [target, sources] of edgeMap.entries()) {
        for (const source of sources) {
          edges.push({
            source,
            target,
            weight: 1
          });
        }
      }

      const networkData = selectedNetwork.data || {};
      const updatedData = {
        ...networkData,
        nodes,
        edges,
        rules: rules.map(r => ({ name: r, enabled: true }))
      };

      const { data, error } = await supabase
        .from('networks')
        .update({ network_data: updatedData })
        .eq('id', selectedNetworkId)
        .select()
        .single();

      if (error) throw error;

      showToast({ title: 'Success', description: `Rules saved with ${nodes.length} nodes and ${edges.length} edges` });
      
      if (data && onNetworkUpdated) {
        onNetworkUpdated(data as ProjectNetworkRecord);
      }
    } catch (err) {
      console.error('Failed to save rules:', err);
      showToast({ title: 'Error', description: 'Failed to save rules', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedNetworkId, selectedNetwork, rulesText, showToast, onNetworkUpdated]);

  const handleCreateNetwork = useCallback(async () => {
    if (!projectId) {
      showToast({ title: 'No project', description: 'Project ID is required', variant: 'destructive' });
      return;
    }

    if (!rulesText.trim()) {
      showToast({ title: 'No rules', description: 'Please enter rules first', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const rules = rulesText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));

      // Extract node names from rules
      const nodeSet = new Set<string>();
      rules.forEach(rule => {
        const match = rule.match(/^([a-zA-Z0-9_]+)\s*=/);
        if (match) {
          nodeSet.add(match[1]);
        }
        // Extract identifiers from expression (right side of =)
        const exprMatch = rule.match(/=\s*(.+)$/);
        if (exprMatch) {
          const expr = exprMatch[1];
          const identifiers = expr.match(/[a-zA-Z0-9_]+/g) || [];
          identifiers.forEach(id => {
            if (!['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'].includes(id.toUpperCase())) {
              nodeSet.add(id);
            }
          });
        }
      });

      // Create nodes with auto-layout
      const nodes = Array.from(nodeSet).map((id, i) => ({
        id,
        label: id,
        position: { 
          x: 100 + (i % 5) * 150, 
          y: 100 + Math.floor(i / 5) * 150 
        }
      }));

      const networkData: NetworkData = {
        nodes,
        edges: [],
        rules: rules.map(r => ({ name: r, enabled: true })),
        metadata: { createdFrom: 'rules' }
      };

      // Get first rule target for network name
      const firstTarget = rules[0]?.split('=')[0]?.trim() || 'Rules';
      const networkName = `Rules: ${firstTarget}${rules.length > 1 ? '...' : ''}`;

      // Create network
      const { data: newNetwork, error: createError } = await supabase
        .from('networks')
        .insert({
          name: networkName,
          network_data: networkData
        })
        .select()
        .single();

      if (createError) throw createError;

      // Link to project
      const { data: projectData } = await supabase
        .from('projects')
        .select('networks')
        .eq('id', projectId)
        .single();

      const existingNetworks = projectData?.networks || [];
      
      const { error: updateError } = await supabase
        .from('projects')
        .update({ networks: [newNetwork.id, ...existingNetworks] })
        .eq('id', projectId);

      if (updateError) throw updateError;

      showToast({ title: 'Success', description: `Created network "${networkName}"` });

      if (onNetworkCreated) {
        onNetworkCreated(newNetwork as ProjectNetworkRecord);
      }
    } catch (err) {
      console.error('Failed to create network:', err);
      showToast({ title: 'Error', description: 'Failed to create network', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  }, [projectId, rulesText, showToast, onNetworkCreated]);

  const exampleRules = `# Example: Toggle switch
Mcm1 = (Clb12 || Clb56) && !Mcm1
Swi5 = (Mcm1 || Cdc20) && !(Swi5 || Clb12)
Cdc20 = !Swi5
Clb12 = Mcm1 && !Cdc20
Clb56 = Mcm1`;

  const loadExample = () => {
    setRulesText(exampleRules);
  };

  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Left: Rule Editor */}
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Boolean Update Rules</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Define rules for synchronous Boolean network dynamics
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={loadExample}
                >
                  Load Example
                </Button>
                {selectedNetworkId && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSaveToNetwork}
                    disabled={isSaving || !rulesText.trim()}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save to Network'}
                  </Button>
                )}
                {!selectedNetworkId && projectId && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={handleCreateNetwork}
                    disabled={isCreating || !rulesText.trim()}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isCreating ? 'Creating...' : 'Create Network'}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClear}
                  disabled={!rulesText && !result}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col space-y-4">
            <Textarea
              placeholder="Enter rules (one per line)&#10;Example:&#10;Mcm1 = (Clb12 || Clb56) && !Mcm1&#10;Swi5 = (Mcm1 || Cdc20) && !(Swi5 || Clb12)&#10;Cdc20 = !Swi5"
              className="font-mono text-sm flex-1 min-h-[300px]"
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
            />

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {rulesText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//')).length} rules defined
              </div>
              <Button 
                onClick={handleRun}
                disabled={isRunning || !rulesText.trim()}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                {isRunning ? 'Analyzing...' : 'Run Analysis'}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <div className="text-sm">{error}</div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Right: Results */}
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Analysis Results</CardTitle>
              {result && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadResults}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col space-y-4">
            {!result ? (
              <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <p className="text-sm">No results yet</p>
                  <p className="text-xs mt-1">Define rules and run analysis to see attractors</p>
                </div>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{result.attractors.length}</div>
                      <div className="text-xs text-muted-foreground">Attractors</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{result.nodeOrder.length}</div>
                      <div className="text-xs text-muted-foreground">Nodes</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">
                        {result.attractors.filter(a => a.type === 'fixed-point').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Fixed Points</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">
                        {result.attractors.filter(a => a.type === 'limit-cycle').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Limit Cycles</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Warnings */}
                {result.warnings && result.warnings.length > 0 && (
                  <Alert>
                    <div className="space-y-1">
                      {result.warnings.map((warning, i) => (
                        <div key={i} className="text-xs">{warning}</div>
                      ))}
                    </div>
                  </Alert>
                )}

                {/* Attractors */}
                <div className="flex-1 overflow-auto">
                  <h3 className="text-sm font-semibold mb-3">Attractors</h3>
                  <div className="space-y-3">
                    {result.attractors.map((attractor) => (
                      <Card key={attractor.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={attractor.type === 'fixed-point' ? 'default' : 'secondary'}>
                                {attractor.type === 'fixed-point' ? 'Fixed Point' : `Cycle (${attractor.period})`}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Basin: {(attractor.basinShare * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            {attractor.states.slice(0, 5).map((state, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-muted-foreground">{i}:</span>
                                <code className="bg-muted px-2 py-0.5 rounded">
                                  {state.binary}
                                </code>
                                <span className="text-muted-foreground">
                                  {Object.entries(state.values)
                                    .filter(([, v]) => v === 1)
                                    .map(([k]) => k)
                                    .join(', ') || 'none'}
                                </span>
                              </div>
                            ))}
                            {attractor.states.length > 5 && (
                              <div className="text-xs text-muted-foreground">
                                ... and {attractor.states.length - 5} more states
                              </div>
                            )}
                          </div>

                          {/* Attractor Visualization */}
                          <div className="mt-4">
                            <AttractorGraph
                              states={attractor.states}
                              className="h-32"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
