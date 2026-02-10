import React, { useCallback, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  mergeNetworks, 
  getMergePreview, 
  type NodeConflictStrategy, 
  type EdgeConflictStrategy, 
  type RuleConflictStrategy 
} from '@/lib/networkIO';
import type { NetworkData } from '@/types/network';
import { GitMerge, ArrowRight, AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface NetworkOption {
  id: string;
  name: string;
  data: NetworkData | null;
}

interface MergeNetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networks: NetworkOption[];
  selectedNetworkId: string | null;
  onMerge: (mergedData: NetworkData, name: string) => Promise<void>;
}

const NODE_CONFLICT_OPTIONS: { value: NodeConflictStrategy; label: string; description: string }[] = [
  { value: 'keep-first', label: 'Keep Base', description: 'Keep nodes from the base network, ignore duplicates' },
  { value: 'keep-second', label: 'Keep Overlay', description: 'Replace base nodes with overlay nodes' },
  { value: 'rename-second', label: 'Rename & Keep Both', description: 'Rename conflicting nodes and keep all' },
];

const EDGE_CONFLICT_OPTIONS: { value: EdgeConflictStrategy; label: string; description: string }[] = [
  { value: 'keep-first', label: 'Keep Base', description: 'Keep edge weights from the base network' },
  { value: 'keep-second', label: 'Keep Overlay', description: 'Use edge weights from the overlay network' },
  { value: 'sum-weights', label: 'Sum Weights', description: 'Add weights together for duplicate edges' },
  { value: 'average-weights', label: 'Average Weights', description: 'Use the average of both weights' },
  { value: 'max-weights', label: 'Max Weights', description: 'Keep the larger weight value' },
];

const RULE_CONFLICT_OPTIONS: { value: RuleConflictStrategy; label: string; description: string }[] = [
  { value: 'keep-first', label: 'Keep Base', description: 'Keep rules from the base network' },
  { value: 'keep-second', label: 'Keep Overlay', description: 'Replace with rules from overlay network' },
  { value: 'keep-both', label: 'Keep Both', description: 'Keep all rules (may have duplicates)' },
];

