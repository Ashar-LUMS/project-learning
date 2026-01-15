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
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { KnockInDialog } from './KnockInDialog';
import { KnockOutDialog } from './KnockOutDialog';
import type { NetworkNode, TherapeuticIntervention } from '@/types/network';
import { Plus, X, Save, Syringe, ChevronsUpDown, Trash2, Power } from 'lucide-react';
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
  const [knockOutDialogOpen, setKnockOutDialogOpen] = useState(false);
  const [selectedInterventionType, setSelectedInterventionType] = useState<InterventionType>('knock-in');
  const [interventions, setInterventions] = useState<TherapeuticIntervention[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  // Sidebar state
  type PropertyItem = {
    name: string;
    value: string;
    extension: string;
  };

  type TargetedTherapyNode = {
    id: string;
    nodeId: string;
    modulationMode: string;
    value: string;
    extension: string;
  };

  const [therapyProperties, setTherapyProperties] = useState<Record<string, PropertyItem[]>>({
    'Chemotherapy': [
      { name: 'Dosage', value: '100', extension: 'mg' },
      { name: 'Frequency', value: '2', extension: 'times/day' },
      { name: 'Duration', value: '6', extension: 'weeks' },
    ],
    'Immunotherapy': [
      { name: 'Dose Level', value: '50', extension: 'mg/kg' },
      { name: 'Infusion Rate', value: '1.5', extension: 'ml/min' },
      { name: 'Cycles', value: '4', extension: 'cycles' },
    ],
    'Gene Therapy': [
      { name: 'Vector Dose', value: '1e12', extension: 'vg/kg' },
      { name: 'Expression Level', value: '80', extension: '%' },
      { name: 'Monitoring Period', value: '24', extension: 'weeks' },
    ],
  });

  const [targetedTherapyNodes, setTargetedTherapyNodes] = useState<TargetedTherapyNode[]>([
    { id: 'tt1', nodeId: '', modulationMode: 'inhibit', value: '100', extension: 'nM' },
  ]);

  const [selectedTherapy, setSelectedTherapy] = useState<string | null>(null);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const availableExtensions = [
    'mg', 'mg/kg', 'g', 'µg', 'ml', 'ml/min', 'L',
    'nM', 'µM', 'mM', '%', 'vg/kg',
    'times/day', 'times/week', 'days', 'weeks', 'months',
    'cycles', 'units', 'IU'
  ];

  const modulationModes = ['inhibit', 'activate', 'enhance', 'suppress', 'modulate'];

  const handleAddTargetedNode = () => {
    setTargetedTherapyNodes(prev => [
      ...prev,
      { 
        id: `tt${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
        nodeId: '', 
        modulationMode: 'inhibit', 
        value: '', 
        extension: 'nM' 
      }
    ]);
  };

  const handleRemoveTargetedNode = (id: string) => {
    setTargetedTherapyNodes(prev => prev.filter(node => node.id !== id));
  };

  const handleUpdateTargetedNode = (
    id: string,
    field: 'nodeId' | 'modulationMode' | 'value' | 'extension',
    value: string
  ) => {
    setTargetedTherapyNodes(prev =>
      prev.map(node => node.id === id ? { ...node, [field]: value } : node)
    );
  };

  useEffect(() => {
    if (existingTherapies && Array.isArray(existingTherapies)) {
      setInterventions(existingTherapies);
    } else {
      setInterventions([]);
    }
  }, [existingTherapies]);

  const handleAddProperty = (therapy: string) => {
    if (newPropertyName.trim()) {
      setTherapyProperties(prev => ({
        ...prev,
        [therapy]: [
          ...(prev[therapy] || []),
          { name: newPropertyName.trim(), value: '', extension: availableExtensions[0] }
        ]
      }));
      setNewPropertyName('');
    }
  };

  const handleRemoveProperty = (therapy: string, index: number) => {
    setTherapyProperties(prev => ({
      ...prev,
      [therapy]: prev[therapy].filter((_, i) => i !== index)
    }));
  };

  const handleUpdatePropertyValue = (therapy: string, index: number, value: string) => {
    setTherapyProperties(prev => ({
      ...prev,
      [therapy]: prev[therapy].map((prop, i) => 
        i === index ? { ...prop, value } : prop
      )
    }));
  };

  const handleUpdatePropertyExtension = (therapy: string, index: number, extension: string) => {
    setTherapyProperties(prev => ({
      ...prev,
      [therapy]: prev[therapy].map((prop, i) => 
        i === index ? { ...prop, extension } : prop
      )
    }));
  };

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

  const handleKnockOut = (knockOutData: {
    nodeName: string;
    nodeRule: null;
    fixedValue: 0;
    outwardRegulations: Array<{
      targetNode: string;
      operator: '&&' | '||';
      addition: string;
      originalRule?: string;
    }>;
  }) => {
    const newIntervention: TherapeuticIntervention = {
      id: `knockout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'knock-out',
      ...knockOutData,
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
    <>
      {/* Main Content */}
      <div className="flex flex-col h-full">
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
              } else if (selectedInterventionType === 'knock-out') {
                setKnockOutDialogOpen(true);
              }
              // TODO: Handle edge intervention types
            }}
            size="sm"
            className="h-8 text-xs px-3"
            disabled={selectedInterventionType !== 'knock-in' && selectedInterventionType !== 'knock-out'}
            title={selectedInterventionType !== 'knock-in' && selectedInterventionType !== 'knock-out' ? 'Coming Soon' : undefined}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>

        {/* Interventions List */}
        <div className="space-y-2 flex-1 overflow-y-auto">
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
              {interventions.map((intervention, index) => {
                const isKnockOut = intervention.type === 'knock-out';
                return (
                  <div
                    key={intervention.id}
                    className={`bg-card rounded-lg border border-l-4 ${isKnockOut ? 'border-l-red-500' : 'border-l-blue-500'} p-3 text-xs`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Badge className={`${isKnockOut ? 'bg-red-600' : 'bg-blue-600'} text-[10px] px-1.5 py-0 h-4`}>
                          #{index + 1}
                        </Badge>
                        {isKnockOut && <Power className="w-3 h-3 text-red-500" />}
                        <span className="font-semibold">{intervention.nodeName}</span>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${isKnockOut ? 'text-red-600 border-red-300' : 'text-blue-600 border-blue-300'}`}>
                          {isKnockOut ? 'Knock-Out' : 'Knock-In'}
                        </Badge>
                      </div>
                      <button
                        onClick={() => handleRemoveIntervention(intervention.id)}
                        className="text-red-500 hover:text-red-700 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {/* Rule or Fixed Value */}
                    <div className={`${isKnockOut ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/50'} rounded px-2 py-1.5 font-mono text-[10px] ${isKnockOut ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'} mb-1.5`}>
                      {isKnockOut
                        ? `${intervention.nodeName} = 0 (FORCED OFF)`
                        : intervention.nodeRule 
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
                );
              })}
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
      </div>

      {/* Collapsible Sidebar - Right Side */}
      <div 
        className={`fixed right-0 top-46 bottom-0 border-l bg-background flex flex-col z-40 transition-all duration-300 ease-in-out shadow-lg overflow-hidden ${
          isSidebarCollapsed ? 'w-10' : 'w-72'
        }`}
      >
        {/* Collapse/Expand Button */}
        <div className="flex items-center justify-between px-2 py-2 border-b bg-muted/30 flex-shrink-0">
          <h4 className={`text-xs font-semibold transition-opacity duration-200 truncate ${
            isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
          }`}>
            Therapy Properties
          </h4>
          <Button 
            variant="ghost" 
            size="icon" 
            className="size-7 h-7 w-7 p-0 flex-shrink-0 ml-1" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronsUpDown className={`size-3.5 transition-transform duration-300 ${
              isSidebarCollapsed ? 'rotate-90' : ''
            }`} />
            <span className="sr-only">{isSidebarCollapsed ? 'Expand' : 'Collapse'}</span>
          </Button>
        </div>

        {!isSidebarCollapsed && (
        <Collapsible defaultOpen className="flex flex-col flex-1 overflow-hidden">

          <CollapsibleContent className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {Object.entries(therapyProperties).map(([therapy, properties]) => (
                <Collapsible key={therapy} defaultOpen className="border rounded-md text-xs">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start h-6 text-xs font-medium px-1"
                        onClick={() => setSelectedTherapy(selectedTherapy === therapy ? null : therapy)}
                      >
                        <ChevronsUpDown className="size-2.5 mr-1 flex-shrink-0" />
                        <span className="truncate text-left">{therapy}</span>
                      </Button>
                    </CollapsibleTrigger>
                    <Badge variant="outline" className="text-[10px]">
                      {properties.length}
                    </Badge>
                  </div>

                  <CollapsibleContent className="px-2 py-1 border-t space-y-1">
                    {properties.length === 0 ? (
                      <p className="text-[9px] text-muted-foreground italic">No properties</p>
                    ) : (
                      <div className="space-y-1">
                        {properties.map((prop, idx) => (
                          <div
                            key={idx}
                            className="border rounded p-1 bg-background group"
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[9px] font-medium text-muted-foreground truncate">
                                {prop.name}
                              </span>
                              <button
                                onClick={() => handleRemoveProperty(therapy, idx)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-red-500 hover:text-red-700 flex-shrink-0"
                              >
                                <Trash2 className="size-2.5" />
                              </button>
                            </div>
                            <div className="flex gap-0.5">
                              <Input
                                placeholder="Val"
                                value={prop.value}
                                onChange={(e) => handleUpdatePropertyValue(therapy, idx, e.target.value)}
                                className="h-5 text-xs flex-1 px-1 py-0.5"
                              />
                              <Select
                                value={prop.extension}
                                onValueChange={(value) => handleUpdatePropertyExtension(therapy, idx, value)}
                              >
                                <SelectTrigger className="h-5 w-14 text-[8px] px-0.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableExtensions.map((ext) => (
                                    <SelectItem key={ext} value={ext} className="text-xs">
                                      {ext}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedTherapy === therapy && (
                      <div className="flex gap-0.5 pt-0.5 border-t mt-0.5">
                        <Input
                          placeholder="Name"
                          value={newPropertyName}
                          onChange={(e) => setNewPropertyName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddProperty(therapy);
                            }
                          }}
                          className="h-5 text-xs px-1 py-0.5"
                        />
                        <Button
                          onClick={() => handleAddProperty(therapy)}
                          size="sm"
                          className="h-5 px-1"
                          variant="default"
                        >
                          <Plus className="size-2" />
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}

              {/* Targeted Therapy Section */}
              <Collapsible defaultOpen className="border rounded-md text-xs">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 justify-start h-6 text-xs font-medium px-1"
                      onClick={() => setSelectedTherapy(selectedTherapy === 'Targeted Therapy' ? null : 'Targeted Therapy')}
                    >
                      <ChevronsUpDown className="size-2.5 mr-1 flex-shrink-0" />
                      <span className="truncate text-left">Targeted Therapy</span>
                    </Button>
                  </CollapsibleTrigger>
                  <Badge variant="outline" className="text-[10px]">
                    {targetedTherapyNodes.length}
                  </Badge>
                </div>

                <CollapsibleContent className="px-2 py-1 border-t space-y-1">
                  {targetedTherapyNodes.length === 0 ? (
                    <p className="text-[9px] text-muted-foreground italic">No target nodes</p>
                  ) : (
                    <div className="space-y-1">
                      {targetedTherapyNodes.map((targetNode) => (
                        <div
                          key={targetNode.id}
                          className="border rounded p-1 bg-background group"
                        >
                          <div className="flex items-center gap-0.5">
                            {/* Target Node Dropdown */}
                            <Select
                              value={targetNode.nodeId}
                              onValueChange={(value) => handleUpdateTargetedNode(targetNode.id, 'nodeId', value)}
                            >
                              <SelectTrigger className="h-5 text-xs flex-1 px-1 py-0.5">
                                <SelectValue placeholder="Node" />
                              </SelectTrigger>
                              <SelectContent>
                                {nodes.map((node) => (
                                  <SelectItem key={node.id} value={node.id} className="text-xs">
                                    {node.label || node.id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Modulation Mode Dropdown */}
                            <Select
                              value={targetNode.modulationMode}
                              onValueChange={(value) => handleUpdateTargetedNode(targetNode.id, 'modulationMode', value)}
                            >
                              <SelectTrigger className="h-5 text-xs w-20 px-1 py-0.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {modulationModes.map((mode) => (
                                  <SelectItem key={mode} value={mode} className="text-xs">
                                    {mode}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Value Input */}
                            <Input
                              placeholder="Val"
                              value={targetNode.value}
                              onChange={(e) => handleUpdateTargetedNode(targetNode.id, 'value', e.target.value)}
                              className="h-5 text-xs w-16 px-1 py-0.5"
                            />

                            {/* Extension Dropdown */}
                            <Select
                              value={targetNode.extension}
                              onValueChange={(value) => handleUpdateTargetedNode(targetNode.id, 'extension', value)}
                            >
                              <SelectTrigger className="h-5 w-14 text-[8px] px-0.5 py-0.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableExtensions.map((ext) => (
                                  <SelectItem key={ext} value={ext} className="text-xs">
                                    {ext}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Remove Button */}
                            <button
                              onClick={() => handleRemoveTargetedNode(targetNode.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-red-500 hover:text-red-700 flex-shrink-0"
                            >
                              <Trash2 className="size-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Target Node Button */}
                  <div className="flex gap-0.5 pt-0.5 border-t mt-0.5">
                    <Button
                      onClick={handleAddTargetedNode}
                      size="sm"
                      className="h-5 px-1 flex-1"
                      variant="default"
                    >
                      <Plus className="size-2 mr-0.5" />
                      Add Target
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CollapsibleContent>
        </Collapsible>
        )}
      </div>

      <KnockInDialog
        open={knockInDialogOpen}
        onOpenChange={setKnockInDialogOpen}
        existingNodes={nodes}
        existingRules={rules}
        onKnockIn={handleKnockIn}
      />

      <KnockOutDialog
        open={knockOutDialogOpen}
        onOpenChange={setKnockOutDialogOpen}
        existingNodes={nodes}
        existingRules={rules}
        onKnockOut={handleKnockOut}
      />
    </>
  );
}
