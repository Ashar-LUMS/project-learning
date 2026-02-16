import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import cytoscape, { type Core } from "cytoscape";
import { supabase } from '../../supabaseClient';
import { useNetworkData } from '../../hooks/useNetworkData';
export { useNetworkData } from '../../hooks/useNetworkData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { MousePointer2, CirclePlus, Circle, Link, X, Trash2, Download, Network, Maximize, User } from 'lucide-react';
import type { NetworkData } from '@/types/network';
import { exportAndDownloadNetwork } from '@/lib/networkIO';
import { NetworkPersonalizationDialog } from './NetworkPersonalizationDialog';

// Module-level flag to prevent duplicate edgehandles extension registration (survives HMR)
let edgehandlesRegistered = false;

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
  edgeType?: 'activator' | 'inhibitor';
  properties?: {
    capacity?: number;
    edgeType?: 'activator' | 'inhibitor';
    [key: string]: any;
  };
};

export type NetworkGraphHandle = {
  getLiveWeightedConfig: () => {
    nodes: Array<{ id: string; label: string; properties?: Record<string, any> }>
    edges: Array<{ source: string; target: string; weight?: number }>
    tieBehavior: 'hold'
  } | null;
  getLiveNetworkData: () => NetworkData | null;
  fitToView: () => void;
  saveAsNew: () => void;
  updateCurrent: () => void;
};

type Props = {
  networkId?: string | null;
  height?: number | string;
  refreshToken?: number;
  projectId?: string | null;
  onSaved?: (network: { id: string; name: string; created_at: string | null; data: any }) => void;
  onModificationsChange?: (hasModifications: boolean) => void;
  overrideNetworkData?: NetworkData | null;
  readOnly?: boolean;
  hideControls?: boolean;
  hideHeaderActions?: boolean;
  highlightNodeIds?: string[];
};