export function MergeNetworkDialog({
  open,
  onOpenChange,
  networks,
  selectedNetworkId,
  onMerge,
}: MergeNetworkDialogProps) {
  // Step management
  const [step, setStep] = useState<'select' | 'options' | 'confirm'>('select');
  
  // Network selection
  const [baseNetworkId, setBaseNetworkId] = useState<string | null>(selectedNetworkId);
  const [overlayNetworkId, setOverlayNetworkId] = useState<string | null>(null);
  
  // Merge options
  const [nodeConflictStrategy, setNodeConflictStrategy] = useState<NodeConflictStrategy>('keep-first');
  const [edgeConflictStrategy, setEdgeConflictStrategy] = useState<EdgeConflictStrategy>('keep-first');
  const [ruleConflictStrategy, setRuleConflictStrategy] = useState<RuleConflictStrategy>('keep-both');
  
  // Output
  const [mergedNetworkName, setMergedNetworkName] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setStep('select');
      setBaseNetworkId(selectedNetworkId);
      setOverlayNetworkId(null);
      setNodeConflictStrategy('keep-first');
      setEdgeConflictStrategy('keep-first');
      setRuleConflictStrategy('keep-both');
      setMergedNetworkName('');
      setMergeError(null);
    }
  }, [open, selectedNetworkId]);

  // Get selected networks
  const baseNetwork = useMemo(
    () => networks.find(n => n.id === baseNetworkId),
    [networks, baseNetworkId]
  );
  const overlayNetwork = useMemo(
    () => networks.find(n => n.id === overlayNetworkId),
    [networks, overlayNetworkId]
  );

  // Check if networks have rules
  const baseHasRules = useMemo(
    () => (baseNetwork?.data?.rules?.length ?? 0) > 0,
    [baseNetwork]
  );
  const overlayHasRules = useMemo(
    () => (overlayNetwork?.data?.rules?.length ?? 0) > 0,
    [overlayNetwork]
  );

  // Get merge preview
  const mergePreview = useMemo(() => {
    if (!baseNetwork?.data || !overlayNetwork?.data) return null;
    return getMergePreview(baseNetwork.data, overlayNetwork.data, {
      nodeConflictStrategy,
      edgeConflictStrategy,
      ruleConflictStrategy,
    });
  }, [baseNetwork, overlayNetwork, nodeConflictStrategy, edgeConflictStrategy, ruleConflictStrategy]);

  // Default merged network name
  React.useEffect(() => {
    if (baseNetwork && overlayNetwork && !mergedNetworkName) {
      setMergedNetworkName(`${baseNetwork.name} + ${overlayNetwork.name}`);
    }
  }, [baseNetwork, overlayNetwork, mergedNetworkName]);

  const handleMerge = useCallback(async () => {
    if (!baseNetwork?.data || !overlayNetwork?.data) return;
    
    setIsMerging(true);
    setMergeError(null);

    try {
      const mergedData = mergeNetworks(baseNetwork.data, overlayNetwork.data, {
        nodeConflictStrategy,
        edgeConflictStrategy,
        ruleConflictStrategy,
      });
      
      const finalName = mergedNetworkName.trim() || `Merged Network ${new Date().toLocaleString()}`;
      await onMerge(mergedData, finalName);
      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to merge networks';
      setMergeError(errorMessage);
    } finally {
      setIsMerging(false);
    }
  }, [baseNetwork, overlayNetwork, nodeConflictStrategy, edgeConflictStrategy, ruleConflictStrategy, mergedNetworkName, onMerge, onOpenChange]);

  const canProceedToOptions = baseNetworkId && overlayNetworkId && baseNetworkId !== overlayNetworkId;
  const canMerge = canProceedToOptions && baseNetwork?.data && overlayNetwork?.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Merge Networks
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Select two networks to merge together.'}
            {step === 'options' && 'Configure how conflicts should be resolved.'}
            {step === 'confirm' && 'Review and confirm the merge operation.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Network Selection */}
        {step === 'select' && (
          <div className="space-y-4">
            {/* Base Network Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                Base Network
                <Badge variant="secondary" className="text-[10px]">Primary</Badge>
              </Label>
              <div className="grid gap-2 max-h-40 overflow-y-auto pr-2">
                {networks.map((network) => (
                  <button
                    key={network.id}
                    type="button"
                    onClick={() => setBaseNetworkId(network.id)}
                    disabled={network === overlayNetwork}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      baseNetworkId === network.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : network === overlayNetwork
                          ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                          : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{network.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{network.data?.nodes?.length ?? 0} nodes</span>
                        <span>·</span>
                        <span>{network.data?.edges?.length ?? 0} edges</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Arrow indicator */}
            <div className="flex justify-center">
              <div className="p-2 rounded-full bg-muted">
                <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
              </div>
            </div>

            {/* Overlay Network Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                Network to Merge
                <Badge variant="outline" className="text-[10px]">Overlay</Badge>
              </Label>
              <div className="grid gap-2 max-h-40 overflow-y-auto pr-2">
                {networks.map((network) => (
                  <button
                    key={network.id}
                    type="button"
                    onClick={() => setOverlayNetworkId(network.id)}
                    disabled={network === baseNetwork}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      overlayNetworkId === network.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : network === baseNetwork
                          ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                          : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{network.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{network.data?.nodes?.length ?? 0} nodes</span>
                        <span>·</span>
                        <span>{network.data?.edges?.length ?? 0} edges</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {baseNetworkId === overlayNetworkId && baseNetworkId && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Please select two different networks to merge.
              </div>
            )}
          </div>
        )}

        {/* Step 2: Merge Options */}
        {step === 'options' && (
          <div className="space-y-4">
            {/* Merge Preview */}
            {mergePreview && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="w-4 h-4 text-blue-500" />
                  Merge Preview
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-muted-foreground">Base</div>
                    <div>{mergePreview.baseStats.nodes} nodes, {mergePreview.baseStats.edges} edges</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Overlay</div>
                    <div>{mergePreview.overlayStats.nodes} nodes, {mergePreview.overlayStats.edges} edges</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Conflicts</div>
                    <div className={cn(
                      mergePreview.conflicts.nodes > 0 || mergePreview.conflicts.edges > 0
                        ? "text-amber-600"
                        : "text-green-600"
                    )}>
                      {mergePreview.conflicts.nodes} nodes, {mergePreview.conflicts.edges} edges
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Node Conflict Strategy */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Node Conflicts</Label>
              <div className="grid gap-2">
                {NODE_CONFLICT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNodeConflictStrategy(option.value)}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all text-sm",
                      nodeConflictStrategy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Edge Conflict Strategy */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Edge Conflicts</Label>
              <div className="grid gap-2">
                {EDGE_CONFLICT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEdgeConflictStrategy(option.value)}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all text-sm",
                      edgeConflictStrategy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rule Conflict Strategy - only show if either network has rules */}
            {(baseHasRules || overlayHasRules) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Rule Conflicts</Label>
                  <div className="grid gap-2">
                    {RULE_CONFLICT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRuleConflictStrategy(option.value)}
                        className={cn(
                          "p-2 rounded-lg border text-left transition-all text-sm",
                          ruleConflictStrategy === option.value
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/50"
                        )}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {/* Final Preview */}
            {mergePreview && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <CheckCircle2 className="w-4 h-4" />
                  Merge Summary
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-green-700 font-medium">Estimated Result</div>
                    <div className="text-green-600">
                      {mergePreview.estimatedResult.nodes} nodes, {mergePreview.estimatedResult.edges} edges
                      {mergePreview.estimatedResult.rules > 0 && `, ${mergePreview.estimatedResult.rules} rules`}
                    </div>
                  </div>
                  <div>
                    <div className="text-green-700 font-medium">Conflicts Resolved</div>
                    <div className="text-green-600">
                      {mergePreview.conflicts.nodes} nodes, {mergePreview.conflicts.edges} edges
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Network Name */}
            <div className="space-y-2">
              <Label htmlFor="merged-name">Merged Network Name</Label>
              <input
                id="merged-name"
                type="text"
                value={mergedNetworkName}
                onChange={(e) => setMergedNetworkName(e.target.value)}
                placeholder="Enter network name..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Merge Details */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div><strong>Base:</strong> {baseNetwork?.name}</div>
              <div><strong>Overlay:</strong> {overlayNetwork?.name}</div>
              <div><strong>Node Strategy:</strong> {NODE_CONFLICT_OPTIONS.find(o => o.value === nodeConflictStrategy)?.label}</div>
              <div><strong>Edge Strategy:</strong> {EDGE_CONFLICT_OPTIONS.find(o => o.value === edgeConflictStrategy)?.label}</div>
              {(baseHasRules || overlayHasRules) && (
                <div><strong>Rule Strategy:</strong> {RULE_CONFLICT_OPTIONS.find(o => o.value === ruleConflictStrategy)?.label}</div>
              )}
            </div>

            {mergeError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {mergeError}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep('options')} disabled={!canProceedToOptions}>
                Continue
              </Button>
            </>
          )}
          {step === 'options' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button onClick={() => setStep('confirm')}>
                Continue
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('options')} disabled={isMerging}>
                Back
              </Button>
              <Button onClick={handleMerge} disabled={!canMerge || isMerging}>
                {isMerging ? 'Merging...' : 'Merge Networks'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
