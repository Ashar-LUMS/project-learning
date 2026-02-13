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

  type GroupTherapy = {
    id: string;
    name: string;
    members: string[]; // node ids
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
  });

  const [targetedTherapyNodes, setTargetedTherapyNodes] = useState<TargetedTherapyNode[]>([
    { id: 'tt1', nodeId: '', modulationMode: 'inhibit', value: '100', extension: 'nM' },
  ]);

  const [selectedTherapy, setSelectedTherapy] = useState<string | null>(null);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [groupTherapies, setGroupTherapies] = useState<GroupTherapy[]>([]);

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

  // Group therapy handlers
  const handleAddGroupTherapy = () => {
    setGroupTherapies(prev => ([
      ...prev,
      {
        id: `gt${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: 'Group Therapy',
        members: [''],
        modulationMode: 'modulate',
        value: '',
        extension: availableExtensions[0]
      }
    ]));
  };

  const handleRemoveGroupTherapy = (id: string) => {
    setGroupTherapies(prev => prev.filter(g => g.id !== id));
  };

  const handleUpdateGroupTherapy = (
    id: string,
    field: 'name' | 'modulationMode' | 'value' | 'extension',
    value: string
  ) => {
    setGroupTherapies(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const handleUpdateGroupMember = (id: string, index: number, nodeId: string) => {
    setGroupTherapies(prev => prev.map(g => {
      if (g.id !== id) return g;
      const members = [...g.members];
      members[index] = nodeId;
      return { ...g, members };
    }));
  };

  const handleAddGroupMember = (id: string) => {
    setGroupTherapies(prev => prev.map(g => g.id === id ? { ...g, members: [...g.members, ''] } : g));
  };

  const handleRemoveGroupMember = (id: string, index: number) => {
    setGroupTherapies(prev => prev.map(g => {
      if (g.id !== id) return g;
      const members = g.members.filter((_, i) => i !== index);
      return { ...g, members };
    }));
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
                        <Badge className={`${isKnockOut ? 'bg-red-600' : 'bg-blue-600'} text-xs px-1.5 py-0 h-4`}>
                          #{index + 1}
                        </Badge>
                        {isKnockOut && <Power className="w-3 h-3 text-red-500" />}
                        <span className="font-semibold">{intervention.nodeName}</span>
                        <Badge variant="outline" className={`text-xs px-1 py-0 ${isKnockOut ? 'text-red-600 border-red-300' : 'text-blue-600 border-blue-300'}`}>
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
                    <div className={`${isKnockOut ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/50'} rounded px-2 py-1.5 font-mono text-xs ${isKnockOut ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'} mb-1.5`}>
                      {isKnockOut
                        ? `${intervention.nodeName} = 0 (FORCED OFF)`
                        : intervention.nodeRule 
                          ? `${intervention.nodeName} = ${intervention.nodeRule}`
                          : `${intervention.nodeName} = ${intervention.fixedValue} (fixed)`
                      }
                    </div>

                    {/* Outward Regulations Count */}
                    {intervention.outwardRegulations.length > 0 && (
                      <div className="text-xs text-muted-foreground">
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
        className={`fixed right-0 top-44 bottom-0 border-l bg-background flex flex-col z-40 transition-all duration-300 ease-in-out shadow-lg overflow-hidden ${
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
          <div className="flex items-center gap-1">
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
        </div>

        {!isSidebarCollapsed && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Therapy Type Buttons */}
            <div className="p-2 space-y-1.5 border-b">
              <Button
                variant={selectedTherapy === 'Chemotherapy' ? 'default' : 'outline'}
                size="sm"
                className={`w-full justify-start h-8 text-xs ${
                  selectedTherapy === 'Chemotherapy' 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950'
                }`}
                onClick={() => setSelectedTherapy(selectedTherapy === 'Chemotherapy' ? null : 'Chemotherapy')}
              >
                Chemotherapy
              </Button>
              <Button
                variant={selectedTherapy === 'Immunotherapy' ? 'default' : 'outline'}
                size="sm"
                className={`w-full justify-start h-8 text-xs ${
                  selectedTherapy === 'Immunotherapy' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950'
                }`}
                onClick={() => setSelectedTherapy(selectedTherapy === 'Immunotherapy' ? null : 'Immunotherapy')}
              >
                Immunotherapy
              </Button>
              <Button
                variant={selectedTherapy === 'Targeted Therapy' ? 'default' : 'outline'}
                size="sm"
                className={`w-full justify-start h-8 text-xs ${
                  selectedTherapy === 'Targeted Therapy' 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                    : 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950'
                }`}
                onClick={() => setSelectedTherapy(selectedTherapy === 'Targeted Therapy' ? null : 'Targeted Therapy')}
              >
                Targeted Therapy
              </Button>
            </div>

            {/* Properties Panel */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {selectedTherapy === null ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Syringe className="w-6 h-6 opacity-20 mb-2" />
                  <p className="text-xs">Select a therapy type</p>
                  <p className="text-xs opacity-60">to view and edit properties</p>
                </div>
              ) : selectedTherapy === 'Targeted Therapy' ? (
                /* Targeted Therapy Properties */
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">Target Nodes</span>
                    <Badge variant="outline" className="text-xs">
                      {targetedTherapyNodes.length}
                    </Badge>
                  </div>

                  {targetedTherapyNodes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No target nodes</p>
                  ) : (
                    <div className="space-y-2">
                      {targetedTherapyNodes.map((targetNode) => (
                        <div
                          key={targetNode.id}
                          className="border rounded p-2 bg-background group"
                        >
                          <div className="flex flex-col gap-1.5">
                            {/* Target Node Dropdown */}
                            <Select
                              value={targetNode.nodeId}
                              onValueChange={(value) => handleUpdateTargetedNode(targetNode.id, 'nodeId', value)}
                            >
                              <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue placeholder="Select node" />
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
                              <SelectTrigger className="h-7 text-xs w-full">
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

                            {/* Value and Extension Row */}
                            <div className="flex gap-1">
                              <Input
                                placeholder="Value"
                                value={targetNode.value}
                                onChange={(e) => handleUpdateTargetedNode(targetNode.id, 'value', e.target.value)}
                                className="h-7 text-xs flex-1"
                              />
                              <Select
                                value={targetNode.extension}
                                onValueChange={(value) => handleUpdateTargetedNode(targetNode.id, 'extension', value)}
                              >
                                <SelectTrigger className="h-7 w-20 text-xs">
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

                            {/* Remove Button */}
                            <div className="flex justify-end">
                              <button
                                onClick={() => handleRemoveTargetedNode(targetNode.id)}
                                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 text-red-500 hover:text-red-700 rounded"
                                aria-label="Remove targeted node"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Target Button */}
                  <div className="pt-2 border-t mt-2">
                    <Button
                      onClick={handleAddTargetedNode}
                      size="sm"
                      className="h-7 text-xs w-full"
                      variant="secondary"
                    >
                      <Plus className="size-3 mr-1" />
                      Add Target
                    </Button>
                  </div>

                  {/* Group Therapies */}
                  <div className="space-y-2 pt-3 border-t mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">Group Therapies</span>
                      <Badge variant="outline" className="text-xs">
                        {groupTherapies.length}
                      </Badge>
                    </div>

                    {groupTherapies.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No group therapies</p>
                    ) : (
                      groupTherapies.map((g) => (
                        <div key={g.id} className="border rounded p-2 bg-background">
                          <div className="flex items-center justify-between mb-1.5">
                            <Input
                              placeholder="Group name"
                              value={g.name}
                              onChange={(e) => handleUpdateGroupTherapy(g.id, 'name', e.target.value)}
                              className="h-7 text-xs flex-1 mr-1"
                            />
                            <button
                              onClick={() => handleRemoveGroupTherapy(g.id)}
                              className="p-1 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>

                          {/* Members */}
                          <div className="space-y-1.5 mb-2">
                            <span className="text-xs text-muted-foreground">Members:</span>
                            {g.members.map((memberId, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <Select
                                  value={memberId}
                                  onValueChange={(value) => handleUpdateGroupMember(g.id, idx, value)}
                                >
                                  <SelectTrigger className="h-7 text-xs w-full">
                                    <SelectValue placeholder="Select node" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {nodes.map((node) => (
                                      <SelectItem key={node.id} value={node.id} className="text-xs">
                                        {node.label || node.id}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => handleRemoveGroupMember(g.id, idx)}
                                  title="Remove member"
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              onClick={() => handleAddGroupMember(g.id)}
                              size="sm"
                              className="h-7 text-xs w-full"
                              variant="outline"
                            >
                              <Plus className="size-3 mr-1" />
                              Add Member
                            </Button>
                          </div>

                          {/* Group modifiers */}
                          <div className="space-y-1.5">
                            <Select
                              value={g.modulationMode}
                              onValueChange={(value) => handleUpdateGroupTherapy(g.id, 'modulationMode', value)}
                            >
                              <SelectTrigger className="h-7 text-xs w-full">
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

                            <div className="flex gap-1">
                              <Input
                                placeholder="Value"
                                value={g.value}
                                onChange={(e) => handleUpdateGroupTherapy(g.id, 'value', e.target.value)}
                                className="h-7 text-xs flex-1"
                              />
                              <Select
                                value={g.extension}
                                onValueChange={(value) => handleUpdateGroupTherapy(g.id, 'extension', value)}
                              >
                                <SelectTrigger className="h-7 w-20 text-xs">
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
                        </div>
                      ))
                    )}

                    {/* Add Group Button */}
                    <Button
                      onClick={handleAddGroupTherapy}
                      size="sm"
                      className="h-7 text-xs w-full mt-2"
                      variant="secondary"
                    >
                      <Plus className="size-3 mr-1" />
                      Add Group
                    </Button>
                  </div>
                </div>
              ) : (
                /* Chemotherapy / Immunotherapy Properties */
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">Properties</span>
                    <Badge variant="outline" className="text-xs">
                      {(therapyProperties[selectedTherapy] || []).length}
                    </Badge>
                  </div>

                  {(therapyProperties[selectedTherapy] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No properties</p>
                  ) : (
                    <div className="space-y-2">
                      {(therapyProperties[selectedTherapy] || []).map((prop, idx) => (
                        <div
                          key={idx}
                          className="border rounded p-2 bg-background group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-muted-foreground truncate">
                              {prop.name}
                            </span>
                            <button
                              onClick={() => handleRemoveProperty(selectedTherapy, idx)}
                              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-0.5 text-red-500 hover:text-red-700 rounded"
                              aria-label={`Remove ${prop.name} property`}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                          <div className="flex gap-1">
                            <Input
                              placeholder="Value"
                              value={prop.value}
                              onChange={(e) => handleUpdatePropertyValue(selectedTherapy, idx, e.target.value)}
                              className="h-7 text-xs flex-1"
                            />
                            <Select
                              value={prop.extension}
                              onValueChange={(value) => handleUpdatePropertyExtension(selectedTherapy, idx, value)}
                            >
                              <SelectTrigger className="h-7 w-20 text-xs">
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

                  {/* Add Property */}
                  <div className="flex gap-1 pt-2 border-t mt-2">
                    <Input
                      placeholder="Property name"
                      value={newPropertyName}
                      onChange={(e) => setNewPropertyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddProperty(selectedTherapy);
                        }
                      }}
                      className="h-7 text-xs"
                    />
                    <Button
                      onClick={() => handleAddProperty(selectedTherapy)}
                      size="sm"
                      className="h-7 px-2"
                      variant="secondary"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
