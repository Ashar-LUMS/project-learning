import React, { useCallback, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  mergeNetworks, 
  getMergePreview, 
  type NodeConflictStrategy, 
  type EdgeConflictStrategy, 
  type RuleConflictStrategy 
} from '@/lib/networkIO';
import type { NetworkData } from '@/types/network';
import { GitMerge, AlertCircle, CheckCircle2, Info, Layers, ArrowRightLeft, Circle, Network } from 'lucide-react';

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
    if (!baseNetwork?.data || !overlayNetwork?.data) {
      setMergeError('Missing network data: Base or overlay network data is not available.');
      return;
    }
    
    setIsMerging(true);
    setMergeError(null);

    try {
      console.log('[MergeNetworkDialog] Starting merge...');
      console.log('[MergeNetworkDialog] Base network:', baseNetwork.name, 'Nodes:', baseNetwork.data.nodes?.length, 'Edges:', baseNetwork.data.edges?.length);
      console.log('[MergeNetworkDialog] Overlay network:', overlayNetwork.name, 'Nodes:', overlayNetwork.data.nodes?.length, 'Edges:', overlayNetwork.data.edges?.length);
      console.log('[MergeNetworkDialog] Options:', { nodeConflictStrategy, edgeConflictStrategy, ruleConflictStrategy });

      const mergedData = mergeNetworks(baseNetwork.data, overlayNetwork.data, {
        nodeConflictStrategy,
        edgeConflictStrategy,
        ruleConflictStrategy,
      });

      console.log('[MergeNetworkDialog] Merge complete. Result:', 'Nodes:', mergedData.nodes?.length, 'Edges:', mergedData.edges?.length);
      
      const finalName = mergedNetworkName.trim() || `Merged Network ${new Date().toLocaleString()}`;
      
      console.log('[MergeNetworkDialog] Saving merged network as:', finalName);
      await onMerge(mergedData, finalName);
      console.log('[MergeNetworkDialog] Save successful');
      
      onOpenChange(false);
    } catch (err) {
      console.error('[MergeNetworkDialog] Merge failed:', err);
      let errorMessage = 'Failed to merge networks';
      if (err instanceof Error) {
        errorMessage = err.message;
        // Include stack trace for debugging
        console.error('[MergeNetworkDialog] Stack:', err.stack);
      }
      // Check for Supabase-specific errors
      if (err && typeof err === 'object' && 'code' in err) {
        const supaErr = err as { code: string; message?: string; details?: string };
        errorMessage = `Database error (${supaErr.code}): ${supaErr.message || 'Unknown error'}${supaErr.details ? ` - ${supaErr.details}` : ''}`;
      }
      setMergeError(errorMessage);
    } finally {
      setIsMerging(false);
    }
  }, [baseNetwork, overlayNetwork, nodeConflictStrategy, edgeConflictStrategy, ruleConflictStrategy, mergedNetworkName, onMerge, onOpenChange]);

  const canProceedToOptions = baseNetworkId && overlayNetworkId && baseNetworkId !== overlayNetworkId;
  const canMerge = canProceedToOptions && baseNetwork?.data && overlayNetwork?.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] min-h-[80vh] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <GitMerge className="w-5 h-5 text-primary" />
            </div>
            Merge Networks
          </DialogTitle>
          <DialogDescription className="text-sm">
            Combine two networks into a new unified network
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4 border-b mb-4">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
            step === 'select' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-xs">1</span>
            Select Networks
          </div>
          <div className="w-8 h-0.5 bg-muted" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
            step === 'options' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-xs">2</span>
            Configure
          </div>
          <div className="w-8 h-0.5 bg-muted" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
            step === 'confirm' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-xs">3</span>
            Review & Merge
          </div>
        </div>

        {/* Step 1: Network Selection */}
        {step === 'select' && (
          <div className="flex-1">
            {/* Horizontal Layout for Base and Overlay Networks */}
            <div className="grid grid-cols-2 gap-6 h-full items-stretch">
              {/* Base Network Selection */}
              <div className="flex flex-col bg-muted/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Layers className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <Label className="text-base font-semibold">Base Network</Label>
                    <p className="text-xs text-muted-foreground">Primary network to build upon</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2">
                  {networks.map((network) => (
                    <button
                      key={network.id}
                      type="button"
                      onClick={() => setBaseNetworkId(network.id)}
                      disabled={network === overlayNetwork}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all hover:shadow-md w-full",
                        baseNetworkId === network.id
                          ? "border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-500/10"
                          : network === overlayNetwork
                            ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                            : "border-transparent bg-background hover:border-blue-200 hover:bg-blue-50/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          baseNetworkId === network.id ? "border-blue-500 bg-blue-500" : "border-muted-foreground/30"
                        )}>
                          {baseNetworkId === network.id && (
                            <Circle className="w-2 h-2 text-white fill-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{network.name}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Network className="w-3 h-3" />
                              {network.data?.nodes?.length ?? 0} nodes
                            </span>
                            <span>{network.data?.edges?.length ?? 0} edges</span>
                            {(network.data?.rules?.length ?? 0) > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4">Rules</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Overlay Network Selection */}
              <div className="flex flex-col bg-muted/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Layers className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <Label className="text-base font-semibold">Overlay Network</Label>
                    <p className="text-xs text-muted-foreground">Network to merge into base</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2">
                  {networks.map((network) => (
                    <button
                      key={network.id}
                      type="button"
                      onClick={() => setOverlayNetworkId(network.id)}
                      disabled={network === baseNetwork}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all hover:shadow-md w-full",
                        overlayNetworkId === network.id
                          ? "border-green-500 bg-green-50 shadow-md ring-4 ring-green-500/10"
                          : network === baseNetwork
                            ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                            : "border-transparent bg-background hover:border-green-200 hover:bg-green-50/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          overlayNetworkId === network.id ? "border-green-500 bg-green-500" : "border-muted-foreground/30"
                        )}>
                          {overlayNetworkId === network.id && (
                            <Circle className="w-2 h-2 text-white fill-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{network.name}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Network className="w-3 h-3" />
                              {network.data?.nodes?.length ?? 0} nodes
                            </span>
                            <span>{network.data?.edges?.length ?? 0} edges</span>
                            {(network.data?.rules?.length ?? 0) > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4">Rules</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {baseNetworkId === overlayNetworkId && baseNetworkId && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mt-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Please select two different networks to merge.
              </div>
            )}
          </div>
        )}

        {/* Step 2: Merge Options */}
        {step === 'options' && (
          <div className="space-y-6">
            {/* Merge Preview */}
            {mergePreview && (
              <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Info className="w-4 h-4 text-blue-500" />
                  Merge Preview
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Base Network</div>
                    <div className="text-lg font-semibold text-blue-600">{mergePreview.baseStats.nodes} nodes</div>
                    <div className="text-sm text-muted-foreground">{mergePreview.baseStats.edges} edges</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Overlay Network</div>
                    <div className="text-lg font-semibold text-green-600">{mergePreview.overlayStats.nodes} nodes</div>
                    <div className="text-sm text-muted-foreground">{mergePreview.overlayStats.edges} edges</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Conflicts Found</div>
                    <div className={cn(
                      "text-lg font-semibold",
                      mergePreview.conflicts.nodes > 0 || mergePreview.conflicts.edges > 0
                        ? "text-amber-600"
                        : "text-green-600"
                    )}>
                      {mergePreview.conflicts.nodes} nodes
                    </div>
                    <div className="text-sm text-muted-foreground">{mergePreview.conflicts.edges} edges</div>
                  </div>
                </div>
              </div>
            )}

            {/* Conflict Resolution Options */}
            <div className="grid grid-cols-2 gap-6">
              {/* Node Conflict Strategy */}
              <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Circle className="w-4 h-4 text-blue-500" />
                  </div>
                  <Label className="text-sm font-semibold">Node Conflicts</Label>
                </div>
                <div className="flex flex-col gap-2">
                  {NODE_CONFLICT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setNodeConflictStrategy(option.value)}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        nodeConflictStrategy === option.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-transparent bg-background hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                          nodeConflictStrategy === option.value ? "border-primary bg-primary" : "border-muted-foreground/30"
                        )}>
                          {nodeConflictStrategy === option.value && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="font-medium text-sm">{option.label}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 ml-6">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Edge Conflict Strategy */}
              <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-green-500/10">
                    <ArrowRightLeft className="w-4 h-4 text-green-500" />
                  </div>
                  <Label className="text-sm font-semibold">Edge Conflicts</Label>
                </div>
                <div className="flex flex-col gap-2">
                  {EDGE_CONFLICT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEdgeConflictStrategy(option.value)}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        edgeConflictStrategy === option.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-transparent bg-background hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                          edgeConflictStrategy === option.value ? "border-primary bg-primary" : "border-muted-foreground/30"
                        )}>
                          {edgeConflictStrategy === option.value && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="font-medium text-sm">{option.label}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 ml-6">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rule Conflict Strategy - only show if either network has rules */}
            {(baseHasRules || overlayHasRules) && (
              <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/10">
                    <Layers className="w-4 h-4 text-purple-500" />
                  </div>
                  <Label className="text-sm font-semibold">Rule Conflicts</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {RULE_CONFLICT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRuleConflictStrategy(option.value)}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        ruleConflictStrategy === option.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-transparent bg-background hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                          ruleConflictStrategy === option.value ? "border-primary bg-primary" : "border-muted-foreground/30"
                        )}>
                          {ruleConflictStrategy === option.value && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="font-medium text-sm">{option.label}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 ml-6">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-6">
            {/* Final Preview */}
            {mergePreview && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-green-800">Ready to Merge</div>
                    <div className="text-sm text-green-600">Your networks will be combined into a new network</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/80 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{mergePreview.estimatedResult.nodes}</div>
                    <div className="text-sm text-muted-foreground">Total Nodes</div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{mergePreview.estimatedResult.edges}</div>
                    <div className="text-sm text-muted-foreground">Total Edges</div>
                  </div>
                  {mergePreview.estimatedResult.rules > 0 && (
                    <div className="bg-white/80 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-green-600">{mergePreview.estimatedResult.rules}</div>
                      <div className="text-sm text-muted-foreground">Total Rules</div>
                    </div>
                  )}
                </div>
                {/* Large network warning */}
                {(mergePreview.estimatedResult.nodes > 100 || mergePreview.estimatedResult.edges > 500) && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Large network: This merge may take longer to save. If you encounter a timeout error,
                      try increasing the statement_timeout in your Supabase dashboard.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Network Name */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <Label htmlFor="merged-name" className="text-sm font-semibold">Merged Network Name</Label>
              <input
                id="merged-name"
                type="text"
                value={mergedNetworkName}
                onChange={(e) => setMergedNetworkName(e.target.value)}
                placeholder="Enter network name..."
                className="w-full px-4 py-3 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {/* Merge Details Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Source Networks</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="font-medium">Base:</span> {baseNetwork?.name}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-medium">Overlay:</span> {overlayNetwork?.name}
                  </div>
                </div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Conflict Resolution</div>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Nodes:</span> {NODE_CONFLICT_OPTIONS.find(o => o.value === nodeConflictStrategy)?.label}</div>
                  <div><span className="font-medium">Edges:</span> {EDGE_CONFLICT_OPTIONS.find(o => o.value === edgeConflictStrategy)?.label}</div>
                  {(baseHasRules || overlayHasRules) && (
                    <div><span className="font-medium">Rules:</span> {RULE_CONFLICT_OPTIONS.find(o => o.value === ruleConflictStrategy)?.label}</div>
                  )}
                </div>
              </div>
            </div>

            {mergeError && (
              <div className="flex items-start gap-3 text-sm bg-destructive/10 border border-destructive/30 p-4 rounded-xl">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-destructive mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-destructive">Merge Failed</p>
                  <p className="text-destructive/80 mt-1 break-words whitespace-pre-wrap">{mergeError}</p>
                  {mergeError.toLowerCase().includes('timeout') && (
                    <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Possible Solutions:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Increase <code className="bg-muted px-1 rounded">statement_timeout</code> in Supabase Dashboard → Database → Settings</li>
                        <li>Try merging smaller networks first</li>
                        <li>Use "Node Strategy: Keep Base" to reduce total nodes</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-4 border-t">
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6">
                Cancel
              </Button>
              <Button onClick={() => setStep('options')} disabled={!canProceedToOptions} className="px-6">
                Continue
              </Button>
            </>
          )}
          {step === 'options' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')} className="px-6">
                Back
              </Button>
              <Button onClick={() => setStep('confirm')} className="px-6">
                Continue
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('options')} disabled={isMerging} className="px-6">
                Back
              </Button>
              <Button onClick={handleMerge} disabled={!canMerge || isMerging} className="px-6 bg-green-600 hover:bg-green-700">
                {isMerging ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="w-4 h-4 mr-2" />
                    Merge Networks
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
