import React, { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import { useNetworkData } from '../../hooks/useNetworkData';
// Re-export the hook to preserve the module's previous named exports
// so Vite React Fast Refresh doesn't detect an incompatible export shape.
export { useNetworkData } from '../../hooks/useNetworkData';
import { Button } from '@/components/ui/button';

type Node = {
  id: string;
  type: string;
  label: string;
};

type Edge = {
  source: string;
  target: string;
  interaction?: string;
};

// useNetworkData is now provided by `src/hooks/useNetworkData.ts`

type Props = {
  networkId?: string | null;
  height?: number | string;
  refreshToken?: number;
};

const NetworkGraph: React.FC<Props> = ({ networkId, refreshToken = 0 }) => {
  const { data: network, isLoading, error } = useNetworkData(
    networkId ?? undefined,
    refreshToken
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const cyInitRetryRef = useRef(0);
  const cyInitTimerRef = useRef<number | null>(null);
  const [cyInitError, setCyInitError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [tool, setTool] = useState<'select' | 'add-node' | 'add-edge'>('select');
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const edgeSourceRef = useRef<string | null>(null);
  useEffect(() => { edgeSourceRef.current = edgeSourceId; }, [edgeSourceId]);
  const nodeCounterRef = useRef(0);
  const ehRef = useRef<any>(null);
  const [ehLoaded, setEhLoaded] = useState(false);
  const [ehEnabled, setEhEnabled] = useState(false);
  const [newNodeDraft, setNewNodeDraft] = useState<{
    modelPos: { x: number; y: number };
    label: string;
    type: string;
  } | null>(null);
  const [localNodes, setLocalNodes] = useState<Node[]>([]);
  const [localEdges, setLocalEdges] = useState<Edge[]>([]);

  // Elements for cytoscape
  const elements = useMemo(() => {
    // Support multiple possible shapes for fetched network data for robustness
    const fetchedNodes = (network && (Array.isArray((network as any).nodes) ? (network as any).nodes : Array.isArray((network as any).data?.nodes) ? (network as any).data.nodes : [])) || [];
    const fetchedEdges = (network && (Array.isArray((network as any).edges) ? (network as any).edges : Array.isArray((network as any).data?.edges) ? (network as any).data.edges : [])) || [];

    const nodeElems = fetchedNodes.map((n: any) => ({
      data: { id: n.id, label: n.label ?? n.id, type: n.type ?? 'custom' },
    }));
    const localNodeElems = (localNodes || []).map((n) => ({ 
      data: { id: n.id, label: n.label ?? n.id, type: n.type } 
    }));
    const edgeElems = fetchedEdges.map((e: any, idx: number) => ({
      data: { 
        id: `e-${idx}-${e.source}-${e.target}`, 
        source: e.source, 
        target: e.target, 
        interaction: e.interaction 
      },
    }));
    const localEdgeElems = (localEdges || []).map((e, idx) => ({ 
      data: { 
        id: `local-e-${idx}-${e.source}-${e.target}`, 
        source: e.source, 
        target: e.target, 
        interaction: e.interaction 
      } 
    }));

    return [...nodeElems, ...localNodeElems, ...edgeElems, ...localEdgeElems];
  }, [network, localNodes, localEdges]);

  // Derive colors from elements' node types so we don't miss types when network shape varies
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
      map.set(t, `hsl(${hue}, 60%, 50%)`);
    });
    return map;
  }, [elements]);

  // Initialize Cytoscape instance
  useEffect(() => {
    // keep ref in sync for handlers registered once
    toolRef.current = tool;

    let didCancel = false;

    const tryInit = () => {
      if (didCancel) return;
      if (!containerRef.current) {
        // Retry a few times in case layout/parent sizing delays mounting
        if (cyInitRetryRef.current < 10) {
          cyInitRetryRef.current++;
          cyInitTimerRef.current = window.setTimeout(tryInit, 150);
        } else {
          setCyInitError('Cytoscape container not available');
        }
        return;
      }

      try {
        // Initialize cytoscape
        cyRef.current = cytoscape({
          container: containerRef.current,
          elements: elements as any,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: any) => typeColors.get(ele.data('type')) || '#666',
            'label': 'data(label)',
            'color': '#1f2937',
            'font-size': 12,
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 40,
            'height': 40,
            'border-width': 2,
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
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
          selector: ':selected',
          style: {
            'border-width': 4,
            'border-color': '#2563eb',
            'line-color': '#2563eb',
            'target-arrow-color': '#2563eb',
          },
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.3
          }
        }
      ],
      layout: { 
        name: 'cose',
        animate: true,
        fit: true,
        padding: 50
      },
          wheelSensitivity: 0.2,
        });
        setCyInitError(null);
      } catch (err: any) {
        setCyInitError(String(err?.message || err));
        // schedule a retry
        if (cyInitRetryRef.current < 5) {
          cyInitRetryRef.current++;
          cyInitTimerRef.current = window.setTimeout(tryInit, 200);
        }
        return;
      }

      const cy = cyRef.current!;

      // Try to dynamically load cytoscape-edgehandles and register it
      (async () => {
        try {
          // dynamically import edgehandles if it's installed; build the string at runtime
          // to avoid Vite pre-bundling / static resolution when the package is optional.
          // @ts-ignore
          const ehModule = await import('cytoscape' + '-edgehandles');
          const initializer = (ehModule && (ehModule.default || ehModule)) as any;
          if (typeof initializer === 'function') {
            initializer(cytoscape);
            // create an instance bound to this cy
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
                complete: (sourceNode: any, targetNode: any, addedEles: any) => {
                  try {
                    const src = String(sourceNode.id());
                    const tgt = String(targetNode.id());
                    console.log('[NetworkGraph] edgehandles complete', { src, tgt, addedEles });
                    // Ensure the edge exists in cy (some edgehandles variants add it automatically)
                    const maybeExisting = cy.edges().filter((e: any) => String(e.data('source')) === src && String(e.data('target')) === tgt);
                    if (!maybeExisting || maybeExisting.length === 0) {
                      const newEdgeId = `eh-e-${Date.now()}`;
                      try { cy.add({ group: 'edges', data: { id: newEdgeId, source: src, target: tgt } }); } catch (e) { console.log('[NetworkGraph] edgehandles fallback cy.add error', e); }
                      console.log('[NetworkGraph] edgehandles: added fallback edge to cy');
                    }
                    setLocalEdges(prev => [...prev, { source: src, target: tgt }]);
                  } catch (e) {
                    console.log('[NetworkGraph] edgehandles complete error', e);
                  }
                }
              });
              console.log('[NetworkGraph] edgehandles instance created', ehRef.current);
              // Also register cy-level events for edgehandles lifecycle
              try {
                cy.on('ehcomplete', (evt: any) => {
                  try {
                    const src = String(evt.source.id());
                    const tgt = String(evt.target.id());
                    console.log('[NetworkGraph] cy ehcomplete event', { src, tgt, evt });
                    setLocalEdges(prev => [...prev, { source: src, target: tgt }]);
                  } catch (e) {
                    console.log('[NetworkGraph] cy ehcomplete handler error', e);
                  }
                });
                cy.on('ehstart', () => console.log('[NetworkGraph] ehstart'));
                cy.on('ehstop', () => console.log('[NetworkGraph] ehstop'));
              } catch (e) {
                // ignore
              }
              // disable by default; enable when tool is add-edge
              try { ehRef.current.disable(); } catch {}
              setEhLoaded(true);
              // disable by default; enable when tool is add-edge
              try { ehRef.current.disable(); } catch {}
              setEhLoaded(true);
            } catch (e) {
              // ignore if API not available
            }
          }
        } catch (e) {
          // edgehandles not installed — that's fine, fallback will work
        }
      })();

    // Run layout after initialization
    setTimeout(() => {
      cy.resize();
      const layout = cy.layout({ name: 'cose', animate: true, fit: true, padding: 50 });
      layout.run();
      cy.one('layoutstop', () => {
        try { cy.fit(undefined, 50); } catch { /* ignore */ }
      });
    }, 100);

    // Event handlers
    cy.on('tap', 'node', (evt: any) => {
      const node = evt.target;
      const clickedId = String(node.data('id'));
      const currentEdgeSource = edgeSourceRef.current;
      console.log('[NetworkGraph] node tap', { tool: toolRef.current, edgeSourceId: currentEdgeSource, clickedId });

      if (toolRef.current === 'add-edge') {
        const id = clickedId;
        if (!currentEdgeSource) {
          console.log('[NetworkGraph] set as edge source, node info', { id, isNode: typeof node.isNode === 'function' ? node.isNode() : 'unknown' });
          setEdgeSourceId(id);
          try {
            node.addClass('edge-source');
          } catch (err) {
            console.log('[NetworkGraph] node.addClass failed, falling back to getElementById', err);
            try { cy.getElementById(id)?.addClass('edge-source'); } catch (e) { /* ignore */ }
          }
        } else if (currentEdgeSource === id) {
          setEdgeSourceId(null);
          try {
            node.removeClass('edge-source');
          } catch (err) {
            try { cy.getElementById(id)?.removeClass('edge-source'); } catch (e) { /* ignore */ }
          }
        } else {
          const newEdgeId = `local-e-${Date.now()}`;
          try {
            cy.add({ group: 'edges', data: { id: newEdgeId, source: currentEdgeSource, target: id } });
            console.log('[NetworkGraph] add-edge via click: added to cy, elements:', cy.elements().length);
          } catch (e) {
            console.log('[NetworkGraph] add-edge via click: cy.add error', e);
          }
          setLocalEdges(prev => [...prev, { source: currentEdgeSource!, target: id }]);
          cy.getElementById(currentEdgeSource)?.removeClass('edge-source');
          setEdgeSourceId(null);
        }
        return;
      }

      // Select node and show neighborhood
      node.select();
      const neighborhood = node.closedNeighborhood();
      cy.elements().removeClass('faded');
      cy.elements().not(neighborhood).addClass('faded');
      
      const data = node.data();
      setSelectedNode({ 
        id: String(data.id), 
        type: String(data.type), 
        label: String(data.label || data.id) 
      });
    });

    cy.on('tap', (evt: any) => {
      // Determine whether the event target is a node. If not, treat as background/core.
      const isNode = evt.target && typeof evt.target.isNode === 'function' && evt.target.isNode();
      if (!isNode) {
        cy.elements().removeClass('faded');
        cy.elements().unselect();
        setSelectedNode(null);

        if (toolRef.current === 'add-node') {
          const pos = evt.position || evt.renderedPosition || { x: 0, y: 0 };
          setNewNodeDraft({ 
            modelPos: { x: pos.x, y: pos.y }, 
            label: `node-${nodeCounterRef.current + 1}`,
            type: 'custom' 
          });
        }

        if (toolRef.current === 'add-edge' && edgeSourceRef.current) {
          cy.getElementById(edgeSourceRef.current)?.removeClass('edge-source');
          setEdgeSourceId(null);
        }
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (cyRef.current) {
        cyRef.current.resize();
        cyRef.current.fit(undefined, 50);
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
      };

    tryInit();

    return () => {
      didCancel = true;
      if (cyInitTimerRef.current) {
        clearTimeout(cyInitTimerRef.current);
      }
    };
  }, []); // Run only once on mount

  // Update elements when they change
  useEffect(() => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    // Update elements used by Cytoscape
    
    // Remove all existing elements
    const currentElements = cy.elements();
    if (currentElements.length > 0) {
      currentElements.remove();
    }
    
    // Add new elements
    if (elements.length > 0) {
      cy.add(elements as any);
      // ensure cy knows about current container size
      cy.resize();
      // Run layout after adding elements and fit after it completes
      const layout = cy.layout({ name: 'cose', animate: true, fit: true, padding: 50 });
      layout.run();
      cy.one('layoutstop', () => {
        try { cy.fit(undefined, 50); } catch { /* ignore */ }
      });
    }
  }, [elements]);

  // Update tool-specific behavior
  useEffect(() => {
    if (!containerRef.current) return;

    // Update cursor based on tool
    const container = containerRef.current;
    if (tool === 'add-node') {
      container.style.cursor = 'crosshair';
    } else if (tool === 'add-edge') {
      container.style.cursor = 'pointer';
    } else {
      container.style.cursor = 'default';
    }

    if (tool !== 'add-edge' && edgeSourceId && cyRef.current) {
      cyRef.current.getElementById(edgeSourceId)?.removeClass('edge-source');
      setEdgeSourceId(null);
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
    } catch (e) {
      // ignore
    }
  }, [tool]);

  // Debug state watcher (keep minimal)
  useEffect(() => {
    // Intentionally left minimal for dev troubleshooting
  }, [network, elements, tool]);

           // Update elements used by Cytoscape
  if (isLoading) return <div role="status" aria-live="polite">Loading network visualization...</div>;
  if (error) return <div role="alert" className="text-red-600">Failed to load network: {error}</div>;

  const nodesCount = elements.filter(e => e.data && !('source' in e.data)).length;
  const edgesCount = elements.filter(e => e.data && ('source' in e.data)).length;

  const showNoElementsWarning = elements.length === 0 && !!network;
  const rawNetworkJson = network ? JSON.stringify(network, null, 2) : null;
  // Derive fetched nodes/edges counts defensively from possible shapes
  const fetchedNodes = (network && (Array.isArray((network as any).nodes) ? (network as any).nodes : Array.isArray((network as any).data?.nodes) ? (network as any).data.nodes : [])) || [];
  const fetchedEdges = (network && (Array.isArray((network as any).edges) ? (network as any).edges : Array.isArray((network as any).data?.edges) ? (network as any).data.edges : [])) || [];
  const fetchedNodeCount = fetchedNodes.length;
  const fetchedEdgeCount = fetchedEdges.length;
  const cyInitialized = Boolean(cyRef.current);

  return (
    <div className="w-full h-full relative min-h-[800px] rounded-2xl bg-white border flex overflow-visible">
      {/* Toolbar */}
      <div className="absolute left-2 top-4 bottom-4 w-12 flex flex-col items-center gap-2 z-40">
        <Button 
          size="sm" 
          variant={tool === 'select' ? 'default' : 'ghost'} 
          className="w-10 h-10" 
          onClick={() => setTool('select')}
          title="Select tool"
        >
          S
        </Button>
        <Button 
          size="sm" 
          variant={tool === 'add-node' ? 'default' : 'ghost'} 
          className="w-10 h-10" 
          onClick={() => setTool('add-node')}
          title="Add node tool"
        >
          +
        </Button>
        <Button 
          size="sm" 
          variant={tool === 'add-edge' ? 'default' : 'ghost'} 
          className="w-10 h-10" 
          onClick={() => {
            // activate add-edge tool and, if a node is currently selected, use it as the source
            setTool('add-edge');
            if (selectedNode && cyRef.current) {
              const id = selectedNode.id;
              setEdgeSourceId(id);
              try { cyRef.current.getElementById(id)?.addClass('edge-source'); } catch {}
            }
          }}
          title="Add edge tool"
        >
          ⇄
        </Button>
      </div>

      {/* Cytoscape container */}
      <div
        ref={containerRef}
        className="flex-1 h-full bg-gray-50"
        style={{ minHeight: 600, height: '600px' }}
        aria-label="Project network visualization"
      />

      {/* Debug overlay */}
      <div className="absolute left-3 top-3 bg-white/90 rounded px-2 py-1 text-xs shadow z-20 border">
        <div className="font-mono text-[11px]">Mode: {tool} • Nodes: {nodesCount} • Edges: {edgesCount}</div>
        <div className="text-[11px] text-muted-foreground">Fetched: {fetchedNodeCount} nodes • {fetchedEdgeCount} edges</div>
        <div className="text-[11px]">NetworkId: {String(networkId ?? 'none')}</div>
        <div className="text-[11px]">Cytoscape: {cyInitialized ? 'initialized' : 'not initialized'}</div>
        {cyInitError && <div className="text-[11px] text-red-600">Init error: {cyInitError}</div>}
        <div className="text-[11px]">EdgeHandles: {ehLoaded ? (ehEnabled ? 'loaded & enabled' : 'loaded') : 'not loaded'}</div>
        <div className="text-[11px]">Selected: {selectedNode ? selectedNode.id : 'none'}</div>
        <div className="mt-1 flex gap-2">
          <button className="text-xs text-blue-600 underline" onClick={() => {
            // Debug helper: attempt to add a temporary test node to verify rendering
            if (!cyRef.current) return;
            const id = `debug-${Date.now()}`;
            cyRef.current.add({ data: { id, label: 'Debug node' }, position: { x: 0, y: 0 } });
            setTimeout(() => { cyRef.current?.fit(undefined, 50); }, 50);
          }}>Render test node</button>
          <button className="text-xs text-blue-600 underline" onClick={() => {
            // Log cy state to console for debugging
            if (cyRef.current) {
              try { console.log('[NetworkGraph] cy elements count:', cyRef.current.elements().length); } catch (e) { console.log('[NetworkGraph] cy log error', e); }
            } else {
              console.log('[NetworkGraph] cy is not initialized');
            }
          }}>Log cy</button>
          <button className="text-xs text-blue-600 underline" onClick={() => {
            // Force initialize cytoscape if container exists and cy not created
            if (cyRef.current) return;
            if (!containerRef.current) {
              setCyInitError('Container not available for forced init');
              return;
            }
            try {
              const created = cytoscape({
                container: containerRef.current,
                elements: elements as any,
                style: [
                  {
                    selector: 'node',
                    style: {
                      'background-color': (ele: any) => typeColors.get(ele.data('type')) || '#666',
                      'label': 'data(label)',
                      'color': '#1f2937',
                      'font-size': 12,
                      'text-valign': 'center',
                      'text-halign': 'center',
                      'width': 40,
                      'height': 40,
                      'border-width': 2,
                      'border-color': '#ffffff',
                    },
                  },
                  { selector: 'edge', style: { width: 3, 'line-color': '#94a3b8', 'target-arrow-color': '#94a3b8', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
                ],
                layout: { name: 'cose', animate: true, fit: true, padding: 50 },
                wheelSensitivity: 0.2,
              });
              cyRef.current = created as any;
              setCyInitError(null);
              if (cyRef.current) {
                cyRef.current.resize();
                const layout = cyRef.current.layout({ name: 'cose', animate: true, fit: true, padding: 50 });
                layout.run();
                cyRef.current.one('layoutstop', () => { try { cyRef.current?.fit(undefined, 50); } catch {} });
              }
            } catch (err: any) {
              setCyInitError(String(err?.message || err));
            }
          }}>Force init</button>
        </div>
      </div>

      {/* Helpful debug panel when network exists but no elements are produced */}
      {showNoElementsWarning && (
        <div className="absolute left-3 top-14 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-900 shadow z-20 max-w-md">
          <div className="font-semibold">Warning: network fetched but no nodes/edges were found.</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Raw network data (truncated):</div>
          <pre className="mt-2 max-h-40 overflow-auto text-[11px] whitespace-pre-wrap">{rawNetworkJson?.slice(0, 2000)}</pre>
        </div>
      )}

      {/* Node creation form */}
      {newNodeDraft && (
        <div className="absolute z-50 left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="bg-white border-2 rounded-lg p-4 w-64 shadow-xl">
            <div className="text-sm font-semibold mb-3">Create New Node</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1">Label</label>
                <input 
                  className="w-full p-2 border rounded text-sm" 
                  value={newNodeDraft.label} 
                  onChange={(e) => setNewNodeDraft({ ...newNodeDraft, label: e.target.value })} 
                  autoFocus
                  placeholder="Enter node label"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Type</label>
                <input 
                  className="w-full p-2 border rounded text-sm" 
                  value={newNodeDraft.type} 
                  onChange={(e) => setNewNodeDraft({ ...newNodeDraft, type: e.target.value })} 
                  placeholder="Enter node type"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => setNewNodeDraft(null)}>Cancel</Button>
              <Button size="sm" onClick={() => {
                const newId = `n-${Date.now()}`;
                const newNode = {
                  id: newId,
                  label: newNodeDraft.label || `node-${nodeCounterRef.current + 1}`,
                  type: newNodeDraft.type || 'custom'
                };
                
                setLocalNodes(prev => [...prev, newNode]);
                setNewNodeDraft(null);
                nodeCounterRef.current++;
                
                // Select the new node
                setTimeout(() => {
                  if (cyRef.current) {
                    const addedNode = cyRef.current.getElementById(newId);
                    if (addedNode) {
                      addedNode.select();
                      setSelectedNode(newNode);
                    }
                  }
                }, 100);
              }}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Node properties panel */}
      {selectedNode && (
        <aside className="absolute right-0 top-0 bottom-0 w-80 border-l bg-white z-50 shadow-lg">
          <div className="p-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold">Node Properties</h3>
                <div className="text-xs text-gray-500 mt-1">ID: {selectedNode.id}</div>
              </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    // Set this node as the edge source for one-click connect
                    setEdgeSourceId(selectedNode.id);
                    if (cyRef.current) {
                      try { cyRef.current.getElementById(selectedNode.id)?.addClass('edge-source'); } catch {}
                    }
                  }}>
                    Set as source
                  </Button>

                  <Button size="sm" variant="outline" onClick={() => {
                    // If there is an existing edge source, connect it to this node
                    if (!edgeSourceId) return;
                    if (edgeSourceId === selectedNode.id) return;
                    const newEdgeId = `local-e-${Date.now()}`;
                    if (cyRef.current) {
                      cyRef.current.add({ group: 'edges', data: { id: newEdgeId, source: edgeSourceId, target: selectedNode.id } });
                    }
                    setLocalEdges(prev => [...prev, { source: edgeSourceId, target: selectedNode.id }]);
                    // clear source
                    if (cyRef.current) {
                      try { cyRef.current.getElementById(edgeSourceId)?.removeClass('edge-source'); } catch {}
                    }
                    setEdgeSourceId(null);
                  }}>
                    Connect from source
                  </Button>

                  <Button size="sm" variant="ghost" onClick={() => {
                setSelectedNode(null);
                if (cyRef.current) {
                  cyRef.current.elements().removeClass('faded');
                  cyRef.current.elements().unselect();
                }
                  }}>
                    ×
                  </Button>
                </div>
            </div>
          </div>
          
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-2">Label</label>
                <input
                  className="w-full p-2 border rounded text-sm"
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
                    // Update local nodes if this is a locally added node
                    if (selectedNode.id.startsWith('n-')) {
                      setLocalNodes(prev => 
                        prev.map(n => n.id === selectedNode.id ? { ...n, label: newLabel } : n)
                      );
                    }
                  }}
                />
              </div>
              
              <div>
                <div className="text-xs font-medium mb-2">Type</div>
                <div className="text-sm text-gray-700 p-2 bg-gray-50 rounded border">
                  {selectedNode.type}
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default NetworkGraph;