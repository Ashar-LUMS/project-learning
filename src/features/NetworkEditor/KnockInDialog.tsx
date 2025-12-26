import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { NetworkNode } from '@/types/network';
import { X, Plus, Zap, ArrowRight, Settings2 } from 'lucide-react';

interface OutwardRegulation {
  targetNode: string;
  operator: '&&' | '||';
  addition: string;
  originalRule?: string;
}

interface KnockInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNodes: NetworkNode[];
  existingRules: Record<string, string>;
  onKnockIn: (knockInData: {
    nodeName: string;
    nodeRule: string | null;
    fixedValue: 0 | 1 | null;
    outwardRegulations: OutwardRegulation[];
  }) => void;
}

export function KnockInDialog({ open, onOpenChange, existingNodes, existingRules, onKnockIn }: KnockInDialogProps) {
  const [nodeName, setNodeName] = useState('');
  const [regulationType, setRegulationType] = useState<'rule' | 'fixed'>('rule');
  const [nodeRule, setNodeRule] = useState('');
  const [fixedValue, setFixedValue] = useState<0 | 1>(0);
  const [outwardRegulations, setOutwardRegulations] = useState<OutwardRegulation[]>([]);
  
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [selectedOutwardNode, setSelectedOutwardNode] = useState<string>('');
  const [tempOperator, setTempOperator] = useState<'&&' | '||'>('&&');
  const [tempAddition, setTempAddition] = useState('');

  const handleReset = () => {
    setNodeName('');
    setRegulationType('rule');
    setNodeRule('');
    setFixedValue(0);
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

  const handleUpdateNode = () => {
    if (!nodeName.trim()) return;
    if (regulationType === 'rule' && !nodeRule.trim()) return;

    onKnockIn({
      nodeName: nodeName.trim(),
      nodeRule: regulationType === 'rule' ? nodeRule.trim() : null,
      fixedValue: regulationType === 'fixed' ? fixedValue : null,
      outwardRegulations
    });
    handleReset();
    onOpenChange(false);
  };

  const isValid = nodeName.trim() && (regulationType === 'fixed' || nodeRule.trim());

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) handleReset();
        onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-blue-600" />
              Knock In Node
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Node Name */}
            <div className="space-y-1.5">
              <Label htmlFor="nodeName" className="text-xs font-medium">Node Name</Label>
              <Input
                id="nodeName"
                placeholder="e.g., DrugX"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Inward Regulations */}
            <div className="space-y-2 p-3 rounded-md border bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Inward Regulation</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setRegulationType('rule')}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                      regulationType === 'rule'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Rule
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegulationType('fixed')}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                      regulationType === 'fixed'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Fixed
                  </button>
                </div>
              </div>

              {regulationType === 'rule' ? (
                <Input
                  placeholder="A && B || !C"
                  value={nodeRule}
                  onChange={(e) => setNodeRule(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              ) : (
                <Select value={fixedValue.toString()} onValueChange={(val) => setFixedValue(val === '1' ? 1 : 0)}>
                  <SelectTrigger className="h-8 w-24 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" className="text-sm">0 (OFF)</SelectItem>
                    <SelectItem value="1" className="text-sm">1 (ON)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Outward Regulations */}
            <div className="space-y-2 p-3 rounded-md border bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Outward Regulations</span>
                {outwardRegulations.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {outwardRegulations.length}
                  </Badge>
                )}
              </div>

              <div className="flex gap-1.5">
                <Select value={selectedOutwardNode} onValueChange={setSelectedOutwardNode}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Select target node" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingNodes.map(node => (
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
          </div>

          {/* Footer */}
          <DialogFooter className="px-4 py-3 border-t bg-slate-50 dark:bg-slate-900/50">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleUpdateNode} disabled={!isValid} className="h-8 text-xs">
              Add Intervention
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
                  placeholder={nodeName || 'NewNode'}
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