const NetworkGraph = forwardRef<NetworkGraphHandle, Props>(({
  networkId,
  refreshToken = 0,
  projectId = null,
  onSaved,
  onModificationsChange,
  overrideNetworkData = null,
  readOnly = false,
  hideControls = false,
  hideHeaderActions = false,
  highlightNodeIds = []
}, ref) => {
  const { showToast, showConfirm, showPrompt } = useToast();

  const [manualRefresh, setManualRefresh] = useState(0);
  const [isNetworkPersonalizationOpen, setIsNetworkPersonalizationOpen] = useState(false);
  const effectiveRefresh = (refreshToken ?? 0) + manualRefresh;
  
  // Only fetch from database if no override data is provided
  const shouldFetch = !overrideNetworkData && networkId;
  const { data: network, isLoading, error } = useNetworkData(
    shouldFetch ? networkId : undefined,
    effectiveRefresh
  );

  // Load network metadata if present
  useEffect(() => {
    if (!network) return;
  }, [network]);

  useEffect(() => {
    setManualRefresh((p) => p + 1);
    setGraphReady(false);
  }, [networkId]);

  // Helper to get cache key for this network
  const getCacheKey = useCallback((key: string) => networkId ? `network_${networkId}_${key}` : null, [networkId]);

  // Load cached modifications from localStorage
  const loadCachedModifications = useCallback(() => {
    if (!networkId) return { nodes: [], edges: [], deletedNodes: new Set<string>(), deletedEdges: new Set<string>(), rules: [] as string[] };
    
    try {
      const nodesKey = getCacheKey('localNodes');
      const edgesKey = getCacheKey('localEdges');
      const deletedNodesKey = getCacheKey('deletedNodeIds');
      const deletedEdgesKey = getCacheKey('deletedEdgeIds');
      const rulesKey = getCacheKey('localRules');
      
      const cachedNodes = nodesKey ? localStorage.getItem(nodesKey) : null;
      const cachedEdges = edgesKey ? localStorage.getItem(edgesKey) : null;
      const cachedDeletedNodes = deletedNodesKey ? localStorage.getItem(deletedNodesKey) : null;
      const cachedDeletedEdges = deletedEdgesKey ? localStorage.getItem(deletedEdgesKey) : null;
      const cachedRules = rulesKey ? localStorage.getItem(rulesKey) : null;
      
      return {
        nodes: cachedNodes ? JSON.parse(cachedNodes) : [],
        edges: cachedEdges ? JSON.parse(cachedEdges) : [],
        deletedNodes: cachedDeletedNodes ? new Set<string>(JSON.parse(cachedDeletedNodes)) : new Set<string>(),
        deletedEdges: cachedDeletedEdges ? new Set<string>(JSON.parse(cachedDeletedEdges)) : new Set<string>(),
        rules: cachedRules ? JSON.parse(cachedRules) : [],
      };
    } catch (error) {
      console.error('[NetworkGraph] Failed to load cached modifications:', error);
      return { nodes: [], edges: [], deletedNodes: new Set<string>(), deletedEdges: new Set<string>(), rules: [] as string[] };
    }
  }, [networkId, getCacheKey]);

  // Clear cached modifications from localStorage
  const clearCachedModifications = useCallback(() => {
    if (!networkId) return;
    
    try {
      const nodesKey = getCacheKey('localNodes');
      const edgesKey = getCacheKey('localEdges');
      const deletedNodesKey = getCacheKey('deletedNodeIds');
      const deletedEdgesKey = getCacheKey('deletedEdgeIds');
      const rulesKey = getCacheKey('localRules');
      
      if (nodesKey) localStorage.removeItem(nodesKey);
      if (edgesKey) localStorage.removeItem(edgesKey);
      if (deletedNodesKey) localStorage.removeItem(deletedNodesKey);
      if (deletedEdgesKey) localStorage.removeItem(deletedEdgesKey);
      if (rulesKey) localStorage.removeItem(rulesKey);
    } catch (error) {
      console.error('[NetworkGraph] Failed to clear cached modifications:', error);
    }
  }, [networkId, getCacheKey]);

  // When the selected network changes, clear any local modifications and
  // reinitialize the Cytoscape instance to avoid showing the previous
  // network's elements (fixes stale canvas after switching networks).
  useEffect(() => {
    // Load cached modifications for the new network
    const cached = loadCachedModifications();
    setLocalNodes(cached.nodes);
    setLocalEdges(cached.edges);
    setDeletedNodeIds(cached.deletedNodes);
    setDeletedEdgeIds(cached.deletedEdges);
    setLocalRules(cached.rules || []);
    setSelectedNode(null);
    setSelectedEdge(null);
    setEdgeSourceId(null);

    // Destroy existing cytoscape instance so it is recreated with new elements
    if (cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch (e) {
        // ignore destroy errors
      }
      cyRef.current = null;
    }

    // bump manual refresh so hooks relying on it will refetch
    setManualRefresh(p => p + 1);
  }, [networkId, loadCachedModifications]);

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
  const [graphReady, setGraphReady] = useState(false);
  const [newNodeDraft, setNewNodeDraft] = useState<{
    modelPos: { x: number; y: number };
    label: string;
    type: string;
    weight?: number;
  } | null>(null);

  // Weighted analysis: tieBehavior is permanently set to 'hold'
  const tieBehavior = 'hold' as const;

  // Default weights
  const defaultNodeWeight = 1;
  const defaultEdgeWeight = 1;

  // State for tracking modifications (initialized from cache)
  const [localNodes, setLocalNodes] = useState<Node[]>(() => loadCachedModifications().nodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(() => loadCachedModifications().edges);
  const [deletedNodeIds, setDeletedNodeIds] = useState<Set<string>>(() => loadCachedModifications().deletedNodes);
  const [deletedEdgeIds, setDeletedEdgeIds] = useState<Set<string>>(() => loadCachedModifications().deletedEdges);
  const [localRules, setLocalRules] = useState<string[]>(() => loadCachedModifications().rules);

  // Save modifications to localStorage whenever they change
  useEffect(() => {
    if (!networkId) return;
    
    try {
      const nodesKey = getCacheKey('localNodes');
      const edgesKey = getCacheKey('localEdges');
      const deletedNodesKey = getCacheKey('deletedNodeIds');
      const deletedEdgesKey = getCacheKey('deletedEdgeIds');
      const rulesKey = getCacheKey('localRules');
      
      if (nodesKey) localStorage.setItem(nodesKey, JSON.stringify(localNodes));
      if (edgesKey) localStorage.setItem(edgesKey, JSON.stringify(localEdges));
      if (deletedNodesKey) localStorage.setItem(deletedNodesKey, JSON.stringify(Array.from(deletedNodeIds)));
      if (deletedEdgesKey) localStorage.setItem(deletedEdgesKey, JSON.stringify(Array.from(deletedEdgeIds)));
      if (rulesKey) localStorage.setItem(rulesKey, JSON.stringify(localRules));
    } catch (error) {
      console.error('[NetworkGraph] Failed to save modifications to cache:', error);
    }
  }, [localNodes, localEdges, deletedNodeIds, deletedEdgeIds, localRules, networkId]);

  // Use override data if provided, otherwise use fetched network data
  const effectiveNetworkData = overrideNetworkData || network;

  // Determine if this network should be treated as rule-based
  const isRuleBased = useMemo(() => {
    try {
      const topRules = (effectiveNetworkData as any)?.rules;
      const dataRules = (effectiveNetworkData as any)?.data?.rules;
      const nestedRules = (effectiveNetworkData as any)?.network_data?.rules;
      const rules = Array.isArray(topRules) ? topRules : Array.isArray(dataRules) ? dataRules : Array.isArray(nestedRules) ? nestedRules : [];
      const metaType = (effectiveNetworkData as any)?.metadata?.type || (effectiveNetworkData as any)?.data?.metadata?.type || (effectiveNetworkData as any)?.network_data?.metadata?.type;
      return (Array.isArray(rules) && rules.length > 0) || metaType === 'Rule based';
    } catch {
      return false;
    }
  }, [effectiveNetworkData]);
  // Parse rules to determine inhibitor relationships
  // Returns a Set of "source::target" strings where source inhibits target
  const inhibitorEdges = useMemo(() => {
    const inhibitors = new Set<string>();
    const rules = (effectiveNetworkData as any)?.rules || [];
    
    for (const rule of rules) {
      // Handle both { name, action } format and { name: "A = B" } format
      let target: string;
      let expression: string;
      
      if (typeof rule === 'string') {
        const match = rule.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
        if (!match) continue;
        target = match[1];
        expression = match[2];
      } else if (rule.action) {
        target = rule.name;
        expression = rule.action;
      } else if (rule.name && rule.name.includes('=')) {
        const match = rule.name.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
        if (!match) continue;
        target = match[1];
        expression = match[2];
      } else {
        continue;
      }
      
      // Parse the expression to find negated identifiers
      // Strategy: find all identifiers that appear after a ! or within !(...) 
      // We'll use a simple approach: track negation context
      
      // Track nested negation using parenthesis counting
      let negationDepth = 0;
      let pos = 0;
      
      while (pos < expression.length) {
        // Check for !( pattern
        if (expression[pos] === '!' && expression[pos + 1] === '(') {
          negationDepth++;
          pos += 2;
          continue;
        }
        
        // Check for simple ! before identifier
        if (expression[pos] === '!' && /[a-zA-Z_]/.test(expression[pos + 1] || '')) {
          // Find the identifier
          const rest = expression.slice(pos + 1);
          const idMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (idMatch) {
            const sourceNode = idMatch[1];
            if (!['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'].includes(sourceNode.toUpperCase())) {
              inhibitors.add(`${sourceNode}::${target}`);
            }
            pos += 1 + idMatch[1].length;
            continue;
          }
        }
        
        // Check for closing paren that ends negation
        if (expression[pos] === ')' && negationDepth > 0) {
          negationDepth--;
          pos++;
          continue;
        }
        
        // Check for identifier
        if (/[a-zA-Z_]/.test(expression[pos])) {
          const rest = expression.slice(pos);
          const idMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (idMatch) {
            const sourceNode = idMatch[1];
            if (!['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'].includes(sourceNode.toUpperCase())) {
              if (negationDepth > 0) {
                inhibitors.add(`${sourceNode}::${target}`);
              }
            }
            pos += idMatch[1].length;
            continue;
          }
        }
        
        pos++;
      }
    }
    
    return inhibitors;
  }, [effectiveNetworkData]);

  // Get current nodes with all modifications applied
  const currentNodes = useMemo(() => {
    const fetchedNodes = (effectiveNetworkData && (Array.isArray((effectiveNetworkData as any).nodes) ? (effectiveNetworkData as any).nodes : Array.isArray((effectiveNetworkData as any).data?.nodes) ? (effectiveNetworkData as any).data.nodes : [])) || [];
    const localNodeMap = new Map(localNodes.map(n => [n.id, n]));

    return [
      ...fetchedNodes
        .filter((n: any) => n && typeof n.id === 'string' && !deletedNodeIds.has(n.id))
        .map((n: any) => localNodeMap.get(n.id) || n),
      ...localNodes.filter(n => !fetchedNodes.some((fn: any) => fn.id === n.id))
    ];
  }, [effectiveNetworkData, localNodes, deletedNodeIds]);

  // Get current edges with all modifications applied
  const currentEdges = useMemo(() => {
    const fetchedEdges = (effectiveNetworkData && (Array.isArray((effectiveNetworkData as any).edges) ? (effectiveNetworkData as any).edges : Array.isArray((effectiveNetworkData as any).data?.edges) ? (effectiveNetworkData as any).data.edges : [])) || [];
    const localEdgeMap = new Map(localEdges.map(e => [`${e.source}::${e.target}`, e]));

    return [
      ...fetchedEdges
        .filter((e: any) => e && typeof e.source === 'string' && typeof e.target === 'string' && !deletedEdgeIds.has(`edge:${e.source}:${e.target}`))
        .map((e: any) => localEdgeMap.get(`${e.source}::${e.target}`) || e),
      ...localEdges.filter(e => !fetchedEdges.some((fe: any) => fe.source === e.source && fe.target === e.target))
    ];
  }, [effectiveNetworkData, localEdges, deletedEdgeIds]);

  // Backwards compatibility: provide as object
  const getCurrentNetworkData = useMemo(() => ({
    nodes: currentNodes,
    edges: currentEdges
  }), [currentNodes, currentEdges]);

  // UPDATED: Include weight data and edge types in elements
  const elements = useMemo(() => {
    // Prefer the current in-memory network view, but fall back to stored/currently computed network data.
    let nodes = getCurrentNetworkData.nodes;
    let edges = getCurrentNetworkData.edges;

    // If Cytoscape is available, derive live elements (including positions) to ensure UI additions are captured.
    if (cyRef.current) {
      try {
        const cy = cyRef.current;
        const liveNodes = cy.nodes().map((n: any) => {
          const pos = (typeof n.position === 'function') ? n.position() : (n.renderedPosition ? n.renderedPosition() : { x: 0, y: 0 });
          return {
            id: String(n.data('id')),
            label: String(n.data('label') ?? n.data('id')),
            type: String(n.data('type') ?? 'custom'),
            weight: Number(n.data('weight') ?? defaultNodeWeight),
            position: { x: pos.x, y: pos.y },
            properties: n.data('properties') || {}
          };
        });
        const liveEdges = cy.edges().map((e: any) => ({
          source: String(e.data('source')),
          target: String(e.data('target')),
          weight: Number(e.data('weight') ?? defaultEdgeWeight),
          interaction: e.data('interaction'),
          properties: e.data('properties') || {}
        }));

        if (liveNodes && liveNodes.length > 0) nodes = liveNodes;
        if (liveEdges && liveEdges.length > 0) edges = liveEdges;
      } catch (e) {
        // If any error occurs, fall back to computed network data
      }
    }
    
    // Build a map from node id to label for reverse lookup
    const nodeIdToLabel = new Map<string, string>();
    const nodeLabelToId = new Map<string, string>();
    nodes.forEach((n: any) => {
      const id = n.id;
      const label = n.label || n.id;
      nodeIdToLabel.set(id, label);
      nodeLabelToId.set(label, id);
    });

    const nodeElems = nodes.map((n: any) => ({
      data: {
        id: n.id,
        label: n.label ?? n.id,
        type: n.type ?? 'custom',
        // Do not expose node weight in the UI when rule-based
        ...(isRuleBased ? {} : { weight: n.weight ?? defaultNodeWeight }),
        properties: (() => {
          const props = n.properties || {};
          if (isRuleBased) {
            const copy = { ...props };
            // Remove bias when rule-based
            if ('bias' in copy) delete copy.bias;
            return copy;
          }
          return props;
        })()
      },
    }));

    const edgeElems = edges.map((e: any) => {
      // Determine edge type from rules or existing properties
      let edgeType = e.properties?.edgeType;
      
      // If no explicit edgeType, check if this edge is an inhibitor based on rules
      if (!edgeType) {
        // Try matching by id first
        let edgeKey = `${e.source}::${e.target}`;
        if (inhibitorEdges.has(edgeKey)) {
          edgeType = 'inhibitor';
        } else {
          // Try matching by label (rules use labels, edges use ids)
          const sourceLabel = nodeIdToLabel.get(e.source) || e.source;
          const targetLabel = nodeIdToLabel.get(e.target) || e.target;
          edgeKey = `${sourceLabel}::${targetLabel}`;
          if (inhibitorEdges.has(edgeKey)) {
            edgeType = 'inhibitor';
          }
        }
      }
      
      const edgeData: any = {
        id: `edge:${e.source}:${e.target}`,
        source: e.source,
        target: e.target,
        interaction: e.interaction,
        weight: e.weight ?? defaultEdgeWeight,
        properties: e.properties || {}
      };
      // Only add edgeType if it exists (for proper Cytoscape selector matching)
      if (edgeType) {
        edgeData.edgeType = edgeType;
      }
      return { data: edgeData };
    });

    return [...nodeElems, ...edgeElems];
  }, [getCurrentNetworkData, inhibitorEdges]);

  const typeColors = useMemo(() => {
    const nodeTypes = new Set<string>();
    elements.forEach(e => {
      if (e.data && !('source' in e.data)) {
        nodeTypes.add((e.data as any).type || 'custom');
      }
    });
    
    // Biological network color palette - colorblind-friendly, high contrast
    // Based on systems biology conventions: transcription factors, receptors, kinases, etc.
    const colorPalette = [
      '#2563eb', // Royal Blue - genes/transcription factors (primary)
      '#059669', // Emerald - proteins/enzymes
      '#7c3aed', // Violet - kinases/phosphatases
      '#dc2626', // Red - oncogenes/drivers
      '#0891b2', // Cyan - receptors
      '#ca8a04', // Amber - metabolites
      '#db2777', // Pink - miRNAs
      '#0d9488', // Teal - membrane proteins
      '#4f46e5', // Indigo - signaling molecules
      '#16a34a', // Green - tumor suppressors
      '#9333ea', // Purple - epigenetic regulators
      '#ea580c', // Orange - stress response
    ];
    
    const map = new Map<string, string>();
    Array.from(nodeTypes).forEach((t, i) => {
      map.set(t, colorPalette[i % colorPalette.length]);
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
            setDeletedEdgeIds(prev => new Set([...prev, `edge:${source}:${target}`]));
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

  // Infer Boolean rules from graph topology for rule-based networks
  // For each node with incoming edges:
  //   - activators combined with AND
  //   - inhibitors prefixed with NOT
  //   - Final: (activator1 AND activator2) AND (NOT inhibitor1) AND (NOT inhibitor2)
  // Nodes with no incoming edges get self-referential rule: NodeLabel = NodeLabel
  const inferRulesFromGraph = (nodes: any[], edges: any[]): string[] => {
    const rules: string[] = [];
    const nodeLabels = new Map<string, string>();
    
    // Build node id -> label map
    for (const node of nodes) {
      const id = String(node.id);
      const label = String(node.label || node.id);
      nodeLabels.set(id, label);
    }
    
    // Group incoming edges by target node
    const incomingEdges = new Map<string, { activators: string[]; inhibitors: string[] }>();
    
    // Initialize all nodes with empty incoming edge lists
    for (const node of nodes) {
      incomingEdges.set(String(node.id), { activators: [], inhibitors: [] });
    }
    
    // Classify each edge as activator or inhibitor
    for (const edge of edges) {
      const sourceId = String(edge.source);
      const targetId = String(edge.target);
      const sourceLabel = nodeLabels.get(sourceId) || sourceId;
      
      // Check edge type - can be in properties.edgeType, edgeType, interaction, or inferred from weight
      const edgeType = edge.properties?.edgeType || edge.edgeType || edge.interaction;
      const weight = Number(edge.weight);
      // Negative weight means inhibitor; explicit edgeType takes precedence
      const isInhibitor = edgeType === 'inhibitor' || edgeType === 'inhibition' || edgeType === 'Inhibiting' 
        || (!edgeType && weight < 0);
      
      const targetEdges = incomingEdges.get(targetId);
      if (targetEdges) {
        if (isInhibitor) {
          targetEdges.inhibitors.push(sourceLabel);
        } else {
          targetEdges.activators.push(sourceLabel);
        }
      }
    }
    
    // Generate rule for each node
    for (const node of nodes) {
      const nodeId = String(node.id);
      const nodeLabel = nodeLabels.get(nodeId) || nodeId;
      const incoming = incomingEdges.get(nodeId);
      
      if (!incoming || (incoming.activators.length === 0 && incoming.inhibitors.length === 0)) {
        // No incoming edges - self-referential rule (maintains current state)
        rules.push(`${nodeLabel} = ${nodeLabel}`);
      } else {
        // Build expression from activators and inhibitors
        const parts: string[] = [];
        
        // Add activators (combined with AND if multiple)
        if (incoming.activators.length > 0) {
          if (incoming.activators.length === 1) {
            parts.push(incoming.activators[0]);
          } else {
            parts.push(`(${incoming.activators.join(' AND ')})`);
          }
        }
        
        // Add negated inhibitors
        for (const inhibitor of incoming.inhibitors) {
          parts.push(`NOT ${inhibitor}`);
        }
        
        // Combine all parts with AND
        const expression = parts.length === 1 ? parts[0] : parts.join(' AND ');
        rules.push(`${nodeLabel} = ${expression}`);
      }
    }
    
    return rules;
  };

  // Save network function
  const saveNetwork = async (isUpdate: boolean = false) => {
    try {
      // Build merged nodes/edges from: live Cytoscape -> local modifications -> fetched data
      const originalNodes = Array.isArray(getCurrentNetworkData.nodes) ? getCurrentNetworkData.nodes : [];
      const originalEdges = Array.isArray(getCurrentNetworkData.edges) ? getCurrentNetworkData.edges : [];

      const nodeMap = new Map<string, any>();
      const edgeMap = new Map<string, any>();

      // 1) Start with fetched/computed nodes/edges
      for (const n of originalNodes) {
        if (!n || !n.id) continue;
        nodeMap.set(n.id, { ...n });
      }
      for (const e of originalEdges) {
        if (!e || !e.source || !e.target) continue;
        edgeMap.set(`${e.source}::${e.target}`, { ...e });
      }

      // 2) Apply local modifications (explicit local arrays)
      for (const ln of localNodes) {
        if (!ln || !ln.id) continue;
        nodeMap.set(ln.id, { ...nodeMap.get(ln.id), ...ln });
      }
      for (const le of localEdges) {
        if (!le || !le.source || !le.target) continue;
        edgeMap.set(`${le.source}::${le.target}`, { ...edgeMap.get(`${le.source}::${le.target}`), ...le });
      }

      // 3) Prefer live Cytoscape element data (positions, latest labels/weights)
      if (cyRef.current) {
        try {
          const cy = cyRef.current;
          cy.nodes().forEach((n: any) => {
            try {
              const id = String(n.data('id'));
              const pos = (typeof n.position === 'function') ? n.position() : (n.renderedPosition ? n.renderedPosition() : { x: 0, y: 0 });
              const entry = {
                id,
                label: String(n.data('label') ?? id),
                type: String(n.data('type') ?? 'custom'),
                weight: Number(n.data('weight') ?? defaultNodeWeight),
                position: { x: pos.x, y: pos.y },
                properties: n.data('properties') || {}
              };
              nodeMap.set(id, entry);
            } catch { }
          });
          cy.edges().forEach((e: any) => {
            try {
              const src = String(e.data('source'));
              const tgt = String(e.data('target'));
              const key = `${src}::${tgt}`;
              const entry = {
                source: src,
                target: tgt,
                weight: Number(e.data('weight') ?? defaultEdgeWeight),
                interaction: e.data('interaction'),
                properties: e.data('properties') || {}
              };
              edgeMap.set(key, entry);
            } catch { }
          });
        } catch (e) {
          // ignore cy extraction errors
        }
      }

      // Build arrays from maps, excluding deleted ids
      const nodes = Array.from(nodeMap.values()).filter((n: any) => !deletedNodeIds.has(n.id));
      const edges = Array.from(edgeMap.values()).filter((e: any) => !deletedEdgeIds.has(`edge:${e.source}:${e.target}`));
      // Validate and de-duplicate edges by source-target
      const seen = new Set<string>();
      const dedupedEdges = edges.filter((e: any) => {
        const key = `${e.source}::${e.target}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      const duplicateCount = edges.length - dedupedEdges.length;
      if (duplicateCount > 0) {
        showToast({ 
          title: 'Duplicate Edges Removed', 
          description: `Removed ${duplicateCount} duplicate edge(s) (same source→target) before saving.`,
          variant: 'default'
        });
      }
      
      // Preserve existing metadata and rules from the network (support multiple shapes)
      const existingMetadata = (network && ((network as any).metadata || (network as any).data?.metadata || (network as any).network_data?.metadata)) || {};
      const finalMetadata: any = { ...existingMetadata };
      // Preserve network type if already set (from creation or previous saves)
      // Only infer type if not explicitly set in metadata
      if (!finalMetadata.type) {
        finalMetadata.type = 'Weight based';
      } else {
        // Normalize existing type to consistent casing
        if (finalMetadata.type === 'weight based') {
          finalMetadata.type = 'Weight based';
        }
      }

      // For rule-based networks, infer rules from graph topology (nodes + edges)
      // This allows users to draw edges and have rules auto-generated
      let finalRules: string[] = [];
      if (finalMetadata.type === 'Rule based') {
        // Infer rules from the graph structure
        finalRules = inferRulesFromGraph(nodes, dedupedEdges);
      }

      // If rule-based, strip node weights and biases before saving
      const nodesToSave = (Array.isArray(nodes) ? nodes : []).map((n: any) => {
        if (finalMetadata.type === 'Rule based') {
          const copy: any = { ...n };
          if ('weight' in copy) delete copy.weight;
          if (copy.properties) {
            const p = { ...copy.properties };
            if ('bias' in p) delete p.bias;
            copy.properties = p;
          }
          return copy;
        }
        return n;
      });

      const payload = {
        nodes: nodesToSave,
        edges: dedupedEdges,
        rules: finalRules,
        metadata: finalMetadata
      };

      // Debug: log payload to aid troubleshooting when saves result in empty network
      try { console.debug('[NetworkGraph] saving payload', payload); } catch (e) { }

      if (isUpdate && networkId) {
        const { data, error } = await supabase
          .from('networks')
          .update({ network_data: payload })
          .eq('id', networkId)
          .select()
          .single();

        if (error) {
          
          showToast({ 
            title: 'Update Failed', 
            description: 'Failed to update network: ' + (error.message || String(error)),
            variant: 'destructive'
          });
        } else {
          const updatedNetwork = {
            id: data.id as string,
            name: data.name as string,
            created_at: data.created_at ?? null,
            data: data.network_data ?? null
          };
          // Clear local modifications after successful save
          setLocalNodes([]);
          setLocalEdges([]);
          setDeletedNodeIds(new Set());
          setDeletedEdgeIds(new Set());
          setLocalRules([]);
          clearCachedModifications();
          // Trigger refresh to reload updated data from database
          setManualRefresh(p => p + 1);
          try { onSaved?.(updatedNetwork); } catch (e) { }
          showToast({ 
            title: 'Success', 
            description: 'Network updated successfully',
            variant: 'success'
          });
        }
      } else {
        showPrompt('Save network as (name):', `network-${Date.now()}`, async (name) => {
          if (!name) return;

          const { data, error } = await supabase
            .from('networks')
            .insert({ name, network_data: payload })
            .select()
            .single();

          if (error) {
            showToast({ 
              title: 'Save Failed', 
              description: 'Failed to save network: ' + (error.message || String(error)),
              variant: 'destructive'
            });
          } else {
          const newNetwork = {
            id: data.id as string,
            name: data.name as string,
            created_at: data.created_at ?? null,
            data: data.network_data ?? null
          };
          try { onSaved?.(newNetwork); } catch (e) { }

          // Clear local modifications after successful save
          setLocalNodes([]);
          setLocalEdges([]);
          setDeletedNodeIds(new Set());
          setDeletedEdgeIds(new Set());
          setLocalRules([]);
          clearCachedModifications();
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
            } catch (linkErr) {
              // Failed to link to project
            }
            showToast({ 
              title: 'Success', 
              description: 'Network saved successfully',
              variant: 'success'
            });
          }
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showConfirm(
        `Save failed: ${errorMsg}\n\nWould you like to try again?`,
        () => saveNetwork(isUpdate)
      );
    }
  };

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

  // Cytoscape initialization (initialize once; retry when inputs change)
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (cyRef.current) {
      return;
    }

    try {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: elements as any,
        style: [
          // Base node style - clean, professional biological network appearance
          {
            selector: 'node',
            style: {
              'background-color': (ele: any) => typeColors.get(ele.data('type')) || '#2563eb',
              'label': 'data(label)',
              'color': '#1e293b',
              'font-size': 12,
              'font-weight': 600,
              'font-family': 'Inter, system-ui, sans-serif',
              'text-valign': 'bottom',
              'text-halign': 'center',
              'text-margin-y': 6,
              'width': 48,
              'height': 48,
              'shape': 'ellipse',
              'border-width': 3,
              'border-color': '#ffffff',
              'border-opacity': 1,
              'text-outline-color': '#ffffff',
              'text-outline-width': 2.5,
              'text-outline-opacity': 1,
              'background-opacity': 1,
              'overlay-opacity': 0,
              'z-index': 10,
            } as any,
          },
          // Activating edges - solid green arrows (biological convention)
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#64748b',
              'target-arrow-color': '#64748b',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 1.2,
              'line-opacity': 0.85,
              'overlay-opacity': 0,
              'loop-direction': '-45deg',
              'loop-sweep': '-90deg',
            } as any,
          },
          // Inhibiting edges - red with T-bar (biological convention for inhibition)
          {
            selector: 'edge[edgeType = "inhibitor"]',
            style: {
              'line-color': '#dc2626',
              'target-arrow-color': '#dc2626',
              'target-arrow-shape': 'tee',
              'width': 2.5,
              'curve-style': 'bezier',
              'arrow-scale': 1.4,
              'line-style': 'solid',
              'line-opacity': 0.9,
            } as any,
          },
          // Amplifying/activating edges - green arrows (positive regulation)
          {
            selector: 'edge[edgeType = "amplifier"]',
            style: {
              'line-color': '#059669',
              'target-arrow-color': '#059669',
              'target-arrow-shape': 'triangle',
              'width': 2.5,
              'curve-style': 'bezier',
              'arrow-scale': 1.4,
              'line-opacity': 0.9,
            } as any,
          },
          // Edge drawing mode - source node highlight
          {
            selector: '.edge-source',
            style: {
              'border-color': '#f59e0b',
              'border-width': 4,
              'background-opacity': 1,
            } as any,
          },
          // Delete candidate styling
          {
            selector: '.delete-candidate',
            style: {
              'border-color': '#dc2626',
              'border-width': 4,
              'background-color': '#fee2e2',
              'background-opacity': 1,
            } as any,
          },
          // Selected element - blue glow effect
          {
            selector: ':selected',
            style: {
              'border-width': 4,
              'border-color': '#2563eb',
              'line-color': '#2563eb',
              'target-arrow-color': '#2563eb',
              'background-opacity': 1,
              'line-opacity': 1,
              'overlay-color': '#2563eb',
              'overlay-opacity': 0.15,
              'overlay-padding': 8,
            } as any,
          },
          // Faded elements (for focus mode)
          {
            selector: '.faded',
            style: {
              'opacity': 0.2
            } as any
          },
          // Connected nodes highlight
          {
            selector: '.connected',
            style: {
              'border-color': '#2563eb',
              'border-width': 4,
              'background-opacity': 1,
            } as any
          },
          // Knock-in highlight (green - active/ON)
          {
            selector: '.knock-in-highlight',
            style: {
              'background-color': '#059669',
              'border-color': '#047857',
              'border-width': 4,
              'background-opacity': 1,
            } as any
          },
          // Knock-out highlight (gray with red border - inactive/OFF)
          {
            selector: '.knock-out-highlight',
            style: {
              'background-color': '#94a3b8',
              'border-color': '#dc2626',
              'border-width': 4,
              'background-opacity': 0.7,
              'text-opacity': 0.7,
            } as any
          },
          // Hover state for nodes (subtle highlight)
          {
            selector: 'node:active',
            style: {
              'overlay-color': '#2563eb',
              'overlay-opacity': 0.1,
              'overlay-padding': 6,
            } as any
          },
          // Hover state for edges
          {
            selector: 'edge:active',
            style: {
              'overlay-color': '#2563eb',
              'overlay-opacity': 0.15,
              'overlay-padding': 4,
            } as any
          }
        ],
        layout: {
          name: 'preset',  // Don't run layout at init - handled post-init
        } as any,
        minZoom: 0.05,
        maxZoom: 4,
        wheelSensitivity: 1.5,
        boxSelectionEnabled: true,
      });

      const cy = cyRef.current;

      if (!ehLoaded) {
        (async () => {
          try {
            const ehModule = await import('cytoscape-edgehandles');
            const initializer = (ehModule && (ehModule.default || ehModule)) as any;
            if (typeof initializer === 'function') {
              // Check both module flag AND prototype to prevent duplicate registration
              if (!edgehandlesRegistered && typeof (cytoscape as any).prototype?.edgehandles !== 'function') {
                initializer(cytoscape);
                edgehandlesRegistered = true;
              } else {
                // Already registered, just mark our flag
                edgehandlesRegistered = true;
              }
              try {
                ehRef.current = (cy as any).edgehandles({
                  preview: false,
                  hoverDelay: 150,
                  handleNodes: 'node',
                  handlePosition: 'middle top',
                  handleSize: 10,
                  handleColor: '#f59e0b',
                  handleOutlineColor: '#ffffff',
                  loopAllowed: function () { return true; },
                  edgeType: function () { return 'flat'; },
                  complete: (sourceNode: any, targetNode: any) => {
                    try {
                      const src = String(sourceNode.id());
                      const tgt = String(targetNode.id());
                      const newEdgeId = `edge:${src}:${tgt}`;
                      const maybeExisting = cy.getElementById(newEdgeId);
                      if (!maybeExisting || maybeExisting.length === 0) {
                        // Default to activator edge type
                        try { cy.add({ group: 'edges', data: { id: newEdgeId, source: src, target: tgt, weight: defaultEdgeWeight, edgeType: 'activator' } }); } catch (e) { }
                      }
                      setLocalEdges(prev => {
                        const exists = prev.some(e => e.source === src && e.target === tgt);
                        return exists ? prev : [...prev, { source: src, target: tgt, weight: defaultEdgeWeight, edgeType: 'activator' }];
                      });
                    } catch (e) {
                      // Error in complete handler
                    }
                  }
                });
                // Removed duplicate ehcomplete handler to prevent duplicate edge creation
                try { ehRef.current.disable(); } catch { }
                setEhLoaded(true);
              } catch (e) {
                // Edgehandles initialization error
              }
            }
          } catch (e) {
            // Edgehandles import error
          }
        })();
      } else if (ehRef.current) {
        // Re-attach edgehandles to new cytoscape instance
        try {
          ehRef.current = (cy as any).edgehandles({
            preview: false,
            hoverDelay: 150,
            handleNodes: 'node',
            handlePosition: 'middle top',
            handleSize: 10,
            handleColor: '#f59e0b',
            handleOutlineColor: '#ffffff',
            loopAllowed: function () { return true; },
            edgeType: function () { return 'flat'; },
            complete: (sourceNode: any, targetNode: any) => {
              try {
                const src = String(sourceNode.id());
                const tgt = String(targetNode.id());
                const newEdgeId = `edge:${src}:${tgt}`;
                const maybeExisting = cy.getElementById(newEdgeId);
                if (!maybeExisting || maybeExisting.length === 0) {
                  // Default to activator edge type
                  try { cy.add({ group: 'edges', data: { id: newEdgeId, source: src, target: tgt, weight: defaultEdgeWeight, edgeType: 'activator' } }); } catch (e) { }
                }
                setLocalEdges(prev => {
                  const exists = prev.some(e => e.source === src && e.target === tgt);
                  return exists ? prev : [...prev, { source: src, target: tgt, weight: defaultEdgeWeight, edgeType: 'activator' }];
                });
              } catch (e) {
                // Error in edgehandles complete handler
              }
            }
          });
          ehRef.current.disable();
        } catch (e) {
          // Error re-attaching edgehandles
        }
      }

      // Run layout after a short delay to ensure container is ready
      setTimeout(() => {
        cy.resize();
        try {
          const layout = cy.layout({
            name: 'circle',
            animate: false,
            fit: true,
            padding: 60
          });
          layout.one('layoutstop', () => setGraphReady(true));
          layout.run();
        } catch (err) {
          // Fallback to a simpler layout
          try {
            const fallbackLayout = cy.layout({
              name: 'grid',
              animate: false,
              fit: true,
              padding: 60
            });
            fallbackLayout.one('layoutstop', () => setGraphReady(true));
            fallbackLayout.run();
          } catch (fallbackErr) {
            // Fallback layout error - still show the graph
            setGraphReady(true);
          }
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
          } else {
            // Allow self-loops (source === target) - this creates edges like cln3 -> cln3
            const newEdgeId = `edge:${currentEdgeSource}:${id}`;
            try {
              const existing = cy.getElementById(newEdgeId);
              if (!existing || existing.length === 0) {
                // Default to activator edge type
                cy.add({ group: 'edges', data: { id: newEdgeId, source: currentEdgeSource, target: id, weight: defaultEdgeWeight, edgeType: 'activator' } });
              }
            } catch (e) {
              // Error adding edge via click
            }
            setLocalEdges(prev => {
              const exists = prev.some(e => e.source === currentEdgeSource && e.target === id);
              return exists ? prev : [...prev, { source: currentEdgeSource!, target: id, weight: defaultEdgeWeight, edgeType: 'activator' }];
            });
            cy.getElementById(currentEdgeSource)?.removeClass('edge-source');
            setEdgeSourceId(null);
          }
          return;
        }

        // If this network is rule-based, do not open the properties panel,
        // but still highlight the node's neighborhood (do not fade neighbors).
        if (isRuleBased) {
          //try { showToast({ title: 'Rule-based network', description: 'Node properties are not available for rule-based networks.', variant: 'default' }); } catch { }
          try {
            const neighborhood = node.closedNeighborhood();
            cy.elements().removeClass('faded').removeClass('connected');
            cy.elements().not(neighborhood).addClass('faded');
            // Add 'connected' class to neighbors (excluding the clicked node itself)
            neighborhood.nodes().not(node).addClass('connected');
            try { node.unselect(); } catch { }
          } catch { }
          // Ensure properties panel remains hidden
          setSelectedNode(null);
          setSelectedEdge(null);
          return;
        }

        node.select();
        const neighborhood = node.closedNeighborhood();
        cy.elements().removeClass('faded').removeClass('connected');
        cy.elements().not(neighborhood).addClass('faded');
        // Add 'connected' class to neighbors (excluding the selected node itself)
        neighborhood.nodes().not(node).addClass('connected');

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
          edgeType: data.edgeType || data.properties?.edgeType,
          properties: data.properties || {}
        });
        setSelectedNode(null);

        const connectedNodes = edge.connectedNodes();
        cy.elements().removeClass('faded').removeClass('connected');
        cy.elements().not(connectedNodes).not(edge).addClass('faded');
      });

      cy.on('tap', (evt: any) => {
        const isNode = evt.target && typeof evt.target.isNode === 'function' && evt.target.isNode();
        const isEdge = evt.target && typeof evt.target.isEdge === 'function' && evt.target.isEdge();

        if (!isNode && !isEdge) {
          cy.elements().removeClass('faded').removeClass('connected');
          cy.elements().unselect();
          setSelectedNode(null);
          setSelectedEdge(null);

          // Allow add-node in both rule-based and weight-based networks
          if (toolRef.current === 'add-node') {
            handleAddNodeWithMode(evt);
          }

          // Allow add-edge mode for all network types (rules will be inferred from edges)
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
      // Cytoscape initialization error
    }
  }, [elements, typeColors]);

  // Reconcile elements without full reinit
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    try {
      const desired = elements as any[];
      const desiredIds = new Set<string>(desired.map(el => String(el.data.id)));
      // Remove elements not present
      cy.elements().forEach((el: any) => {
        const id = String(el.data('id'));
        if (!desiredIds.has(id)) {
          try { el.remove(); } catch { }
        }
      });
      // Update existing and add missing
      desired.forEach((el: any) => {
        const id = String(el.data.id);
        const existing = cy.getElementById(id);
        if (existing && existing.length) {
          // Update data fields
          const data = el.data;
          Object.keys(data).forEach(k => {
            try { existing.data(k as any, (data as any)[k]); } catch { }
          });
        } else {
          try { cy.add(el); } catch (e) { }
        }
      });
      // Optionally re-run layout for significant changes (use cose for better biological network layout)
      setTimeout(() => {
        try {
          const layout = cy.layout({ 
            name: 'cose', 
            animate: false, 
            fit: true, 
            padding: 50,
            nodeRepulsion: () => 8000,
            idealEdgeLength: () => 100,
            nodeDimensionsIncludeLabels: true,
          } as any);
          layout.run();
        } catch (err) {
          try { cy.layout({ name: 'circle', animate: false, fit: true, padding: 50 }).run(); } catch { }
        }
      }, 50);
    } catch (e) {
      // Reconcile error
    }
  }, [elements]);

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
      container.style.cursor = 'default'; // This line is unchanged but needs to be retained for context
    }
  }, [tool, edgeSourceId]);

  // If network is rule-based, clear node/edge selections so weight-based properties panel is hidden
  // (rule-based networks don't use node weights, they use Boolean rules instead)
  useEffect(() => {
    if (isRuleBased) {
      // Clear any existing selection so properties panel is hidden
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  }, [isRuleBased]);
  

  // When tool changes, enable/disable edgehandles if available
  useEffect(() => {
    if (!ehRef.current) return;
    try {
      if (tool === 'add-edge') {
        ehRef.current.enable();
      } else {
        ehRef.current.disable();
      }
    } catch (e) { }
  }, [tool]);

  // Apply knock-in highlight class to specified nodes
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    
    // Remove existing highlights
    cy.nodes().removeClass('knock-in-highlight');
    
    // Apply highlight to matching nodes
    if (highlightNodeIds && highlightNodeIds.length > 0) {
      const highlightSet = new Set(highlightNodeIds.map(id => id.toLowerCase()));
      cy.nodes().forEach((node: any) => {
        const nodeId = String(node.data('id') || '').toLowerCase();
        const nodeLabel = String(node.data('label') || '').toLowerCase();
        if (highlightSet.has(nodeId) || highlightSet.has(nodeLabel)) {
          node.addClass('knock-in-highlight');
        }
      });
    }
  }, [highlightNodeIds]);

  // Check if there are any modifications
  const hasModifications = localNodes.length > 0 || localEdges.length > 0 || deletedNodeIds.size > 0 || deletedEdgeIds.size > 0;

  // Notify parent when modifications change
  useEffect(() => {
    onModificationsChange?.(hasModifications);
  }, [hasModifications, onModificationsChange]);

  // Expose live weighted configuration (nodes/edges from current Cytoscape view, tieBehavior always 'hold')
  useImperativeHandle(ref, () => ({
    hasModifications,
    getLiveWeightedConfig: () => {
      if (!cyRef.current) return null;
      try {
        const cy = cyRef.current;
        const nodes = cy.nodes().map((n: any) => {
          const props = n.data('properties') || {};
          // If rule-based, do not expose weight or bias in live weighted config
          return {
            id: String(n.data('id')),
            label: String(n.data('label') ?? n.data('id')),
            properties: isRuleBased ? (() => {
              const copy = { ...props };
              if ('bias' in copy) delete copy.bias;
              return copy;
            })() : props,
          };
        });
        const edges = cy.edges().map((e: any) => ({
          source: String(e.data('source')),
          target: String(e.data('target')),
          weight: Number(e.data('weight') ?? 1),
        }));
        return { nodes, edges, tieBehavior };
      } catch {
        return null;
      }
    },
    getLiveNetworkData: (): NetworkData | null => {
      // Use currentNodes/currentEdges (merged from fetched data + local modifications)
      // Enrich with live Cytoscape positions when available
      const exportNodes = currentNodes.map((n: any) => {
        // Try to get live position from cytoscape if available
        let pos = { x: 0, y: 0 };
        if (cyRef.current) {
          try {
            const cyNode = cyRef.current.getElementById(n.id);
            if (cyNode && cyNode.length > 0) {
              const cyPos = (typeof cyNode.position === 'function') ? cyNode.position() : { x: 0, y: 0 };
              pos = { x: cyPos.x || 0, y: cyPos.y || 0 };
            }
          } catch { }
        }
        // Fallback to stored position
        if (pos.x === 0 && pos.y === 0 && n.properties?.position) {
          pos = n.properties.position;
        }
        const props = n.properties || {};
        return {
          id: String(n.id),
          label: String(n.label ?? n.id),
          type: String(n.type ?? 'custom'),
          weight: Number(n.weight ?? 1),
          position: pos,
          properties: { ...props, position: pos, bias: props.bias ?? 0 },
        };
      });
      const exportEdges = currentEdges.map((e: any) => ({
        source: String(e.source),
        target: String(e.target),
        weight: Number(e.weight ?? 1),
        interaction: e.interaction,
        properties: e.properties || {},
      }));
      // Get metadata from stored network if available
      const existingMetadata = (network as any)?.metadata || {};
      return {
        nodes: exportNodes,
        edges: exportEdges,
        rules: (network as any)?.rules || [],
        metadata: {
          ...existingMetadata,
          type: existingMetadata.type || (isRuleBased ? 'Rule based' : 'Weight based'),
        },
      };
    },
    fitToView: () => {
      if (cyRef.current) {
        cyRef.current.fit(undefined, 60);
      }
    },
    saveAsNew: () => {
      if (readOnly) return;
      void saveNetwork(false);
    },
    updateCurrent: () => {
      if (readOnly) return;
      if (!networkId) return;
      void saveNetwork(true);
    },
    saveNetwork: (update: boolean) => {
      if (readOnly) return;
      void saveNetwork(update);
    }
  }), [networkId, readOnly, hasModifications, currentNodes, currentEdges, network, isRuleBased]);

  // Skip loading check when override data is provided
  if (isLoading && !overrideNetworkData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading network visualization...</p>
        </div>
      </div>
    );
  }

  if (error && !overrideNetworkData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-xl">
        <div className="text-center text-red-600">
          <p className="font-medium">Failed to load network</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden min-h-[800px]">
      {/* Minimal header with unsaved changes badge */}
      {!hideHeaderActions && hasModifications && (
        <div className="flex-shrink-0 border-b bg-card z-30 px-3 py-1">
          <Badge variant="outline" className="text-orange-600 border-orange-300">
            Unsaved Changes
          </Badge>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex relative min-h-0">
        {/* Left Sidebar - Toolbar */}
        {!hideControls && (
          <div className="w-16 bg-gradient-to-b from-muted to-card/95 backdrop-blur-sm border-r border-border flex flex-col items-center py-2 gap-0.5 z-20 shadow-sm overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <Button
              size="sm"
              variant={tool === 'select' ? 'default' : 'ghost'}
              onClick={() => setTool('select')}
              className={`h-9 w-9 rounded-md transition-all ${tool === 'select' ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-accent text-muted-foreground'}`}
              title="Select (S)"
          >
            <MousePointer2 size={20} />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 rounded-md hover:bg-accent disabled:opacity-40 text-muted-foreground"
            onClick={() => {
              const newId = `n-${Date.now()}`;
              const newLabel = `Node ${nodeCounterRef.current + 1}`;
              const newNode = {
                id: newId,
                label: newLabel,
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
                    try { n.select(); } catch { }
                    if (!isRuleBased) {
                      setSelectedNode(newNode);
                    }
                  }
                } catch (e) {
                  // Failed to create center node
                }
              }, 50);
            }}
            title="Add Node (N)"
          >
            <CirclePlus size={20} />
          </Button>

          <div className="w-6 border-t border-border my-1" />

          <Button
            size="sm"
            variant={tool === 'add-edge' ? 'default' : 'ghost'}
            className={`h-9 w-9 rounded-md transition-all ${tool === 'add-edge' ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-accent text-muted-foreground'} disabled:opacity-40`}
            onClick={() => {
              setTool('add-edge');
              if (selectedNode && cyRef.current) {
                const id = selectedNode.id;
                setEdgeSourceId(id);
                try { cyRef.current.getElementById(id)?.addClass('edge-source'); } catch { }
              }
            }}
            title="Add Edge (E)"
          >
            <Link size={20} />
          </Button>

          <div className="w-6 border-t border-border my-1" />

          <Button
            size="sm"
            variant={tool === 'delete' ? 'destructive' : 'ghost'}
            onClick={() => setTool('delete')}
            className={`h-9 w-9 rounded-md transition-all ${tool === 'delete' ? 'bg-destructive text-destructive-foreground shadow-md' : 'hover:bg-accent text-muted-foreground'} disabled:opacity-40`}
            title="Delete (D)"
          >
            <Trash2 size={20} />
          </Button>

          <div className="w-6 border-t border-border my-1" />

          {/* Layout Controls */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!cyRef.current) return;
              try {
                cyRef.current.layout({
                  name: 'cose',
                  animate: true,
                  animationDuration: 500,
                  fit: true,
                  padding: 50,
                  nodeRepulsion: () => 8000,
                  idealEdgeLength: () => 100,
                  nodeDimensionsIncludeLabels: true,
                } as any).run();
              } catch (e) {
                cyRef.current.layout({ name: 'circle', animate: true, fit: true, padding: 50 }).run();
              }
            }}
            className="h-9 w-9 rounded-md hover:bg-accent text-muted-foreground"
            title="Force-Directed Layout"
          >
            <Network size={20} />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!cyRef.current) return;
              cyRef.current.layout({ name: 'circle', animate: true, animationDuration: 300, fit: true, padding: 50 }).run();
            }}
            className="h-9 w-9 rounded-md hover:bg-accent text-muted-foreground"
            title="Circular Layout"
          >
            <Circle size={20} />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!cyRef.current) return;
              cyRef.current.fit(undefined, 50);
            }}
            className="h-9 w-9 rounded-md hover:bg-accent text-muted-foreground"
            title="Fit to View"
          >
            <Maximize size={20} />
          </Button>

          <div className="w-6 border-t border-border my-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              // Get existing rules from the effective network data
              const existingRules = (effectiveNetworkData as any)?.rules || 
                                    (effectiveNetworkData as any)?.data?.rules || 
                                    (effectiveNetworkData as any)?.network_data?.rules || [];
              const rulesArray = Array.isArray(existingRules) ? existingRules : [];
              
              // Build current network data from local state
              const networkData: NetworkData = {
                nodes: localNodes.map(n => ({
                  id: n.id,
                  label: n.label,
                  type: n.type,
                  weight: n.weight,
                  properties: {
                    ...n.properties,
                    position: cyRef.current?.getElementById(n.id)?.position() || n.properties?.position
                  }
                })),
                edges: localEdges.map(e => ({
                  source: e.source,
                  target: e.target,
                  weight: e.weight,
                  interaction: e.interaction
                })),
                rules: isRuleBased ? rulesArray : undefined,
                metadata: {
                  type: isRuleBased ? 'Rule based' : 'Weight based',
                  exportedAt: new Date().toISOString()
                }
              };
              
              // Get network name from fetched network or use default
              const networkName = (network as any)?.name || 
                                  (effectiveNetworkData as any)?.name || 
                                  'network';
              exportAndDownloadNetwork(networkData, networkName);
              
              showToast({ 
                title: 'Network Exported', 
                description: `Saved as ${isRuleBased ? 'rules TXT' : 'weighted CSV'} file`,
                variant: 'default'
              });
            }}
            className="h-9 w-9 rounded-md hover:bg-accent text-muted-foreground"
            title="Export Network"
          >
            <Download size={20} />
          </Button>

          <div className="w-6 border-t border-border my-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsNetworkPersonalizationOpen(true)}
            className="h-9 w-9 rounded-md hover:bg-accent text-muted-foreground"
            title="Network Personalization"
          >
            <User size={20} />
          </Button>
        </div>
        )}

        {/* Main Canvas Area */}
        <div className="flex-1 relative min-w-0 min-h-0">
          {/* Cytoscape container - Professional biological network canvas */}
          <div
            ref={containerRef}
            className="w-full h-full transition-opacity duration-200 bg-muted"
            style={{ 
              backgroundImage: `
                radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.4) 1px, transparent 0)
              `,
              backgroundSize: '20px 20px',
              opacity: graphReady ? 1 : 0,
            }}
            aria-label="Project network visualization"
            key="cytoscape-container"
          />
        </div>

        {/* Right Sidebar - Node/Edge Properties */}
        {!hideControls && (selectedNode || selectedEdge) && (
          <div className="w-80 bg-card/95 backdrop-blur-sm border-l border-border flex-shrink-0 z-20 shadow-lg">
            <Card className="h-full border-0 rounded-none bg-transparent">
              <CardHeader className="pb-3 border-b border-border bg-gradient-to-r from-muted to-card">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-foreground">
                    {selectedNode ? 'Node Properties' : 'Edge Properties'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-accent"
                    onClick={() => {
                      setSelectedNode(null);
                      setSelectedEdge(null);
                      if (cyRef.current) {
                        cyRef.current.elements().removeClass('faded');
                        cyRef.current.elements().unselect();
                      }
                    }}
                  >
                    <X size={20} />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {selectedNode && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Label</label>
                      <Input
                        value={selectedNode.label}
                        className="h-9 text-sm border-border focus:border-primary focus:ring-primary"
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

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</label>
                      <div className="flex items-center gap-2">
                        <Badge
                          className="text-xs px-2.5 py-1 font-medium shadow-sm"
                          style={{
                            backgroundColor: typeColors.get(selectedNode.type) || '#3b82f6',
                            color: 'white'
                          }}
                        >
                          {selectedNode.type}
                        </Badge>
                      </div>
                    </div>

                    {!isRuleBased && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Basal Value</label>
                          <Input
                            type="number"
                            value={Number((selectedNode.properties?.bias ?? 0))}
                            onChange={(e) => {
                              const newBias = parseFloat(e.target.value) || 0;
                              setSelectedNode(prev => prev ? { ...prev, properties: { ...(prev.properties || {}), bias: newBias } } : null);
                              
                              const isLocal = localNodes.some(n => n.id === selectedNode.id);
                              if (isLocal) {
                                // Update existing local node
                                setLocalNodes(prev => prev.map(n => (
                                  n.id === selectedNode.id ? { ...n, properties: { ...(n.properties || {}), bias: newBias } } : n
                                )));
                              } else {
                                // Node from network - add to modifications if not already there
                                const updatedNode = { ...selectedNode, properties: { ...(selectedNode.properties || {}), bias: newBias } };
                                setLocalNodes(prev => {
                                  const alreadyModified = prev.find(n => n.id === selectedNode.id);
                                  if (alreadyModified) {
                                    return prev.map(n => n.id === selectedNode.id ? updatedNode : n);
                                  }
                                  return [...prev, updatedNode];
                                });
                              }
                            }}
                            step="0.1"
                            className="h-9 text-sm border-border focus:border-primary focus:ring-primary"
                          />
                          <p className="text-xs text-muted-foreground">The node's intrinsic activation level (positive = tends ON, negative = tends OFF).</p>
                        </div>
                      </>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ID</label>
                      <div className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg border border-border">
                        {selectedNode.id}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEdgeSourceId(selectedNode.id);
                          if (cyRef.current) {
                            cyRef.current.getElementById(selectedNode.id)?.addClass('edge-source');
                          }
                        }}
                        className="flex-1 h-9 text-xs border-border hover:bg-muted"
                      >
                        Set as Source
                      </Button>

                      {edgeSourceId && edgeSourceId !== selectedNode.id && (
                        <Button
                          size="sm"
                          onClick={() => {
                            const newEdgeId = `edge:${edgeSourceId}:${selectedNode.id}`;
                            if (cyRef.current) {
                              const existing = cyRef.current.getElementById(newEdgeId);
                              if (!existing || existing.length === 0) {
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
                          className="flex-1 h-9 text-xs bg-primary hover:bg-primary/90"
                        >
                          Connect
                        </Button>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          showConfirm(
                            `Are you sure you want to delete node "${selectedNode.label}"?`,
                            () => deleteNode(selectedNode.id)
                          );
                        }}
                        className="w-full h-9 text-xs bg-destructive hover:bg-destructive/90"
                      >
                        <Trash2 size={20} />
                        Delete Node
                      </Button>
                    </div>
                  </>
                )}

                {selectedEdge && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Connection</label>
                      <div className="flex items-center gap-2 text-sm text-foreground bg-muted px-3 py-2 rounded-lg border border-border">
                        <span className="font-medium">{selectedEdge.source}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{selectedEdge.target}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edge Type</label>
                      <select
                        value={selectedEdge.edgeType || selectedEdge.properties?.edgeType || 'activator'}
                        onChange={(e) => {
                          const newEdgeType = e.target.value as 'activator' | 'inhibitor';
                          setSelectedEdge(prev => prev ? { ...prev, edgeType: newEdgeType } : null);
                          if (cyRef.current) {
                            const edges = cyRef.current.edges().filter((edge: any) =>
                              edge.data('source') === selectedEdge.source &&
                              edge.data('target') === selectedEdge.target
                            );
                            edges.forEach((edge: any) => {
                              edge.data('edgeType', newEdgeType);
                            });
                          }
                          // Update local edges
                          const edgeKey = `${selectedEdge.source}-${selectedEdge.target}`;
                          const isLocal = localEdges.some(e => `${e.source}-${e.target}` === edgeKey);
                          if (isLocal) {
                            setLocalEdges(prev =>
                              prev.map(e =>
                                e.source === selectedEdge.source && e.target === selectedEdge.target
                                  ? { ...e, edgeType: newEdgeType }
                                  : e
                              )
                            );
                          } else {
                            setLocalEdges(prev => {
                              const alreadyModified = prev.find(e => e.source === selectedEdge.source && e.target === selectedEdge.target);
                              if (alreadyModified) {
                                return prev.map(e => e.source === selectedEdge.source && e.target === selectedEdge.target ? { ...e, edgeType: newEdgeType } : e);
                              }
                              return [...prev, { source: selectedEdge.source, target: selectedEdge.target, weight: selectedEdge.weight ?? defaultEdgeWeight, edgeType: newEdgeType }];
                            });
                          }
                        }}
                        className="h-9 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:border-primary focus:ring-primary"
                      >
                        <option value="activator">Activator (→)</option>
                        <option value="inhibitor">Inhibitor (⊣)</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Activator edges promote target activation. Inhibitor edges suppress target activation.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weight</label>
                      <Input
                        type="number"
                        value={selectedEdge.weight ?? defaultEdgeWeight}
                        className="h-9 text-sm border-border focus:border-primary focus:ring-primary"
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
                          const isLocal = localEdges.some(e => `${e.source}-${e.target}` === edgeKey);
                          if (isLocal) {
                            // Update existing local edge
                            setLocalEdges(prev =>
                              prev.map(e =>
                                e.source === selectedEdge.source && e.target === selectedEdge.target
                                  ? { ...e, weight: newWeight }
                                  : e
                              )
                            );
                          } else {
                            // Edge from network - add to modifications if not already there
                            setLocalEdges(prev => {
                              const alreadyModified = prev.find(e => e.source === selectedEdge.source && e.target === selectedEdge.target);
                              if (alreadyModified) {
                                return prev.map(e => e.source === selectedEdge.source && e.target === selectedEdge.target ? { ...e, weight: newWeight } : e);
                              }
                              return [...prev, { source: selectedEdge.source, target: selectedEdge.target, weight: newWeight }];
                            });
                          }
                        }}
                        min="0"
                        step="0.1"
                      />
                      <div className="text-xs text-muted-foreground">Edge weight influences the target node’s net input. CSV import format: source,target,weight.</div>
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
                        <Trash2 size={20} />
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
      {newNodeDraft && (
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
                  onChange={(e) => setNewNodeDraft(prev => prev ? { ...prev, label: e.target.value } : null)}
                  placeholder="Enter node label"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Input
                  value={newNodeDraft.type}
                  onChange={(e) => setNewNodeDraft(prev => prev ? { ...prev, type: e.target.value } : null)}
                  placeholder="Enter node type"
                />
              </div>

              {/* Hide basal value for rule-based networks since they use Boolean rules */}
              {!isRuleBased && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Basal Value</label>
                  <Input
                    type="number"
                    value={newNodeDraft.weight ?? 0}
                    onChange={(e) => setNewNodeDraft(prev => prev ? { ...prev, weight: parseFloat(e.target.value) || 0 } : null)}
                    placeholder="Enter basal value (default: 0)"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground">Intrinsic activation level (positive = tends ON, negative = tends OFF)</p>
                </div>
              )}

              {isRuleBased && (
                <p className="text-xs text-muted-foreground">Rules will be automatically inferred from the graph structure when you save.</p>
              )}

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
                    const newLabel = newNodeDraft.label || `Node ${nodeCounterRef.current + 1}`;
                    const newNode = {
                      id: newId,
                      label: newLabel,
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
                          if (!isRuleBased) {
                            setSelectedNode(newNode);
                          }
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

      {/* Network Personalization Dialog */}
      <NetworkPersonalizationDialog 
        open={isNetworkPersonalizationOpen} 
        onOpenChange={setIsNetworkPersonalizationOpen} 
      />
    </div>
  );
});

NetworkGraph.displayName = 'NetworkGraph';

// Memoize to prevent unnecessary re-renders
export default React.memo(NetworkGraph, (prevProps, nextProps) => {
  // Custom comparison for performance
  return (
    prevProps.networkId === nextProps.networkId &&
    prevProps.refreshToken === nextProps.refreshToken &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.height === nextProps.height
  );
});