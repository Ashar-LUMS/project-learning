import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import cytoscape, { type Core, type StylesheetCSS } from "cytoscape";
import { supabase } from '../../supabaseClient';
import { useNetworkData } from '../../hooks/useNetworkData';
export { useNetworkData } from '../../hooks/useNetworkData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import RuleBasedGraph, { type RuleSet } from './RuleBasedGraph';

type Node = {
  id: string;
  type: string;
  label: string;
  weight?: number;
  properties?: {
    centrality?: number;
    degree?: number;
    [key: string]: any;
  };
};

type Edge = {
  source: string;
  target: string;
  interaction?: string;
  weight?: number;
  properties?: {
    capacity?: number;
    [key: string]: any;
  };
};

type Props = {
  networkId?: string | null;
  height?: number | string;
  refreshToken?: number;
  projectId?: string | null;
  onSaved?: (network: { id: string; name: string; created_at: string | null; data: any }) => void;
};

type GraphMode = 'weight-based' | 'rule-based';

const NetworkGraph: React.FC<Props> = ({ networkId, refreshToken = 0, projectId = null, onSaved }) => {
  const [manualRefresh, setManualRefresh] = useState(0);
  const effectiveRefresh = (refreshToken ?? 0) + manualRefresh;
  const { data: network, isLoading, error } = useNetworkData(
    networkId ?? undefined,
    effectiveRefresh
  );
  
  useEffect(() => {
    setManualRefresh((p) => p + 1);
  }, [networkId]);
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [tool, setTool] = useState<'select' | 'add-node' | 'add-edge' | 'delete'>('select');
  const toolRef = useRef(tool);
  
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const edgeSourceRef = useRef<string | null>(null);
  
  useEffect(() => { 
    edgeSourceRef.current = edgeSourceId; 
  }, [edgeSourceId]);
  
  const nodeCounterRef = useRef(0);
  const ehRef = useRef<any>(null);
  const [ehLoaded, setEhLoaded] = useState(false);
  const [ehEnabled, setEhEnabled] = useState(false);
  const [newNodeDraft, setNewNodeDraft] = useState<{
    modelPos: { x: number; y: number };
    label: string;
    type: string;
    weight?: number;
  } | null>(null);

  // Rule-based graph state
  const [graphMode, setGraphMode] = useState<GraphMode>('weight-based');
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [activeRuleSet, setActiveRuleSet] = useState<RuleSet | null>(null);
  const [isApplyingRules, setIsApplyingRules] = useState(false);

  // Default weights
  const defaultNodeWeight = 1;
  const defaultEdgeWeight = 1;
  
  // State for tracking modifications
  const [localNodes, setLocalNodes] = useState<Node[]>([]);
  const [localEdges, setLocalEdges] = useState<Edge[]>([]);
  const [deletedNodeIds, setDeletedNodeIds] = useState<Set<string>>(new Set());
  const [deletedEdgeIds, setDeletedEdgeIds] = useState<Set<string>>(new Set());

  // Get the current network data with all modifications applied
  const getCurrentNetworkData = useMemo(() => {
    const fetchedNodes = (network && (Array.isArray((network as any).nodes) ? (network as any).nodes : Array.isArray((network as any).data?.nodes) ? (network as any).data.nodes : [])) || [];
    const fetchedEdges = (network && (Array.isArray((network as any).edges) ? (network as any).edges : Array.isArray((network as any).data?.edges) ? (network as any).data.edges : [])) || [];

    const currentNodes = [
      ...fetchedNodes.filter((n: any) => n && typeof n.id === 'string' && !deletedNodeIds.has(n.id)),
      ...localNodes
    ];

    const currentEdges = [
      ...fetchedEdges.filter((e: any) => e && typeof e.source === 'string' && typeof e.target === 'string' && !deletedEdgeIds.has(`e-${e.source}-${e.target}`)),
      ...localEdges
    ];

    return { nodes: currentNodes, edges: currentEdges };
  }, [network, localNodes, localEdges, deletedNodeIds, deletedEdgeIds]);

  // UPDATED: Include weight data in elements
  const elements = useMemo(() => {
    const { nodes, edges } = getCurrentNetworkData;

    const nodeElems = nodes.map((n: any) => ({
      data: { 
        id: n.id, 
        label: n.label ?? n.id, 
        type: n.type ?? 'custom',
        weight: n.weight ?? defaultNodeWeight,
        properties: n.properties || {}
      },
    }));
    
    const edgeElems = edges.map((e: any, idx: number) => ({
      data: {
        id: `e-${idx}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        interaction: e.interaction,
        weight: e.weight ?? defaultEdgeWeight,
        properties: e.properties || {}
      },
    }));

    return [...nodeElems, ...edgeElems];
  }, [getCurrentNetworkData]);

  const typeColors = useMemo(() => {
    const nodeTypes = new Set<string>();
    elements.forEach(e => {
      if (e.data && !('source' in e.data)) {
        nodeTypes.add((e.data as any).type || 'custom');
      }
    });
    const map = new Map<string, string>();
    Array.from(nodeTypes).forEach((t, i) => {
      const hue = (i * 137) % 360;
      map.set(t, `hsl(${hue}, 70%, 50%)`);
    });
    return map;
  }, [elements]);

  // Function to delete a node and its connected edges
  const deleteNode = (nodeId: string) => {
    if (!cyRef.current) return;

    const isLocalNode = localNodes.some(n => n.id === nodeId);
    
    if (isLocalNode) {
      setLocalNodes(prev => prev.filter(n => n.id !== nodeId));
      setLocalEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    } else {
      setDeletedNodeIds(prev => new Set([...prev, nodeId]));
      if (cyRef.current) {
        const node = cyRef.current.getElementById(nodeId);
        if (node) {
          const connectedEdges = node.connectedEdges();
          connectedEdges.forEach((edge: any) => {
            const source = edge.data('source');
            const target = edge.data('target');
            setDeletedEdgeIds(prev => new Set([...prev, `e-${source}-${target}`]));
          });
        }
      }
    }

    const node = cyRef.current.getElementById(nodeId);
    if (node) {
      node.connectedEdges().remove();
      node.remove();
    }

    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }

    if (edgeSourceId === nodeId) {
      setEdgeSourceId(null);
    }
  };

  // Save network function
  const saveNetwork = async (isUpdate: boolean = false) => {
    try {
      const { nodes, edges } = getCurrentNetworkData;
      const payload = { nodes, edges };

      if (isUpdate && networkId) {
        const { data, error } = await supabase
          .from('networks')
          .update({ network_data: payload })
          .eq('id', networkId)
          .select()
          .single();

        if (error) {
          console.error('Failed to update network', error);
          window.alert('Failed to update network: ' + (error.message || String(error)));
        } else {
          console.log('Updated network', data);
          const updatedNetwork = { 
            id: data.id as string, 
            name: data.name as string, 
            created_at: data.created_at ?? null, 
            data: data.network_data ?? null 
          };
          try { onSaved?.(updatedNetwork); } catch (e) {}
          window.alert('Network updated successfully');
        }
      } else {
        const name = window.prompt('Save network as (name):', `network-${Date.now()}`);
        if (!name) return;

        const { data, error } = await supabase
          .from('networks')
          .insert({ name, network_data: payload })
          .select()
          .single();

        if (error) {
          console.error('Failed to save network', error);
          window.alert('Failed to save network: ' + (error.message || String(error)));
        } else {
          console.log('Saved network', data);
          const newNetwork = { 
            id: data.id as string, 
            name: data.name as string, 
            created_at: data.created_at ?? null, 
            data: data.network_data ?? null 
          };
          try { onSaved?.(newNetwork); } catch (e) {}
          
          try {
            const newNetworkId = data.id as string;
            if (projectId) {
              const { data: projRow, error: projErr } = await supabase
                .from('projects')
                .select('networks')
                .eq('id', projectId)
                .maybeSingle();
              if (projErr) throw projErr;
              const currentIds = Array.isArray(projRow?.networks) ? projRow.networks.filter((id: any) => typeof id === 'string') : [];
              const updatedIds = Array.from(new Set([...(currentIds || []), newNetworkId]));
              const { error: updateErr } = await supabase.from('projects').update({ networks: updatedIds }).eq('id', projectId);
              if (updateErr) throw updateErr;
            }
          } catch (linkErr: any) {
            console.warn('Saved network but failed to link to project', linkErr);
          }
          window.alert('Network saved successfully');
        }
      }
    } catch (err: any) {
      console.error('Save network error', err);
      window.alert('Save failed: ' + String(err?.message || err));
    }
  };

  // Apply rule set function - FIXED
  const applyRuleSet = useCallback((ruleSet: RuleSet) => {
    if (isApplyingRules || !cyRef.current) return;
    
    setIsApplyingRules(true);
    setActiveRuleSet(ruleSet);
    setShowRuleEditor(false);
    
    const cy = cyRef.current;
    
    // Reset all styling first by re-applying the default stylesheet
    const defaultStylesheet: StylesheetCSS[] = [
      {
        selector: 'node',
        css: {
          'background-color': (ele: any) => typeColors.get(ele.data('type')) || '#6b7280',
          'label': 'data(label)',
          'color': '#111827',
          'font-size': 14,
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 50,
          'height': 50,
          'border-width': 3,
          'border-color': '#ffffff',
        },
      },
      {
        selector: 'edge',
        css: {
          'width': 4,
          'line-color': '#9ca3af',
          'target-arrow-color': '#9ca3af',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 1.2,
        },
      },
      {
        selector: '.edge-source',
        css: {
          'border-color': '#f59e0b',
          'border-width': 4,
        },
      },
      {
        selector: '.delete-candidate',
        css: {
          'border-color': '#ef4444',
          'border-width': 4,
          'background-color': '#fee2e2',
        },
      },
      {
        selector: ':selected',
        css: {
          'border-width': 4,
          'border-color': '#3b82f6',
          'line-color': '#3b82f6',
          'target-arrow-color': '#3b82f6',
        },
      },
      {
        selector: '.faded',
        
        css: {
          'opacity': 0.2
        }
      }
    ];
    
    // Apply the default stylesheet
    cy.style(defaultStylesheet);
    cy.elements().removeClass('faded');
    cy.nodes().style('display', 'element');
    
    try {
      const enabledRules = ruleSet.rules.filter(rule => rule.enabled);
      
      enabledRules.sort((a, b) => a.priority - b.priority).forEach(rule => {
        try {
          // Create evaluation context
          const context = {
            highlightNode: (node: any, color: string) => {
              node.style('background-color', color);
              node.style('border-color', color);
            },
            setNodeSize: (node: any, size: number) => {
              node.style('width', size);
              node.style('height', size);
            },
            setNodeColor: (node: any, color: string) => {
              node.style('background-color', color);
            },
            setEdgeWidth: (edge: any, width: number) => {
              edge.style('width', Math.min(width, 20));
            },
            setEdgeColor: (edge: any, color: string) => {
              edge.style('line-color', color);
              edge.style('target-arrow-color', color);
            },
            showNeighbors: (node: any) => {
              const neighborhood = node.closedNeighborhood();
              cy.elements().removeClass('faded');
              cy.elements().not(neighborhood).addClass('faded');
            },
            hideUnconnectedNodes: () => {
              const connectedNodes = cy.edges().connectedNodes();
              cy.nodes().forEach((node: any) => {
                if (!connectedNodes.contains(node)) {
                  node.style('display', 'none');
                }
              });
            }
          };

          // Apply rule based on target
          if (rule.target === 'nodes' || rule.target === 'both') {
            cy.nodes().forEach((node: any) => {
              const nodeData = node.data();
              
              try {
                const conditionMet = new Function(
                  'node', 'edge', 'graph', 
                  `return ${rule.condition}`
                )(nodeData, null, cy);
                
                if (conditionMet) {
                  new Function(
                    'node', 'edge', 'graph', 'highlightNode', 'setNodeSize', 'setNodeColor', 
                    'setEdgeWidth', 'setEdgeColor', 'showNeighbors', 'hideUnconnectedNodes',
                    rule.action
                  )(
                    nodeData, null, cy, 
                    context.highlightNode, context.setNodeSize, context.setNodeColor, 
                    context.setEdgeWidth, context.setEdgeColor, context.showNeighbors, context.hideUnconnectedNodes
                  );
                }
              } catch (error) {
                console.warn(`Error applying rule "${rule.name}" to node ${nodeData.id}:`, error);
              }
            });
          }

          if (rule.target === 'edges' || rule.target === 'both') {
            cy.edges().forEach((edge: any) => {
              const edgeData = edge.data();
              
              try {
                const conditionMet = new Function(
                  'node', 'edge', 'graph',
                  `return ${rule.condition}`
                )(null, edgeData, cy);
                
                if (conditionMet) {
                  new Function(
                    'node', 'edge', 'graph', 'setEdgeWidth', 'setEdgeColor',
                    rule.action
                  )(null, edgeData, cy, context.setEdgeWidth, context.setEdgeColor);
                }
              } catch (error) {
                console.warn(`Error applying rule "${rule.name}" to edge ${edgeData.id}:`, error);
              }
            });
          }

        } catch (error) {
          console.error(`Error processing rule "${rule.name}":`, error);
        }
      });
    } catch (error) {
      console.error('Error applying rule set:', error);
    } finally {
      setIsApplyingRules(false);
    }
  }, [isApplyingRules, typeColors]);

  // Handle node creation
  const handleAddNodeWithMode = (evt: any) => {
    if (toolRef.current === 'add-node') {
      const pos = evt.position || evt.renderedPosition || { x: 0, y: 0 };
      setNewNodeDraft({ 
        modelPos: { x: pos.x, y: pos.y }, 
        label: `Node ${nodeCounterRef.current + 1}`,
        type: 'custom',
        weight: defaultNodeWeight
      });
    }
  };

  // Reset all local modifications
  const resetModifications = () => {
    setLocalNodes([]);
    setLocalEdges([]);
    setDeletedNodeIds(new Set());
    setDeletedEdgeIds(new Set());
    setManualRefresh(prev => prev + 1);
  };

  // Reset to weight-based mode
  const resetToWeightBased = () => {
    setGraphMode('weight-based');
    setShowRuleEditor(false);
    setActiveRuleSet(null);
    if (cyRef.current) {
      // Re-apply default styles
      cyRef.current.style([
        {
          selector: 'node',
          style: {
            'background-color': (ele: any) => typeColors.get(ele.data('type')) || '#6b7280',
            'label': 'data(label)',
            'color': '#111827',
            'font-size': 14,
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 50,
            'height': 50,
            'border-width': 3,
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 4,
            'line-color': '#9ca3af',
            'target-arrow-color': '#9ca3af',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2,
          },
        },
        {
          selector: '.edge-source',
          style: {
            'border-color': '#f59e0b',
            'border-width': 4,
          },
        },
        {
          selector: '.delete-candidate',
          style: {
            'border-color': '#ef4444',
            'border-width': 4,
            'background-color': '#fee2e2',
          },
        },
        {
          selector: ':selected',
          style: {
            'border-width': 4,
            'border-color': '#3b82f6',
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
          },
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.2
          }
        }
      ]);
      cyRef.current.elements().removeClass('faded');
      cyRef.current.nodes().style('display', 'element');
    }
  };

  // Cytoscape initialization
  useEffect(() => {
    if (!containerRef.current) return;

    console.log('[NetworkGraph] Initializing cytoscape with elements:', elements.length);

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    try {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: elements as any,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': (ele: any) => typeColors.get(ele.data('type')) || '#6b7280',
              'label': 'data(label)',
              'color': '#111827',
              'font-size': 14,
              'text-valign': 'center',
              'text-halign': 'center',
              'width': 50,
              'height': 50,
              'border-width': 3,
              'border-color': '#ffffff',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 4,
              'line-color': '#9ca3af',
              'target-arrow-color': '#9ca3af',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 1.2,
            },
          },
          {
            selector: '.edge-source',
            style: {
              'border-color': '#f59e0b',
              'border-width': 4,
            },
          },
          {
            selector: '.delete-candidate',
            style: {
              'border-color': '#ef4444',
              'border-width': 4,
              'background-color': '#fee2e2',
            },
          },
          {
            selector: ':selected',
            style: {
              'border-width': 4,
              'border-color': '#3b82f6',
              'line-color': '#3b82f6',
              'target-arrow-color': '#3b82f6',
            },
          },
          {
            selector: '.faded',
            style: {
              'opacity': 0.2
            }
          }
        ],
        layout: { 
          name: 'cose',
          animate: true,
          fit: true,
          padding: 60,
        },
        wheelSensitivity: 0.2,
      });

      const cy = cyRef.current;

      // Load edgehandles
      (async () => {
        try {
          const ehModule = await import('cytoscape-edgehandles');
          const initializer = (ehModule && (ehModule.default || ehModule)) as any;
          if (typeof initializer === 'function') {
            initializer(cytoscape);
            try {
              ehRef.current = (cy as any).edgehandles({
                preview: true,
                hoverDelay: 150,
                handleNodes: 'node',
                handlePosition: 'middle top',
                handleSize: 10,
                handleColor: '#f59e0b',
                handleOutlineColor: '#ffffff',
                edgeType: function() { return 'flat'; },
                complete: (sourceNode: any, targetNode: any) => {
                  try {
                    const src = String(sourceNode.id());
                    const tgt = String(targetNode.id());
                    const maybeExisting = cy.edges().filter((e: any) => String(e.data('source')) === src && String(e.data('target')) === tgt);
                    if (!maybeExisting || maybeExisting.length === 0) {
                      const newEdgeId = `eh-e-${Date.now()}`;
                      try { cy.add({ group: 'edges', data: { id: newEdgeId, source: src, target: tgt, weight: defaultEdgeWeight } }); } catch (e) { console.log('[NetworkGraph] edgehandles fallback cy.add error', e); }
                    }
                    setLocalEdges(prev => [...prev, { source: src, target: tgt, weight: defaultEdgeWeight }]);
                  } catch (e) {
                    console.log('[NetworkGraph] edgehandles complete error', e);
                  }
                }
              });
              try {
                cy.on('ehcomplete', (evt: any) => {
                  try {
                    const src = String(evt.source.id());
                    const tgt = String(evt.target.id());
                    setLocalEdges(prev => [...prev, { source: src, target: tgt, weight: defaultEdgeWeight }]);
                  } catch (e) {
                    console.log('[NetworkGraph] cy ehcomplete handler error', e);
                  }
                });
              } catch (e) {}
              try { ehRef.current.disable(); } catch {}
              setEhLoaded(true);
            } catch (e) {}
          }
        } catch (e) {}
      })();

      // Run layout after a short delay to ensure container is ready
      setTimeout(() => {
        cy.resize();
        const layout = cy.layout({ 
          name: 'cose', 
          animate: true, 
          fit: true, 
          padding: 60 
        });
        try {
          layout.run();
        } catch (err) {
          console.error('[NetworkGraph] layout.run() error (init)', err);
        }
      }, 100);

      // Event handlers
      cy.on('tap', 'node', (evt: any) => {
        const node = evt.target;
        const clickedId = String(node.data('id'));
        const currentEdgeSource = edgeSourceRef.current;

        if (toolRef.current === 'delete') {
          deleteNode(clickedId);
          return;
        }

        if (toolRef.current === 'add-edge') {
          const id = clickedId;
          if (!currentEdgeSource) {
            setEdgeSourceId(id);
            node.addClass('edge-source');
          } else if (currentEdgeSource === id) {
            setEdgeSourceId(null);
            node.removeClass('edge-source');
          } else {
            const newEdgeId = `local-e-${Date.now()}`;
            try {
              cy.add({ group: 'edges', data: { id: newEdgeId, source: currentEdgeSource, target: id, weight: defaultEdgeWeight } });
            } catch (e) {
              console.log('[NetworkGraph] add-edge via click: cy.add error', e);
            }
            setLocalEdges(prev => [...prev, { source: currentEdgeSource!, target: id, weight: defaultEdgeWeight }]);
            cy.getElementById(currentEdgeSource)?.removeClass('edge-source');
            setEdgeSourceId(null);
          }
          return;
        }

        node.select();
        const neighborhood = node.closedNeighborhood();
        cy.elements().removeClass('faded');
        cy.elements().not(neighborhood).addClass('faded');
        
        const data = node.data();
        setSelectedNode({ 
          id: String(data.id), 
          type: String(data.type), 
          label: String(data.label || data.id),
          weight: data.weight,
          properties: data.properties || {}
        });
        setSelectedEdge(null);
      });

      cy.on('tap', 'edge', (evt: any) => {
        const edge = evt.target;
        const data = edge.data();
        
        setSelectedEdge({
          source: String(data.source),
          target: String(data.target),
          interaction: data.interaction,
          weight: data.weight,
          properties: data.properties || {}
        });
        
        const connectedNodes = edge.connectedNodes();
        cy.elements().removeClass('faded');
        cy.elements().not(connectedNodes).not(edge).addClass('faded');
      });

      cy.on('tap', (evt: any) => {
        const isNode = evt.target && typeof evt.target.isNode === 'function' && evt.target.isNode();
        const isEdge = evt.target && typeof evt.target.isEdge === 'function' && evt.target.isEdge();
        
        if (!isNode && !isEdge) {
          cy.elements().removeClass('faded');
          cy.elements().unselect();
          setSelectedNode(null);
          setSelectedEdge(null);

          if (toolRef.current === 'add-node') {
            handleAddNodeWithMode(evt);
          }

          if (toolRef.current === 'add-edge' && edgeSourceRef.current) {
            cy.getElementById(edgeSourceRef.current)?.removeClass('edge-source');
            setEdgeSourceId(null);
          }
        }
      });

      cy.on('mouseover', 'node', (evt: any) => {
        if (toolRef.current === 'delete') {
          evt.target.addClass('delete-candidate');
        }
      });

      cy.on('mouseout', 'node', (evt: any) => {
        if (toolRef.current === 'delete') {
          evt.target.removeClass('delete-candidate');
        }
      });

      // Handle window resize
      const handleResize = () => {
        if (cyRef.current) {
          cyRef.current.resize();
          cyRef.current.fit(undefined, 60);
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (cyRef.current) {
          cyRef.current.destroy();
          cyRef.current = null;
        }
      };
    } catch (err) {
      console.error('Cytoscape initialization error:', err);
    }
  }, [elements.length]);

  // Update tool-specific behavior
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    if (tool === 'add-node') {
      container.style.cursor = 'crosshair';
    } else if (tool === 'add-edge') {
      container.style.cursor = 'pointer';
    } else if (tool === 'delete') {
      container.style.cursor = 'not-allowed';
    } else {
      container.style.cursor = 'default';
    }

    if (tool !== 'add-edge' && edgeSourceId && cyRef.current) {
      cyRef.current.getElementById(edgeSourceId)?.removeClass('edge-source');
      setEdgeSourceId(null);
    }

    if (tool !== 'delete' && cyRef.current) {
      cyRef.current.elements().removeClass('delete-candidate');
    }
  }, [tool, edgeSourceId]);

  // When tool changes, enable/disable edgehandles if available
  useEffect(() => {
    if (!ehRef.current) return;
    try {
      if (tool === 'add-edge') {
        ehRef.current.enable();
        setEhEnabled(true);
      } else {
        ehRef.current.disable();
        setEhEnabled(false);
      }
    } catch (e) {}
  }, [tool]);

  // Check if there are any modifications
  const hasModifications = localNodes.length > 0 || localEdges.length > 0 || deletedNodeIds.size > 0 || deletedEdgeIds.size > 0;

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading network visualization...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-xl">
        <div className="text-center text-red-600">
          <p className="font-medium">Failed to load network</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const nodesCount = elements.filter(e => e.data && !('source' in e.data)).length;
  const edgesCount = elements.filter(e => e.data && ('source' in e.data)).length;

  const showNoElementsWarning = elements.length === 0 && !!network;
  const rawNetworkJson = network ? JSON.stringify(network, null, 2) : null;
  const fetchedNodes = (network && (Array.isArray((network as any).nodes) ? (network as any).nodes : Array.isArray((network as any).data?.nodes) ? (network as any).data.nodes : [])) || [];
  const fetchedEdges = (network && (Array.isArray((network as any).edges) ? (network as any).edges : Array.isArray((network as any).data?.edges) ? (network as any).data.edges : [])) || [];
  const fetchedNodeCount = fetchedNodes.length;
  const fetchedEdgeCount = fetchedEdges.length;
  const cyInitialized = Boolean(cyRef.current);
  let cyElementsCount = 0;
  let cyElementIds: string[] = [];
  try {
    if (cyRef.current) {
      cyElementsCount = cyRef.current.elements().length;
      cyElementIds = cyRef.current.elements().map((el: any) => String(el.data('id'))).slice(0, 10) as string[];
    }
  } catch (e) {}

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden min-h-[800px]">
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 border-b bg-white z-30">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Card className="bg-white">
              <CardContent className="p-3">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Nodes:</span>
                    <Badge variant="secondary">{nodesCount}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Edges:</span>
                    <Badge variant="secondary">{edgesCount}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Mode:</span>
                    <Badge 
                      variant={graphMode === 'rule-based' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (graphMode === 'weight-based') {
                          setGraphMode('rule-based');
                          setShowRuleEditor(true);
                        } else {
                          resetToWeightBased();
                        }
                      }}
                    >
                      {graphMode === 'rule-based' ? 'Rule-Based' : 'Weight-Based'}
                      {isApplyingRules && <span className="ml-2 animate-spin">⟳</span>}
                    </Badge>
                  </div>
                  {activeRuleSet && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Active Rules:</span>
                      <Badge variant="outline">{activeRuleSet.name}</Badge>
                    </div>
                  )}
                  {selectedNode && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Selected:</span>
                      <Badge>{selectedNode.label}</Badge>
                    </div>
                  )}
                  {hasModifications && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        Unsaved Changes
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Rule-based controls */}
            {graphMode === 'rule-based' && !showRuleEditor && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRuleEditor(true)}
                  disabled={isApplyingRules}
                >
                  {activeRuleSet ? 'Edit Rules' : 'Create Rules'}
                </Button>
                {activeRuleSet && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetToWeightBased}
                    disabled={isApplyingRules}
                  >
                    Clear Rules
                  </Button>
                )}
              </>
            )}

            {hasModifications && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetModifications}
              >
                Reset Changes
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cyRef.current) {
                  cyRef.current.fit(undefined, 60);
                }
              }}
            >
              Fit to View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveNetwork(false)}
            >
              Save As New
            </Button>

            {networkId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveNetwork(true)}
              >
                Update Current
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex relative min-h-0">
        {/* Left Sidebar - Toolbar */}
        <div className="w-16 bg-gray-50 border-r flex flex-col items-center py-4 gap-2 z-20">
          <Button
            size="icon"
            variant={tool === 'select' ? 'default' : 'ghost'}
            onClick={() => setTool('select')}
            className="h-12 w-12"
            title="Select tool"
          >
            <CursorIcon />
          </Button>
          
          <Button
            size="icon"
            variant={tool === 'add-node' ? 'default' : 'ghost'}
            onClick={() => setTool('add-node')}
            className="h-12 w-12"
            title="Add node tool"
          >
            <PlusIcon />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="h-12 w-12"
            onClick={() => {
              const newId = `n-${Date.now()}`;
              const newNode = { 
                id: newId, 
                label: `Node ${nodeCounterRef.current + 1}`, 
                type: 'custom',
                weight: defaultNodeWeight
              };
              setLocalNodes(prev => [...prev, newNode]);
              nodeCounterRef.current++;
              setTimeout(() => {
                try {
                  if (cyRef.current) {
                    const pan = cyRef.current.pan();
                    const zoom = cyRef.current.zoom();
                    const center = { x: (cyRef.current.width() / 2 - pan.x) / zoom, y: (cyRef.current.height() / 2 - pan.y) / zoom };
                    cyRef.current.add({ 
                      data: { 
                        id: newId, 
                        label: newNode.label, 
                        type: newNode.type,
                        weight: newNode.weight 
                      }, 
                      position: center 
                    });
                    const n = cyRef.current.getElementById(newId);
                    try { n.select(); } catch {}
                    setSelectedNode(newNode);
                  }
                } catch (e) {
                  console.warn('create center node fallback', e);
                }
              }, 50);
            }}
            title="Quick add node at center"
          >
            <CircleIcon />
          </Button>

          <Button
            size="icon"
            variant={tool === 'add-edge' ? 'default' : 'ghost'}
            className="h-12 w-12"
            onClick={() => {
              setTool('add-edge');
              if (selectedNode && cyRef.current) {
                const id = selectedNode.id;
                setEdgeSourceId(id);
                try { cyRef.current.getElementById(id)?.addClass('edge-source'); } catch {}
              }
            }}
            title="Add edge tool"
          >
            <LinkIcon />
          </Button>

          <Button
            size="icon"
            variant={tool === 'delete' ? 'destructive' : 'ghost'}
            onClick={() => setTool('delete')}
            className="h-12 w-12"
            title="Delete tool"
          >
            <TrashIcon />
          </Button>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative min-w-0 min-h-0">
          {/* Show Rule Editor when showRuleEditor is true */}
          {showRuleEditor ? (
            <div className="w-full h-full bg-white">
              <RuleBasedGraph
                onRulesApply={applyRuleSet}
                onCancel={() => {
                  setShowRuleEditor(false);
                  // If no active rule set, switch back to weight-based
                  if (!activeRuleSet) {
                    resetToWeightBased();
                  }
                }}
                initialRuleSet={activeRuleSet || undefined}
              />
            </div>
          ) : (
            <>
              {/* Cytoscape container - Takes full available space */}
              <div
                ref={containerRef}
                className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100"
                aria-label="Project network visualization"
              />

              {/* Debug Panel - Bottom left */}
              <div className="absolute left-4 bottom-4 z-30 max-w-md">
                <Card className="bg-white/95 backdrop-blur-sm max-h-64 overflow-y-auto">
                  <CardContent className="p-3">
                    <div className="space-y-1 text-xs">
                      <div className="font-mono">Mode: {tool} • Graph Mode: {graphMode} • Nodes: {nodesCount} • Edges: {edgesCount}</div>
                      <div className="text-muted-foreground">Fetched: {fetchedNodeCount} nodes • {fetchedEdgeCount} edges</div>
                      <div>NetworkId: {String(networkId ?? 'none')}</div>
                      <div>Cytoscape: {cyInitialized ? 'initialized' : 'not initialized'}</div>
                      <div>EdgeHandles: {ehLoaded ? (ehEnabled ? 'loaded & enabled' : 'loaded') : 'not loaded'}</div>
                      <div>Selected: {selectedNode ? selectedNode.id : (selectedEdge ? `${selectedEdge.source}-${selectedEdge.target}` : 'none')}</div>
                      <div>Cy elements: {cyElementsCount} • ids: {cyElementIds.join(', ') || 'none'}</div>
                      <div>Modifications: +{localNodes.length} nodes, +{localEdges.length} edges, -{deletedNodeIds.size} nodes, -{deletedEdgeIds.size} edges</div>
                      
                      <div className="flex flex-wrap gap-1 pt-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          if (!cyRef.current) return;
                          const id = `debug-${Date.now()}`;
                          cyRef.current.add({ 
                            data: { 
                              id, 
                              label: 'Debug node',
                              weight: Math.round(Math.random() * 10)
                            }, 
                            position: { x: 0, y: 0 } 
                          });
                          setTimeout(() => { cyRef.current?.fit(undefined, 60); }, 50);
                        }}>
                          Test Node
                        </Button>
                        
                        <Button variant="outline" size="sm" onClick={() => {
                          if (cyRef.current) {
                            try { console.log('[NetworkGraph] cy elements count:', cyRef.current.elements().length); } catch (e) { console.log('[NetworkGraph] cy log error', e); }
                          } else {
                            console.log('[NetworkGraph] cy is not initialized');
                          }
                        }}>
                          Log Cy
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Warning panel - Centered */}
              {showNoElementsWarning && (
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 max-w-2xl">
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-4">
                      <div className="text-yellow-800">
                        <div className="font-semibold">Warning: network fetched but no nodes/edges were found.</div>
                        <div className="mt-2 text-sm">Raw network data (truncated):</div>
                        <pre className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap bg-yellow-100 p-3 rounded border">{rawNetworkJson?.slice(0, 2000)}</pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Sidebar - Node/Edge Properties */}
        {(selectedNode || selectedEdge) && (
          <div className="w-80 bg-white border-l flex-shrink-0 z-20">
            <Card className="h-full border-0 rounded-none">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {selectedNode ? 'Node Properties' : 'Edge Properties'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedNode(null);
                      setSelectedEdge(null);
                      if (cyRef.current) {
                        cyRef.current.elements().removeClass('faded');
                        cyRef.current.elements().unselect();
                      }
                    }}
                  >
                    <XIcon />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-4 space-y-4">
                {selectedNode && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Label</label>
                      <Input
                        value={selectedNode.label}
                        onChange={(e) => {
                          const newLabel = e.target.value;
                          setSelectedNode(prev => prev ? { ...prev, label: newLabel } : null);
                          if (cyRef.current) {
                            const node = cyRef.current.getElementById(selectedNode.id);
                            if (node) {
                              node.data('label', newLabel);
                            }
                          }
                          if (selectedNode.id.startsWith('n-')) {
                            setLocalNodes(prev => 
                              prev.map(n => n.id === selectedNode.id ? { ...n, label: newLabel } : n)
                            );
                          }
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type</label>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className="text-sm px-2 py-1"
                          style={{ 
                            backgroundColor: typeColors.get(selectedNode.type) || '#6b7280',
                            color: 'white'
                          }}
                        >
                          {selectedNode.type}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Weight</label>
                      <Input
                        type="number"
                        value={selectedNode.weight ?? defaultNodeWeight}
                        onChange={(e) => {
                          const newWeight = parseFloat(e.target.value) || defaultNodeWeight;
                          setSelectedNode(prev => prev ? { ...prev, weight: newWeight } : null);
                          if (cyRef.current) {
                            const node = cyRef.current.getElementById(selectedNode.id);
                            if (node) {
                              node.data('weight', newWeight);
                            }
                          }
                          if (selectedNode.id.startsWith('n-')) {
                            setLocalNodes(prev => 
                              prev.map(n => n.id === selectedNode.id ? { ...n, weight: newWeight } : n)
                            );
                          }
                        }}
                        min="0"
                        step="0.1"
                        className="w-full"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">ID</label>
                      <div className="text-sm text-gray-600 font-mono bg-gray-50 px-3 py-2 rounded border">
                        {selectedNode.id}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEdgeSourceId(selectedNode.id);
                          if (cyRef.current) {
                            cyRef.current.getElementById(selectedNode.id)?.addClass('edge-source');
                          }
                        }}
                        className="flex-1"
                      >
                        Set as Source
                      </Button>
                      
                      {edgeSourceId && edgeSourceId !== selectedNode.id && (
                        <Button
                          onClick={() => {
                            const newEdgeId = `local-e-${Date.now()}`;
                            if (cyRef.current) {
                              cyRef.current.add({ 
                                group: 'edges', 
                                data: { 
                                  id: newEdgeId, 
                                  source: edgeSourceId, 
                                  target: selectedNode.id,
                                  weight: defaultEdgeWeight
                                } 
                              });
                            }
                            setLocalEdges(prev => [...prev, { 
                              source: edgeSourceId, 
                              target: selectedNode.id,
                              weight: defaultEdgeWeight
                            }]);
                            if (cyRef.current) {
                              cyRef.current.getElementById(edgeSourceId)?.removeClass('edge-source');
                            }
                            setEdgeSourceId(null);
                          }}
                          className="flex-1"
                        >
                          Connect
                        </Button>
                      )}
                    </div>

                    <div className="pt-4 border-t">
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete node "${selectedNode.label}"?`)) {
                            deleteNode(selectedNode.id);
                          }
                        }}
                        className="w-full"
                      >
                        <TrashIcon />
                        Delete Node
                      </Button>
                    </div>
                  </>
                )}

                {selectedEdge && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Connection</label>
                      <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border">
                        {selectedEdge.source} → {selectedEdge.target}
                      </div>
                    </div>

                    {selectedEdge.interaction && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Interaction</label>
                        <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border">
                          {selectedEdge.interaction}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Weight</label>
                      <Input
                        type="number"
                        value={selectedEdge.weight ?? defaultEdgeWeight}
                        onChange={(e) => {
                          const newWeight = parseFloat(e.target.value) || defaultEdgeWeight;
                          setSelectedEdge(prev => prev ? { ...prev, weight: newWeight } : null);
                          if (cyRef.current) {
                            const edges = cyRef.current.edges().filter((e: any) => 
                              e.data('source') === selectedEdge.source && 
                              e.data('target') === selectedEdge.target
                            );
                            edges.forEach((edge: any) => {
                              edge.data('weight', newWeight);
                            });
                          }
                          const edgeKey = `${selectedEdge.source}-${selectedEdge.target}`;
                          if (localEdges.some(e => `${e.source}-${e.target}` === edgeKey)) {
                            setLocalEdges(prev => 
                              prev.map(e => 
                                e.source === selectedEdge.source && e.target === selectedEdge.target 
                                  ? { ...e, weight: newWeight } 
                                  : e
                              )
                            );
                          }
                        }}
                        min="0"
                        step="0.1"
                        className="w-full"
                      />
                    </div>

                    <div className="pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (cyRef.current) {
                            const edges = cyRef.current.edges().filter((e: any) => 
                              e.data('source') === selectedEdge.source && 
                              e.data('target') === selectedEdge.target
                            );
                            edges.remove();
                          }
                          setLocalEdges(prev => 
                            prev.filter(e => 
                              !(e.source === selectedEdge.source && e.target === selectedEdge.target)
                            )
                          );
                          setSelectedEdge(null);
                          if (cyRef.current) {
                            cyRef.current.elements().removeClass('faded');
                          }
                        }}
                        className="w-full"
                      >
                        <TrashIcon />
                        Delete Edge
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Node creation form - Modal overlay */}
      {newNodeDraft && !showRuleEditor && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-80">
            <CardHeader>
              <CardTitle className="text-lg">Create Node</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <Input
                  value={newNodeDraft.label}
                  onChange={(e) => setNewNodeDraft({ ...newNodeDraft, label: e.target.value })}
                  placeholder="Enter node label"
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Input
                  value={newNodeDraft.type}
                  onChange={(e) => setNewNodeDraft({ ...newNodeDraft, type: e.target.value })}
                  placeholder="Enter node type"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Weight</label>
                <Input
                  type="number"
                  value={newNodeDraft.weight ?? defaultNodeWeight}
                  onChange={(e) => setNewNodeDraft({ ...newNodeDraft, weight: parseFloat(e.target.value) || defaultNodeWeight })}
                  placeholder="Enter node weight"
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setNewNodeDraft(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const newId = `n-${Date.now()}`;
                    const newNode = {
                      id: newId,
                      label: newNodeDraft.label || `Node ${nodeCounterRef.current + 1}`,
                      type: newNodeDraft.type || 'custom',
                      weight: newNodeDraft.weight ?? defaultNodeWeight
                    };
                    
                    setLocalNodes(prev => [...prev, newNode]);
                    setNewNodeDraft(null);
                    nodeCounterRef.current++;
                    
                    setTimeout(() => {
                      if (cyRef.current) {
                        cyRef.current.add({ 
                          data: { 
                            id: newId, 
                            label: newNode.label, 
                            type: newNode.type,
                            weight: newNode.weight
                          }, 
                          position: newNodeDraft.modelPos 
                        });
                        
                        const addedNode = cyRef.current.getElementById(newId);
                        if (addedNode) {
                          addedNode.select();
                          setSelectedNode(newNode);
                        }
                      }
                    }, 100);
                  }}
                  className="flex-1"
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Icon components
const CursorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const CircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

export default NetworkGraph;