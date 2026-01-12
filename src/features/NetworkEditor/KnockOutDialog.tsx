import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { NetworkNode } from '@/types/network';
import { X, Plus, Power, ArrowRight, Settings2 } from 'lucide-react';

interface OutwardRegulation {
  targetNode: string;
  operator: '&&' | '||';
  addition: string;
  originalRule?: string;
}

interface KnockOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNodes: NetworkNode[];
  existingRules: Record<string, string>;
  onKnockOut: (knockOutData: {
    nodeName: string;
    nodeRule: null;
    fixedValue: 0;
    outwardRegulations: OutwardRegulation[];
  }) => void;
}

export function KnockOutDialog({ open, onOpenChange, existingNodes, existingRules, onKnockOut }: KnockOutDialogProps) {
  const [selectedNode, setSelectedNode] = useState('');
  const [outwardRegulations, setOutwardRegulations] = useState<OutwardRegulation[]>([]);
  
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [selectedOutwardNode, setSelectedOutwardNode] = useState<string>('');
  const [tempOperator, setTempOperator] = useState<'&&' | '||'>('&&');
  const [tempAddition, setTempAddition] = useState('');

  const handleReset = () => {
    setSelectedNode('');
    setOutwardRegulations([]);
    setSelectedOutwardNode('');
    setTempOperator('&&');
    setTempAddition('');
  };

  const handleOpenRuleEditor = () => {
    if (!selectedOutwardNode) return;
    setTempOperator('&&');
    setTempAddition('');
    setRuleEditorOpen(true);
  };

  const handleAddRule = () => {
    if (!selectedOutwardNode || !tempAddition.trim()) return;
    const originalRule = existingRules[selectedOutwardNode] || '';
    setOutwardRegulations(prev => [...prev, {
      targetNode: selectedOutwardNode,
      operator: tempOperator,
      addition: tempAddition.trim(),
      originalRule
    }]);
    setRuleEditorOpen(false);
    setSelectedOutwardNode('');
    setTempOperator('&&');
    setTempAddition('');
  };

  const handleRemoveOutwardRegulation = (index: number) => {
    setOutwardRegulations(prev => prev.filter((_, i) => i !== index));
  };

  const handleKnockOut = () => {
    if (!selectedNode) return;

    // For knock-out, the node is forced to 0 (OFF)
    onKnockOut({
      nodeName: selectedNode,
      nodeRule: null,
      fixedValue: 0,
      outwardRegulations
    });
    handleReset();
    onOpenChange(false);
  };

  const isValid = !!selectedNode;

  // Get the selected node's label for display
  const selectedNodeLabel = existingNodes.find(n => n.id === selectedNode)?.label || selectedNode;

  // Filter out the selected node from outward regulation targets
  const availableOutwardNodes = existingNodes.filter(n => n.id !== selectedNode);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) handleReset();
        onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Power className="w-4 h-4 text-red-600" />
              Knock Out Node
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Node Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="nodeSelect" className="text-xs font-medium">Select Node to Knock Out</Label>
              <Select value={selectedNode} onValueChange={setSelectedNode}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select a node..." />
                </SelectTrigger>
                <SelectContent>
                  {existingNodes.map(node => (
                    <SelectItem key={node.id} value={node.id} className="text-sm">
                      {node.label || node.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                The selected node will be forced to 0 (OFF) state permanently.
              </p>
            </div>

            {/* Show current rule if exists */}
            {selectedNode && existingRules[selectedNode] && (
              <div className="space-y-1.5 p-3 rounded-md border bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Current Rule (will be overridden)</span>
                <div className="px-2 py-1.5 bg-white dark:bg-slate-800 rounded text-xs font-mono border">
                  {selectedNodeLabel} = {existingRules[selectedNode]}
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400">
                  → Will become: {selectedNodeLabel} = 0 (OFF)
                </div>
              </div>
            )}

            {/* Fixed Value Display */}
            {selectedNode && (
              <div className="space-y-2 p-3 rounded-md border bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-300">Knock-Out Effect</span>
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                    FORCED OFF
                  </Badge>
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">
                  <code className="font-mono bg-red-100 dark:bg-red-900/50 px-1 py-0.5 rounded">
                    {selectedNodeLabel} = 0
                  </code>
                </div>
              </div>
            )}

            {/* Outward Regulations (optional rule modifications for downstream nodes) */}
            {selectedNode && (
              <div className="space-y-2 p-3 rounded-md border bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Outward Regulations (Optional)
                  </span>
                  {outwardRegulations.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {outwardRegulations.length}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Modify rules of nodes that depend on the knocked-out node.
                </p>

                <div className="flex gap-1.5">
                  <Select value={selectedOutwardNode} onValueChange={setSelectedOutwardNode}>
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Select target node" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOutwardNodes.map(node => (
                        <SelectItem key={node.id} value={node.id} className="text-xs">
                          {node.label || node.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleOpenRuleEditor}
                    disabled={!selectedOutwardNode}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                {/* Regulations List */}
                {outwardRegulations.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {outwardRegulations.map((reg, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white dark:bg-slate-800 border text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                            {existingNodes.find(n => n.id === reg.targetNode)?.label || reg.targetNode}
                          </Badge>
                          <span className="text-muted-foreground shrink-0">{reg.operator}</span>
                          <code className="font-mono text-[10px] text-blue-600 dark:text-blue-400 truncate">
                            {reg.addition}
                          </code>
                        </div>
                        <button
                          onClick={() => handleRemoveOutwardRegulation(idx)}
                          className="p-0.5 text-red-500 hover:text-red-700 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-4 py-3 border-t bg-slate-50 dark:bg-slate-900/50">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleKnockOut} 
              disabled={!isValid} 
              className="h-8 text-xs bg-red-600 hover:bg-red-700"
            >
              Knock Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Editor Dialog */}
      <Dialog open={ruleEditorOpen} onOpenChange={setRuleEditorOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Settings2 className="w-4 h-4 text-amber-600" />
              Edit Rule: {existingNodes.find(n => n.id === selectedOutwardNode)?.label || selectedOutwardNode}
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 py-3 space-y-3">
            {existingRules[selectedOutwardNode] && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Current Rule</Label>
                <div className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">
                  {existingRules[selectedOutwardNode]}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Operator</Label>
                <Select value={tempOperator} onValueChange={(val) => setTempOperator(val as '&&' | '||')}>
                  <SelectTrigger className="h-8 w-20 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="&&" className="text-xs font-mono">&&</SelectItem>
                    <SelectItem value="||" className="text-xs font-mono">||</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Addition</Label>
                <Input
                  placeholder={`!${selectedNodeLabel}`}
                  value={tempAddition}
                  onChange={(e) => setTempAddition(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {existingRules[selectedOutwardNode] && tempAddition.trim() && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Preview</Label>
                <div className="px-2 py-1.5 bg-blue-50 dark:bg-blue-950/50 rounded text-xs font-mono text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  ({existingRules[selectedOutwardNode]}) {tempOperator} ({tempAddition.trim()})
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-4 py-3 border-t bg-slate-50 dark:bg-slate-900/50">
            <Button variant="ghost" size="sm" onClick={() => setRuleEditorOpen(false)} className="h-7 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddRule} disabled={!tempAddition.trim()} className="h-7 text-xs">
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
