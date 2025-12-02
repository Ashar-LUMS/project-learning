import { useState, useEffect } from "react";
import { BooleanRulesPopup } from "../../components/BooleanRulesPopup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Code2, 
  Network, 
  Settings, 
  Play, 
  Trash2, 
  Eye, 
  Brain,
  GitBranch,
  Zap,
  BarChart3,
  ArrowLeft
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Types for Boolean network
export type BooleanNode = {
  id: string;
  label: string;
  state: boolean;
  rule?: string;
  dependencies: string[];
  dependents: string[];
};

export type BooleanEdge = {
  source: string;
  target: string;
  type: 'activation' | 'inhibition';
};

export type BooleanNetwork = {
  nodes: BooleanNode[];
  edges: BooleanEdge[];
  rules: string[];
};

// Import or define RuleSet type to match NetworkGraph
type RuleSet = {
  name: string;
  rules: any[];
  onRulesApply?: (ruleSet: RuleSet) => void;
  onCancel?: () => void;
  initialRuleSet?: RuleSet;
};

// Props interface
interface RuleBasedGraphProps {
  onRulesApply?: (ruleSet: RuleSet) => void;  // Updated type
  onCancel?: () => void;
  initialRuleSet?: RuleSet;  // Updated type
}

export function RuleBasedGraph({ 
  onRulesApply, 
  onCancel, 
  initialRuleSet 
}: RuleBasedGraphProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [booleanNetwork, setBooleanNetwork] = useState<BooleanNetwork | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  const [nodeStates, setNodeStates] = useState<Record<string, boolean>>({});
  const [simulationStep, setSimulationStep] = useState(0);
  const [activeTab, setActiveTab] = useState("rules");
  const [showInactiveNodes, setShowInactiveNodes] = useState(true);
  const [autoSimulate, setAutoSimulate] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1000);
  const [simulationInterval, setSimulationInterval] = useState<NodeJS.Timeout | null>(null);

  // Initialize from initialRuleSet if provided
  useEffect(() => {
    if (initialRuleSet && initialRuleSet.rules) {
      // Extract Boolean rules from the rule set
      const booleanRules = initialRuleSet.rules
        .filter((rule: any) => rule.name && rule.name.includes("Rule"))
        .map((rule: any) => {
          // Try to extract the Boolean rule from the name
          const match = rule.name.match(/Rule \d+: (.+)/);
          return match ? match[1] : null;
        })
        .filter((rule: string | null) => rule !== null) as string[];
      
      if (booleanRules.length > 0) {
        setRules(booleanRules);
        const network = parseRulesToNetwork(booleanRules);
        setBooleanNetwork(network);
      }
    }
  }, [initialRuleSet]);

  // Parse Boolean rules and create network
  const parseRulesToNetwork = (rulesText: string[]): BooleanNetwork | null => {
    if (!rulesText || rulesText.length === 0) return null;

    const nodes: BooleanNode[] = [];
    const edges: BooleanEdge[] = [];
    const nodeMap = new Map<string, BooleanNode>();
    const edgeSet = new Set<string>();

    // First pass: create nodes and extract dependencies
    rulesText.forEach(rule => {
      const trimmedRule = rule.trim();
      if (!trimmedRule || !trimmedRule.includes('=')) return;

      const [left, right] = trimmedRule.split('=').map(s => s.trim());
      const nodeId = left;
      
      // Extract node dependencies from right side expression
      const dependencies = extractDependencies(right);
      
      if (!nodeMap.has(nodeId)) {
        const node: BooleanNode = {
          id: nodeId,
          label: nodeId,
          state: false,
          rule: trimmedRule,
          dependencies: [],
          dependents: []
        };
        nodes.push(node);
        nodeMap.set(nodeId, node);
      }
      
      const currentNode = nodeMap.get(nodeId)!;
      currentNode.rule = trimmedRule;
      currentNode.dependencies = dependencies;
    });

    // Second pass: create edges based on dependencies
    rulesText.forEach(rule => {
      const trimmedRule = rule.trim();
      if (!trimmedRule || !trimmedRule.includes('=')) return;

      const [left, right] = trimmedRule.split('=').map(s => s.trim());
      const targetNodeId = left;
      const expression = right;
      
      // Check for inhibition (!variable) vs activation (variable)
      const dependencies = extractDependencies(expression);
      
      dependencies.forEach(sourceNodeId => {
        const edgeKey = `${sourceNodeId}→${targetNodeId}`;
        if (!edgeSet.has(edgeKey)) {
          // Determine edge type by checking if source is negated in expression
          const isInhibition = expression.includes(`!${sourceNodeId}`) || 
                              expression.includes(`! ${sourceNodeId}`);
          
          edges.push({
            source: sourceNodeId,
            target: targetNodeId,
            type: isInhibition ? 'inhibition' : 'activation'
          });
          edgeSet.add(edgeKey);
          
          // Update dependents
          const sourceNode = nodeMap.get(sourceNodeId);
          if (sourceNode && !sourceNode.dependents.includes(targetNodeId)) {
            sourceNode.dependents.push(targetNodeId);
          }
        }
      });
    });

    // Initialize states
    const initialState: Record<string, boolean> = {};
    nodes.forEach(node => {
      initialState[node.id] = false;
    });

    setNodeStates(initialState);

    return {
      nodes,
      edges,
      rules: rulesText
    };
  };

  // Extract variable names from Boolean expression
  const extractDependencies = (expression: string): string[] => {
    // Remove operators, parentheses, and true/false keywords
    const tokens = expression
      .replace(/&&|\|\||!|\(|\)|\s/g, ' ')
      .split(' ')
      .filter(token => 
        token.length > 0 && 
        !/^\d/.test(token) &&
        token.toLowerCase() !== 'true' && 
        token.toLowerCase() !== 'false'
      );
    
    return Array.from(new Set(tokens));
  };

  // Evaluate a Boolean expression
  const evaluateExpression = (expression: string, states: Record<string, boolean>): boolean => {
    try {
      // Get all variables used in the expression
      const variables = extractDependencies(expression);
      
      // Create a context object with all variables
      const context: Record<string, boolean> = {};
      variables.forEach(v => {
        context[v] = states[v] || false;
      });
      
      // Add true/false constants
      context['true'] = true;
      context['false'] = false;
      
      // Create evaluation function
      const evalFunc = new Function(
        ...Object.keys(context),
        `return ${expression}`
      );
      
      // Call with all context values
      return evalFunc(...Object.values(context));
    } catch (error) {
      console.error('Error evaluating expression:', error, expression);
      return false;
    }
  };

  // Handle Boolean rules submission from popup
 const handleBooleanRulesSubmit = (submittedRules: string[]) => {
    console.log('Boolean rules submitted:', submittedRules);
    setRules(submittedRules);
    
    // Parse rules to create Boolean network
    const network = parseRulesToNetwork(submittedRules);
    console.log('Parsed Boolean network:', network);
    setBooleanNetwork(network);
    setSimulationStep(0);
    
    // Stop auto simulation if running
    if (simulationInterval) {
      clearInterval(simulationInterval);
      setSimulationInterval(null);
    }

    // Convert Boolean rules to a RuleSet for NetworkGraph
    if (onRulesApply) {
      const ruleSet: RuleSet = {
        name: "Boolean Network Rules",
        rules: submittedRules.map((rule, index) => ({
          id: `boolean-rule-${index}`,
          name: `Boolean Rule ${index + 1}: ${rule}`,
          condition: "true", // Simple condition that always applies
          action: "setNodeColor(node, '#3b82f6')", // Default action
          target: "nodes",
          enabled: true,
          priority: index + 1
        }))
      };
      
      console.log('Converting to RuleSet for NetworkGraph:', ruleSet);
      onRulesApply(ruleSet);
    }
  };

  // Run one simulation step
  const runSimulationStep = () => {
    if (!booleanNetwork) return;
    
    const newStates = { ...nodeStates };
    let hasChanged = false;
    
    booleanNetwork.nodes.forEach(node => {
      if (node.rule) {
        const [_, expression] = node.rule.split('=').map(s => s.trim());
        try {
          const newState = evaluateExpression(expression, nodeStates);
          if (newState !== newStates[node.id]) {
            newStates[node.id] = newState;
            hasChanged = true;
          }
        } catch (error) {
          console.error(`Error evaluating rule for ${node.id}:`, error);
        }
      }
    });
    
    if (hasChanged) {
      setNodeStates(newStates);
      setSimulationStep(prev => prev + 1);
    } else {
      // Stop auto simulation if no changes
      if (autoSimulate && simulationInterval) {
        clearInterval(simulationInterval);
        setSimulationInterval(null);
        setAutoSimulate(false);
      }
    }
  };

  // Toggle auto simulation
  const toggleAutoSimulate = () => {
    const newAutoSimulate = !autoSimulate;
    setAutoSimulate(newAutoSimulate);
    
    if (newAutoSimulate) {
      // Start interval
      const interval = setInterval(runSimulationStep, simulationSpeed);
      setSimulationInterval(interval);
    } else if (simulationInterval) {
      // Stop interval
      clearInterval(simulationInterval);
      setSimulationInterval(null);
    }
  };

  // Reset simulation
  const resetSimulation = () => {
    if (!booleanNetwork) return;
    
    const resetStates: Record<string, boolean> = {};
    booleanNetwork.nodes.forEach(node => {
      resetStates[node.id] = false;
    });
    
    setNodeStates(resetStates);
    setSimulationStep(0);
    
    // Stop auto simulation
    if (simulationInterval) {
      clearInterval(simulationInterval);
      setSimulationInterval(null);
      setAutoSimulate(false);
    }
  };

  // Toggle node state manually
  const toggleNodeState = (nodeId: string) => {
    setNodeStates(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Calculate node statistics
  const calculateStatistics = () => {
    if (!booleanNetwork) return null;
    
    const activeNodes = Object.values(nodeStates).filter(state => state).length;
    const totalNodes = booleanNetwork.nodes.length;
    const edgeCount = booleanNetwork.edges.length;
    const maxConnections = Math.max(...booleanNetwork.nodes.map(n => 
      n.dependencies.length + n.dependents.length
    ), 0);
    
    return {
      activeNodes,
      totalNodes,
      edgeCount,
      activationEdges: booleanNetwork.edges.filter(e => e.type === 'activation').length,
      inhibitionEdges: booleanNetwork.edges.filter(e => e.type === 'inhibition').length,
      maxConnections
    };
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
      }
    };
  }, [simulationInterval]);

  const stats = calculateStatistics();

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white z-30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Graph
                </Button>
              )}
              <Brain className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">Boolean Network Simulator</span>
            </div>
            {booleanNetwork && (
              <>
                <Badge variant="outline">
                  Nodes: {stats?.totalNodes || 0}
                </Badge>
                <Badge variant="outline">
                  Edges: {stats?.edgeCount || 0}
                </Badge>
                <Badge variant="outline">
                  Step: {simulationStep}
                </Badge>
                {autoSimulate && (
                  <Badge variant="default" className="bg-yellow-500">
                    <Zap className="h-3 w-3 mr-1" />
                    Auto-running
                  </Badge>
                )}
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {booleanNetwork && (
              <>
                <div className="flex items-center gap-2">
                  <Label htmlFor="auto-simulate" className="text-sm">Auto</Label>
                  <Switch
                    id="auto-simulate"
                    checked={autoSimulate}
                    onCheckedChange={toggleAutoSimulate}
                  />
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runSimulationStep}
                  disabled={autoSimulate}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Step
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetSimulation}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </>
            )}
            
            <Button
              onClick={() => setIsPopupOpen(true)}
              variant={booleanNetwork ? "outline" : "default"}
            >
              {booleanNetwork ? "Edit Rules" : "Define Boolean Rules"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Controls */}
        <div className="w-64 border-r bg-gray-50 p-4 flex flex-col gap-4 overflow-y-auto">
          {booleanNetwork ? (
            <>
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Network Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Active Nodes</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ 
                              width: `${((stats?.activeNodes || 0) / (stats?.totalNodes || 1)) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {stats?.activeNodes}/{stats?.totalNodes}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Activation</div>
                        <Badge variant="outline" className="w-full justify-center bg-green-50 text-green-700">
                          {stats?.activationEdges}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Inhibition</div>
                        <Badge variant="outline" className="w-full justify-center bg-red-50 text-red-700">
                          {stats?.inhibitionEdges}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Max Connections</div>
                      <div className="text-sm font-medium">{stats?.maxConnections}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Simulation Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="speed" className="text-xs">Speed</Label>
                      <span className="text-xs text-muted-foreground">{simulationSpeed}ms</span>
                    </div>
                    <Slider
                      id="speed"
                      min={100}
                      max={3000}
                      step={100}
                      value={[simulationSpeed]}
                      onValueChange={([value]) => {
                        setSimulationSpeed(value);
                        if (simulationInterval) {
                          clearInterval(simulationInterval);
                          const interval = setInterval(runSimulationStep, value);
                          setSimulationInterval(interval);
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-inactive" className="text-xs">Show Inactive</Label>
                    <Switch
                      id="show-inactive"
                      checked={showInactiveNodes}
                      onCheckedChange={setShowInactiveNodes}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <div className="flex-1">
                <div className="text-sm font-medium mb-2">Boolean Rules ({rules.length})</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rules.map((rule, index) => (
                    <div 
                      key={index} 
                      className="p-2 bg-white border rounded text-xs font-mono hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        const nodeId = rule.split('=')[0].trim();
                        toggleNodeState(nodeId);
                      }}
                      title={`Click to toggle ${rule.split('=')[0].trim()}`}
                    >
                      {rule}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <GitBranch className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Boolean Network</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Define Boolean rules to create an interactive network
              </p>
              <Button 
                onClick={() => setIsPopupOpen(true)}
                className="w-full"
              >
                Create Network
              </Button>
            </div>
          )}
        </div>

        {/* Main Visualization Area */}
        <div className="flex-1 min-w-0 min-h-0 p-4">
          {booleanNetwork ? (
            <div className="h-full flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
                  <TabsTrigger value="rules" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Node View
                  </TabsTrigger>
                  <TabsTrigger value="graph" className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Graph View
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="rules" className="h-[calc(100%-60px)] mt-0">
                  <div className="h-full border rounded-lg bg-gradient-to-br from-gray-50 to-white p-6 overflow-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {booleanNetwork.nodes
                        .filter(node => showInactiveNodes || nodeStates[node.id])
                        .map(node => {
                          const isActive = nodeStates[node.id];
                          const incomingEdges = booleanNetwork.edges.filter(e => e.target === node.id);
                          // const outgoingEdges = booleanNetwork.edges.filter(e => e.source === node.id);
                          
                          return (
                            <div
                              key={node.id}
                              className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg ${
                                isActive
                                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-500'
                                  : 'bg-white border-gray-300'
                              }`}
                              onClick={() => toggleNodeState(node.id)}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${
                                      isActive ? 'bg-green-500' : 'bg-gray-400'
                                    }`} />
                                    <div className="font-bold text-lg">{node.id}</div>
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {node.dependencies.length} in • {node.dependents.length} out
                                  </div>
                                </div>
                                <Badge 
                                  variant={isActive ? "default" : "outline"}
                                  className={isActive ? "bg-green-500" : ""}
                                >
                                  {isActive ? "ON" : "OFF"}
                                </Badge>
                              </div>
                              
                              {/* Rule display */}
                              <div className="mt-3 pt-3 border-t">
                                <div className="text-xs text-muted-foreground mb-1">Rule:</div>
                                <div className="text-xs font-mono bg-gray-50 p-2 rounded">
                                  {node.rule?.split('=')[1].trim()}
                                </div>
                              </div>
                              
                              {/* Edge indicators */}
                              <div className="flex gap-2 mt-3">
                                {incomingEdges.map((edge, idx) => (
                                  <div
                                    key={idx}
                                    className={`text-xs px-2 py-1 rounded ${
                                      edge.type === 'activation'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                    title={`${edge.source} ${edge.type === 'activation' ? '→' : '⊣'} ${node.id}`}
                                  >
                                    {edge.source}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    
                    {!showInactiveNodes && booleanNetwork.nodes.some(node => !nodeStates[node.id]) && (
                      <div className="text-center mt-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowInactiveNodes(true)}
                          className="text-muted-foreground"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Show {booleanNetwork.nodes.filter(node => !nodeStates[node.id]).length} inactive nodes
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="graph" className="h-[calc(100%-60px)] mt-0">
                  <div className="h-full border rounded-lg bg-white p-4">
                    <div className="text-sm text-muted-foreground text-center mb-4">
                      Boolean Network Graph Visualization
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {booleanNetwork.nodes.map(node => {
                        const isActive = nodeStates[node.id];
                        return (
                          <div
                            key={node.id}
                            className={`w-20 h-20 rounded-full flex flex-col items-center justify-center border-2 transition-all cursor-pointer ${
                              isActive
                                ? 'bg-green-500 text-white border-green-600 shadow-lg'
                                : 'bg-gray-100 text-gray-700 border-gray-300'
                            }`}
                            onClick={() => toggleNodeState(node.id)}
                          >
                            <div className="font-bold text-lg">{node.id}</div>
                            <div className="text-xs mt-1">
                              {isActive ? 'ACTIVE' : 'INACTIVE'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 text-center">
                      <div className="inline-flex gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm">Activation Edge</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-sm">Inhibition Edge</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm">Active Node</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                          <span className="text-sm">Inactive Node</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full flex items-center justify-center mb-6">
                <Brain className="h-12 w-12 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Boolean Network Simulator</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Define Boolean logic rules to create an interactive network. Each node's state 
                depends on the states of its inputs according to the rules you define.
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={() => setIsPopupOpen(true)}
                  size="lg"
                  className="px-6"
                >
                  <Code2 className="h-5 w-5 mr-2" />
                  Define Boolean Rules
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    // Load example rules
                    handleBooleanRulesSubmit([
                      "a = (b || c) && (!d)",
                      "b = e && f",
                      "c = !g",
                      "d = h || i",
                      "e = true",
                      "f = false",
                      "g = true",
                      "h = true",
                      "i = false"
                    ]);
                  }}
                >
                  Load Example
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The Boolean Rules Popup */}
      <BooleanRulesPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onSubmit={handleBooleanRulesSubmit}
        initialRules={rules}
      />
    </div>
  );
}

export default RuleBasedGraph;