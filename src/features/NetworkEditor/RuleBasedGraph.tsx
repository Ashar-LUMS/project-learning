import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export type Rule = {
  id: string;
  name: string;
  condition: string;
  action: string;
  priority: number;
  enabled: boolean;
  target: 'nodes' | 'edges' | 'both'; // Changed from 'targets' array to 'target' string
};

export type RuleSet = {
  id: string;
  name: string;
  description: string;
  rules: Rule[];
};

type RuleBasedGraphProps = {
  onRulesApply?: (rules: RuleSet) => void;
  onCancel?: () => void;
  initialRuleSet?: RuleSet;
};

const RuleBasedGraph: React.FC<RuleBasedGraphProps> = ({
  onRulesApply,
  onCancel,
  initialRuleSet
}) => {
  const [ruleSet, setRuleSet] = useState<RuleSet>(
    initialRuleSet || {
      id: `ruleset-${Date.now()}`,
      name: 'New Rule Set',
      description: '',
      rules: []
    }
  );

  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);

  // Predefined conditions and actions for easier rule creation
  const predefinedConditions = [
    'node.weight > 1',
    'node.degree > 2',
    'node.type === "hub"',
    'edge.weight > 0.5',
    'node.properties.centrality > 0.7',
    'node.id.includes("important")',
    'true' // Always true condition
  ];

  const predefinedActions = [
    'highlightNode(node, "red")',
    'setNodeSize(node, 80)',
    'setNodeColor(node, "blue")',
    'setEdgeWidth(edge, 8)',
    'setEdgeColor(edge, "green")',
    'showNeighbors(node)',
    'hideUnconnectedNodes()'
  ];

  const addNewRule = () => {
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      name: 'New Rule',
      condition: 'true',
      action: 'highlightNode(node, "yellow")',
      priority: ruleSet.rules.length + 1,
      enabled: true,
      target: 'nodes'
    };
    setEditingRule(newRule);
    setShowRuleEditor(true);
  };

  const editRule = (rule: Rule) => {
    setEditingRule({...rule});
    setShowRuleEditor(true);
  };

  const saveRule = () => {
    if (!editingRule) return;

    const updatedRules = ruleSet.rules.filter(r => r.id !== editingRule.id);
    updatedRules.push(editingRule);
    
    setRuleSet(prev => ({
      ...prev,
      rules: updatedRules.sort((a, b) => a.priority - b.priority)
    }));
    
    setEditingRule(null);
    setShowRuleEditor(false);
  };

  const deleteRule = (ruleId: string) => {
    setRuleSet(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== ruleId)
    }));
  };

  const moveRule = (ruleId: string, direction: 'up' | 'down') => {
    const rules = [...ruleSet.rules];
    const index = rules.findIndex(r => r.id === ruleId);
    
    if (direction === 'up' && index > 0) {
      [rules[index], rules[index - 1]] = [rules[index - 1], rules[index]];
      rules.forEach((r, i) => r.priority = i + 1);
    } else if (direction === 'down' && index < rules.length - 1) {
      [rules[index], rules[index + 1]] = [rules[index + 1], rules[index]];
      rules.forEach((r, i) => r.priority = i + 1);
    }
    
    setRuleSet(prev => ({ ...prev, rules }));
  };

  const toggleRuleEnabled = (ruleId: string) => {
    setRuleSet(prev => ({
      ...prev,
      rules: prev.rules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    }));
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 p-4">
      {/* Rule Set Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Rule Set Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Rule Set Name</label>
            <Input
              value={ruleSet.name}
              onChange={(e) => setRuleSet(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter rule set name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={ruleSet.description}
              onChange={(e) => setRuleSet(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this rule set does"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rules</CardTitle>
          <Button onClick={addNewRule} size="sm">
            Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          {ruleSet.rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No rules defined. Click "Add Rule" to create your first rule.
            </div>
          ) : (
            <div className="space-y-3">
              {ruleSet.rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className={`p-4 border rounded-lg ${
                    rule.enabled ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary">#{rule.priority}</Badge>
                      <span className="font-medium">{rule.name}</span>
                      <Badge
                        variant={rule.enabled ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleRuleEnabled(rule.id)}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {rule.target}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveRule(rule.id, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveRule(rule.id, 'down')}
                        disabled={index === ruleSet.rules.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editRule(rule)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteRule(rule.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      <strong>Condition:</strong> <code className="bg-gray-100 px-1 rounded">{rule.condition}</code>
                    </div>
                    <div>
                      <strong>Action:</strong> <code className="bg-gray-100 px-1 rounded">{rule.action}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onRulesApply?.(ruleSet)}>
          Apply Rules
        </Button>
      </div>

      {/* Rule Editor Modal */}
      {showRuleEditor && editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit Rule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rule Name</label>
                <Input
                  value={editingRule.name}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Enter rule name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target</label>
                <Select
                  value={editingRule.target}
                  onValueChange={(value: 'nodes' | 'edges' | 'both') => {
                    setEditingRule(prev => prev ? { ...prev, target: value } : null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nodes">Nodes Only</SelectItem>
                    <SelectItem value="edges">Edges Only</SelectItem>
                    <SelectItem value="both">Both Nodes and Edges</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Condition</label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && editingRule) {
                        setEditingRule(prev => prev ? { ...prev, condition: value } : null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Add predefined" />
                    </SelectTrigger>
                    <SelectContent>
                      {predefinedConditions.map((condition, index) => (
                        <SelectItem key={index} value={condition}>
                          {condition}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={editingRule.condition}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, condition: e.target.value } : null)}
                  placeholder="Enter JavaScript condition (e.g., node.weight > 5)"
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Use variables: node, edge, graph. Return boolean.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Action</label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && editingRule) {
                        setEditingRule(prev => prev ? { ...prev, action: value } : null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Add predefined" />
                    </SelectTrigger>
                    <SelectContent>
                      {predefinedActions.map((action, index) => (
                        <SelectItem key={index} value={action}>
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
            
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priority (lower = applied first)</label>
                <Input
                  type="number"
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, priority: parseInt(e.target.value) || 1 } : null)}
                  min="1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={editingRule.enabled}
                  onCheckedChange={(checked) => setEditingRule(prev => prev ? { ...prev, enabled: checked } : null)}
                />
                <label htmlFor="enabled" className="text-sm font-medium">
                  Rule Enabled
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => setShowRuleEditor(false)}>
                  Cancel
                </Button>
                <Button onClick={saveRule}>
                  Save Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RuleBasedGraph;