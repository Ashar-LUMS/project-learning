import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatTimestamp } from '@/lib/format';
import type { NetworkData } from '@/types/network';
import { useCaseStudies, type CaseStudy } from '@/hooks/useCaseStudies';
import { FileText, Loader2, AlertCircle, ChevronRight, RefreshCw, FolderOpen, Network } from 'lucide-react';

// Re-export the CaseStudy type for external use
export type { CaseStudy } from '@/hooks/useCaseStudies';

interface CaseStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (networkData: NetworkData, name: string) => Promise<void>;
}

export function CaseStudyDialog({
  open,
  onOpenChange,
  onSelect,
}: CaseStudyDialogProps) {
  const [step, setStep] = useState<'list' | 'name'>('list');
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null);
  const [networkName, setNetworkName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Use the reusable hook for fetching case studies
  const { caseStudies, isLoading, error: fetchError, refetch } = useCaseStudies();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('list');
      setSelectedCaseStudy(null);
      setNetworkName('');
      setLocalError(null);
      // Refetch when dialog opens to get latest data
      refetch();
    }
  }, [open, refetch]);

  // Combine fetch error and local error for display
  const error = localError || fetchError;

  const handleSelectCaseStudy = useCallback((caseStudy: CaseStudy) => {
    if (!caseStudy.network) {
      setLocalError('This case study has no network data');
      return;
    }
    setSelectedCaseStudy(caseStudy);
    setNetworkName(caseStudy.name || `Case Study ${caseStudy.id}`);
    setStep('name');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedCaseStudy?.network) return;

    setIsSaving(true);
    setLocalError(null);

    try {
      const finalName = networkName.trim() || `Case Study ${selectedCaseStudy.id}`;
      await onSelect(selectedCaseStudy.network, finalName);
      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load case study';
      setLocalError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [selectedCaseStudy, networkName, onSelect, onOpenChange]);

  const handleBack = useCallback(() => {
    setStep('list');
    setSelectedCaseStudy(null);
    setNetworkName('');
    setLocalError(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">
                {step === 'list' ? 'Load Case Study' : 'Name Your Network'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {step === 'list' 
                  ? 'Select a case study from your library to load onto the canvas'
                  : 'Enter a name for this network before loading'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator className="flex-shrink-0" />

        {step === 'list' ? (
          <div className="py-4 flex-1 min-h-0 flex flex-col">
            {/* Case Study List */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                  <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
                </div>
                <span className="mt-4 text-sm font-medium text-muted-foreground">Loading case studies...</span>
              </div>
            ) : error ? (
              <div className="space-y-4 py-6">
                <div className="flex items-start gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-destructive">Failed to load case studies</p>
                    <p className="text-xs text-destructive/80 mt-1">{error}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLocalError(null);
                    refetch();
                  }}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : caseStudies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/80">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="mt-5 text-sm font-semibold text-muted-foreground">No case studies available</p>
                <p className="mt-1.5 text-xs text-muted-foreground/70 text-center max-w-[240px]">
                  Case studies will appear here once they are added to your library
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full max-h-[320px]">
                  <div className="space-y-2 p-3">
                    {caseStudies.map((caseStudy) => {
                      const nodeCount = caseStudy.network?.nodes?.length ?? 0;
                      const edgeCount = caseStudy.network?.edges?.length ?? 0;
                      const hasNetwork = !!caseStudy.network;

                      return (
                        <button
                          key={caseStudy.id}
                          type="button"
                          onClick={() => handleSelectCaseStudy(caseStudy)}
                          disabled={!hasNetwork}
                          className={cn(
                            "group w-full rounded-lg border bg-card p-4 text-left transition-all",
                            "hover:border-primary/50 hover:bg-accent/30 hover:shadow-md",
                            "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2",
                            !hasNetwork && "opacity-50 cursor-not-allowed hover:border-border hover:bg-card hover:shadow-none"
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors flex-shrink-0",
                              hasNetwork 
                                ? "bg-gradient-to-br from-primary/15 to-primary/5 text-primary group-hover:from-primary/25 group-hover:to-primary/10" 
                                : "bg-muted text-muted-foreground"
                            )}>
                              <Network className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="font-medium text-sm leading-tight">
                                  {caseStudy.name || `Case Study ${caseStudy.id}`}
                                </h4>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(caseStudy.created_at)}
                                </span>
                                {hasNetwork ? (
                                  <>
                                    <span className="text-muted-foreground/30">•</span>
                                    <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
                                      {nodeCount} nodes
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
                                      {edgeCount} edges
                                    </Badge>
                                  </>
                                ) : (
                                  <Badge variant="destructive" className="text-xs px-2 py-0.5">
                                    No data
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator className="mt-5 flex-shrink-0" />

            <DialogFooter className="pt-5 flex-shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} size="lg">
                Cancel
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-4 flex-1 min-h-0 flex flex-col">
            {/* Name Input Step */}
            <div className="space-y-5">
              {selectedCaseStudy && (
                <div className="flex items-center gap-4 rounded-lg bg-gradient-to-r from-muted/70 to-muted/30 p-4 border border-border/50">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
                    <Network className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold">
                      {selectedCaseStudy.name || `Case Study ${selectedCaseStudy.id}`}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
                        {selectedCaseStudy.network?.nodes?.length ?? 0} nodes
                      </Badge>
                      <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
                        {selectedCaseStudy.network?.edges?.length ?? 0} edges
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label htmlFor="network-name" className="text-sm font-medium">Network Name</Label>
                <Input
                  id="network-name"
                  value={networkName}
                  onChange={(e) => setNetworkName(e.target.value)}
                  placeholder="Enter a descriptive name for this network..."
                  className="h-11"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This name will be used to identify the network in your project.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Error</p>
                    <p className="text-xs text-destructive/80 mt-1">{error}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator className="mt-5" />

            <DialogFooter className="pt-5 gap-3 sm:gap-3">
              <Button variant="outline" onClick={handleBack} disabled={isSaving} size="lg" className="flex-1 sm:flex-none">
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={isSaving || !networkName.trim()} size="lg" className="flex-1 sm:flex-none">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load Network'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
