import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { Trash2, Save, Plus } from 'lucide-react';
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
  const { showToast } = useToast();

  // Load rules from selected network
  useEffect(() => {
    if (selectedNetwork?.data?.rules) {
      const loadedRules = Array.isArray(selectedNetwork.data.rules) 
        ? selectedNetwork.data.rules.map(r => {
            if (typeof r === 'string') return r;
            // Reconstruct full rule from { name, action } format
            if (r.action) return `${r.name} = ${r.action}`;
            // Old format where name contains the full rule
            if (r.name && r.name.includes('=')) return r.name;
            return r.name || '';
          }).join('\n')
        : '';
      setRulesText(loadedRules);
    } else if (selectedNetworkId && selectedNetwork) {
      // Only clear rules when we have confirmed the network loaded and it has no rules
      // Don't clear on initial load before network data arrives
      if (selectedNetwork.data !== undefined) {
        setRulesText('');
      }
    }
  }, [selectedNetworkId, selectedNetwork?.data]);

  const handleClear = useCallback(() => {
    setRulesText('');
  }, []);

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
      
      // Helper to extract identifiers from expression (handles labels with spaces)
      const extractIdentifiers = (expression: string, knownLabels: Set<string>): string[] => {
        const ids: string[] = [];
        // First try to match known labels (longer matches first to avoid partial matches)
        const sortedLabels = Array.from(knownLabels).sort((a, b) => b.length - a.length);
        let remaining = expression;
        for (const label of sortedLabels) {
          if (remaining.includes(label)) {
            ids.push(label);
            remaining = remaining.split(label).join('');
          }
        }
        // Then extract any remaining identifiers (words/numbers)
        const extras = remaining.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
        extras.forEach(id => {
          if (!['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'].includes(id.toUpperCase()) && !ids.includes(id)) {
            ids.push(id);
          }
        });
        return ids;
      };
      
      // First pass: collect all targets (everything before =)
      rules.forEach(rule => {
        const eqIndex = rule.indexOf('=');
        if (eqIndex > 0) {
          const target = rule.substring(0, eqIndex).trim();
          nodeSet.add(target);
        }
      });
      
      // Second pass: build edges using known node labels
      rules.forEach(rule => {
        const eqIndex = rule.indexOf('=');
        if (eqIndex > 0) {
          const target = rule.substring(0, eqIndex).trim();
          const expression = rule.substring(eqIndex + 1).trim();
          
          const identifiers = extractIdentifiers(expression, nodeSet);
          identifiers.forEach(id => {
            nodeSet.add(id);
            // Create edge from source to target
            if (id !== target) {
              if (!edgeMap.has(target)) {
                edgeMap.set(target, new Set());
              }
              edgeMap.get(target)!.add(id);
            }
          });
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

      const networkData = (selectedNetwork.data || {}) as NetworkData;
      // Parse rules into proper { name, action } format (handles labels with spaces)
      const parsedRules = rules.map(r => {
        const eqIndex = r.indexOf('=');
        if (eqIndex > 0) {
          const name = r.substring(0, eqIndex).trim();
          const action = r.substring(eqIndex + 1).trim();
          return { name, action, enabled: true };
        }
        // Fallback for rules without proper format
        return { name: r, action: '', enabled: true };
      });

      const updatedData = {
        ...networkData,
        nodes,
        edges,
        rules: parsedRules,
        metadata: { ...(networkData.metadata || {}), type: 'Rule based' }
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
        // Map network_data to data property for ProjectNetworkRecord interface
        const networkRecord: ProjectNetworkRecord = {
          id: data.id,
          name: data.name,
          created_at: data.created_at,
          data: data.network_data || null,
        };
        onNetworkUpdated(networkRecord);
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

      // Extract node names from rules (handles labels with spaces by using indexOf)
      const nodeSet = new Set<string>();
      
      // Helper to extract identifiers from expression (handles labels with spaces)
      const extractIdentifiers = (expression: string, knownLabels: Set<string>): string[] => {
        const ids: string[] = [];
        const sortedLabels = Array.from(knownLabels).sort((a, b) => b.length - a.length);
        let remaining = expression;
        for (const label of sortedLabels) {
          if (remaining.includes(label)) {
            ids.push(label);
            remaining = remaining.split(label).join('');
          }
        }
        const extras = remaining.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
        extras.forEach(id => {
          if (!['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'].includes(id.toUpperCase()) && !ids.includes(id)) {
            ids.push(id);
          }
        });
        return ids;
      };
      
      // First pass: collect targets
      rules.forEach(rule => {
        const eqIndex = rule.indexOf('=');
        if (eqIndex > 0) {
          nodeSet.add(rule.substring(0, eqIndex).trim());
        }
      });
      
      // Second pass: collect sources using known labels
      rules.forEach(rule => {
        const eqIndex = rule.indexOf('=');
        if (eqIndex > 0) {
          const expression = rule.substring(eqIndex + 1).trim();
          extractIdentifiers(expression, nodeSet).forEach(id => nodeSet.add(id));
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
        metadata: { createdFrom: 'rules', type: 'Rule based' }
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
        // Map network_data to data property for ProjectNetworkRecord interface
        const networkRecord: ProjectNetworkRecord = {
          id: newNetwork.id,
          name: newNetwork.name,
          created_at: newNetwork.created_at,
          data: newNetwork.network_data || null,
        };
        onNetworkCreated(networkRecord);
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
                  disabled={!rulesText}
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

            <div className="text-xs text-muted-foreground">
              {rulesText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//')).length} rules defined
            </div>
          </CardContent>
        </Card>

        {/* Info Panel removed per UX request */}
      </div>
    </div>
  );
}
