import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KnockInDialog } from './KnockInDialog';
import type { NetworkNode, TherapeuticIntervention } from '@/types/network';
import { Plus, X, Save, Syringe } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { useToast } from '@/components/ui/toast';

type InterventionType = 'knock-in' | 'knock-out' | 'edge-knock-in' | 'edge-knock-out';

interface TherapeuticsPanelProps {
  networkId: string;
  nodes: NetworkNode[];
  rules: Record<string, string>;
  existingTherapies?: TherapeuticIntervention[] | null;
  onTherapiesUpdated?: () => void;
  onInterventionsChange?: (interventions: TherapeuticIntervention[]) => void;
}

export function TherapeuticsPanel({ 
  networkId, 
  nodes, 
  rules, 
  existingTherapies,
  onTherapiesUpdated,
  onInterventionsChange
}: TherapeuticsPanelProps) {
  const [knockInDialogOpen, setKnockInDialogOpen] = useState(false);
  const [selectedInterventionType, setSelectedInterventionType] = useState<InterventionType>('knock-in');
  const [interventions, setInterventions] = useState<TherapeuticIntervention[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (existingTherapies && Array.isArray(existingTherapies)) {
      setInterventions(existingTherapies);
    } else {
      setInterventions([]);
    }
  }, [existingTherapies]);

  const handleKnockIn = (knockInData: {
    nodeName: string;
    nodeRule: string | null;
    fixedValue: 0 | 1 | null;
    outwardRegulations: Array<{
      targetNode: string;
      operator: '&&' | '||';
      addition: string;
      originalRule?: string;
    }>;
  }) => {
    const newIntervention: TherapeuticIntervention = {
      id: `knockin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'knock-in',
      ...knockInData,
      timestamp: Date.now()
    };

    const updatedInterventions = [...interventions, newIntervention];
    setInterventions(updatedInterventions);
    onInterventionsChange?.(updatedInterventions);
  };

  const handleRemoveIntervention = (id: string) => {
    const updatedInterventions = interventions.filter(i => i.id !== id);
    // Optimistically update UI
    setInterventions(updatedInterventions);
    onInterventionsChange?.(updatedInterventions);

    // Persist removal immediately
    (async () => {
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('networks')
          .update({ therapies: updatedInterventions })
          .eq('id', networkId);

        if (error) throw error;

        showToast({ title: 'Saved', description: 'Intervention removed.', variant: 'default' });
        onTherapiesUpdated?.();
      } catch (err: any) {
        // Revert UI on failure
        setInterventions(prev => {
          const reverted = [...prev, interventions.find(i => i.id === id)!].filter(Boolean);
          onInterventionsChange?.(reverted as TherapeuticIntervention[]);
          return reverted as TherapeuticIntervention[];
        });
        showToast({ title: 'Error', description: err.message || 'Failed to remove intervention.', variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const handleSaveTherapies = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('networks')
        .update({ therapies: interventions })
        .eq('id', networkId);

      if (error) throw error;

      showToast({
        title: 'Saved',
        description: `${interventions.length} intervention(s) saved.`,
        variant: 'default'
      });

      onTherapiesUpdated?.();
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to save.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Add Intervention Controls */}
      <div className="flex items-center gap-2 mb-3">
        <Select
          value={selectedInterventionType}
          onValueChange={(value) => setSelectedInterventionType(value as InterventionType)}
        >
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="knock-in" className="text-xs">Knock In</SelectItem>
            <SelectItem value="knock-out" className="text-xs">Knock Out</SelectItem>
            <SelectItem value="edge-knock-in" className="text-xs">Edge Knock In</SelectItem>
            <SelectItem value="edge-knock-out" className="text-xs">Edge Knock Out</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => {
            if (selectedInterventionType === 'knock-in') {
              setKnockInDialogOpen(true);
            }
            // TODO: Handle other intervention types
          }}
          size="sm"
          className="h-8 text-xs px-3"
          disabled={selectedInterventionType !== 'knock-in'}
          title={selectedInterventionType !== 'knock-in' ? 'Coming Soon' : undefined}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      {/* Interventions List */}
      <div className="space-y-2">
        {interventions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground border border-dashed rounded-lg">
            <Syringe className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-xs">No interventions yet</p>
            <p className="text-xs opacity-60">Select a type and click "Add"</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {interventions.length} intervention{interventions.length !== 1 ? 's' : ''}
              </span>
            </div>
            {interventions.map((intervention, index) => (
              <div
                key={intervention.id}
                className="bg-card rounded-lg border border-l-4 border-l-blue-500 p-3 text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-blue-600 text-[10px] px-1.5 py-0 h-4">
                      #{index + 1}
                    </Badge>
                    <span className="font-semibold">{intervention.nodeName}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveIntervention(intervention.id)}
                    className="text-red-500 hover:text-red-700 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {/* Rule or Fixed Value */}
                <div className="bg-muted/50 rounded px-2 py-1.5 font-mono text-[10px] text-muted-foreground mb-1.5">
                  {intervention.nodeRule 
                    ? `${intervention.nodeName} = ${intervention.nodeRule}`
                    : `${intervention.nodeName} = ${intervention.fixedValue} (fixed)`
                  }
                </div>

                {/* Outward Regulations Count */}
                {intervention.outwardRegulations.length > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    → Affects {intervention.outwardRegulations.length} node(s)
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Save Button */}
      {interventions.length > 0 && (
        <div className="mt-4">
          <Button
            onClick={handleSaveTherapies}
            className="w-full h-9 text-xs"
            disabled={isSaving}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {isSaving ? 'Saving...' : 'Save Interventions'}
          </Button>
        </div>
      )}

      <KnockInDialog
        open={knockInDialogOpen}
        onOpenChange={setKnockInDialogOpen}
        existingNodes={nodes}
        existingRules={rules}
        onKnockIn={handleKnockIn}
      />
    </div>
  );
}
