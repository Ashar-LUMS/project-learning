import React, { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import { supabase } from "../../supabaseClient";
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

type NetworkData = {
  nodes: Node[];
  edges: Edge[];
  rules?: string[] | null;
  metadata?: {
    dataset?: string;
    version?: string;
    description?: string;
  };
};

export function useNetworkData(networkId?: string, refreshToken: number = 0) {
  const [data, setData] = useState<NetworkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchData() {
      if (!networkId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        // Get network data for specific network
        const { data: networkData, error: networkError } = await supabase
          .from('networks')
          .select('network_data')
          .eq('id', networkId)
          .single();

        if (networkError) {
          if (!controller.signal.aborted && isMounted) {
            setError(networkError.message || "Failed to fetch network data");
            setData(null);
          }
        } else {
          if (!controller.signal.aborted && isMounted) {
            setData(networkData?.network_data || null);
          }
        }
      } catch (err: any) {
        if (!controller.signal.aborted && isMounted) {
          setError(err?.message || String(err));
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted && isMounted) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [networkId, refreshToken]);

  return { data, isLoading, error } as const;
}

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
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [tool, setTool] = useState<'select' | 'add-node' | 'add-edge'>('select');
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const nodeCounterRef = useRef(0);
  const [newNodeDraft, setNewNodeDraft] = useState<{
    modelPos: { x: number; y: number };
    label: string;
    type: string;
  } | null>(null);
  // Keep a size state if future features need it; currently unused, so removed to satisfy lint

  // Resize observer to keep Cytoscape fitting to container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const el = containerRef.current;
    
    const updateSize = () => {
      // Trigger cy resize/fit when container changes
      if (cyRef.current) {
        cyRef.current.resize();
        cyRef.current.fit(undefined, 40);
      }
    };

    // Multiple attempts to get proper size
    const attempts = [50, 100, 200, 500, 1000];
    attempts.forEach(delay => {
      setTimeout(updateSize, delay);
    });

    const ro = new ResizeObserver(() => {
      updateSize();
    });
    
    ro.observe(el);
    window.addEventListener('resize', updateSize);
    
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const elements = useMemo(() => {
    const nodeElems = (network?.nodes || []).map((n) => ({
      data: { id: n.id, label: n.label ?? n.id, type: n.type },
    }));
    // generate unique edge ids to avoid duplicates
    const edgeElems = (network?.edges || []).map((e, idx) => ({
      data: { id: `e-${idx}-${e.source}-${e.target}`, source: e.source, target: e.target, interaction: e.interaction },
    }));
    return [...nodeElems, ...edgeElems];
  }, [network]);

  const typeColors = useMemo(() => {
    const types = Array.from(new Set((network?.nodes || []).map((n) => n.type)));
    const map = new Map<string, string>();
    types.forEach((t, i) => {
      const hue = (i * 137) % 360;
      map.set(t, `hsl(${hue}, 60%, 50%)`);
    });
    return map;
  }, [network]);

  // Initialize or update Cytoscape instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Create cy instance once
    if (!cyRef.current) {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: [],
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
              'width': 30,
              'height': 30,
              'border-width': 2,
              'border-color': '#ffffff',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
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
              'border-width': 3,
              'border-color': '#2563eb',
              'line-color': '#2563eb',
              'target-arrow-color': '#2563eb',
              'background-color': '#2563eb',
              'color': '#0b1020',
            },
          },
        ],
        layout: { name: 'cose' },
        wheelSensitivity: 0.2,
      });

      // basic interaction: focus node on tap/click and expose selected node
      const handleNodeSelect = (evt: any) => {
        console.log('[NetworkGraph] node click evt', evt && evt.target && evt.target.data ? evt.target.data() : evt);
        const node = evt.target;
        const neighborhood = node.closedNeighborhood();
        cyRef.current?.elements().removeClass('faded');
        cyRef.current?.elements().not(neighborhood).addClass('faded');
        // behavior depends on active tool
        if (tool === 'add-edge') {
          const id = String(node.data('id'));
          if (!edgeSourceId) {
            setEdgeSourceId(id);
            // mark source visually
            node.addClass('edge-source');
          } else if (edgeSourceId === id) {
            // clicked same node: cancel
            setEdgeSourceId(null);
            node.removeClass('edge-source');
          } else {
            // create edge from edgeSourceId -> id
            const cy = cyRef.current!;
            const newEdgeId = `e-${Date.now()}-${edgeSourceId}-${id}`;
            cy.add({ group: 'edges', data: { id: newEdgeId, source: edgeSourceId, target: id } });
            // clear source marker
            const srcNode = cy.getElementById(edgeSourceId);
            if (srcNode) srcNode.removeClass('edge-source');
            setEdgeSourceId(null);
          }
          return;
        }

        node.select();
        // expose node data to React UI
        try {
          const data = node.data() as Node;
          setSelectedNode({ id: String(data.id), type: String(data.type), label: String(data.label ?? data.id) });
        } catch {
          setSelectedNode(null);
        }
      };

      cyRef.current.on('tap', 'node', handleNodeSelect);
      cyRef.current.on('click', 'node', handleNodeSelect);

      // tap/click on background clears selection
      const handleBackgroundTap = (evt: any) => {
        console.log('[NetworkGraph] background click evt', evt);
        const target = evt.target;
        // Avoid using invalid selectors like `core` with element.is().
        // The safest check for a background/core event is equality with the cy instance.
        const isCore = target === cyRef.current;
        if (isCore) {
          cyRef.current?.elements().removeClass('faded');
          cyRef.current?.elements().unselect();
          setSelectedNode(null);
          // if add-node tool is active, open draft form at model position
          if (tool === 'add-node') {
            const pos = evt.position || evt.renderedPosition || { x: 0, y: 0 };
            console.log('[NetworkGraph] opening new node draft at model pos', pos);
            setNewNodeDraft({ modelPos: { x: pos.x, y: pos.y }, label: `node-${nodeCounterRef.current + 1}`, type: 'custom' });
          }
        }
      };
      cyRef.current.on('tap', handleBackgroundTap);
      cyRef.current.on('click', handleBackgroundTap);

      cyRef.current.style().selector('.faded').style({ opacity: 0.25 }).update();
    }

    // Update elements and run layout when data changes
    const cy = cyRef.current;
    if (cy) {
      cy.batch(() => {
        cy.elements().remove();
        cy.add(elements as any);
      });
      const layout = cy.layout({ name: 'cose', animate: true, fit: true });
      layout.run();
      setTimeout(() => {
        cy.resize();
        cy.fit(undefined, 40);
      }, 100);
    }

    return () => {
      // keep instance alive across renders; remove our event handlers to avoid duplicates
      const cy = cyRef.current;
      if (cy) {
        try {
          cy.off('tap', 'node');
          cy.off('click', 'node');
          cy.off('tap');
          cy.off('click');
        } catch {}
      }
    };
  }, [elements, typeColors, tool, edgeSourceId]);

  useEffect(() => {
    console.log('[NetworkGraph] tool state', tool, 'edgeSourceId', edgeSourceId);
  }, [tool, edgeSourceId]);

  useEffect(() => {
    console.log('[NetworkGraph] selectedNode', selectedNode);
  }, [selectedNode]);

  if (isLoading) return <div role="status" aria-live="polite">Loading network visualization...</div>;
  if (error) return <div role="alert" className="text-red-600">Failed to load network: {error}</div>;

  // Render cytoscape container and a right-side properties panel when a node is selected
  return (
    <div className="w-full h-full relative min-h-[800px] rounded-2xl bg-white border flex overflow-visible">
      {/* left vertical toolbar (narrow) */}
      <div className="absolute left-2 top-4 bottom-4 w-12 flex flex-col items-center gap-2 z-40">
        <Button size="sm" variant={tool === 'select' ? 'default' : 'ghost'} className="w-10 h-10" onClick={() => {
          setTool('select');
          // clear any edge source marker
          try { if (edgeSourceId && cyRef.current) cyRef.current.getElementById(edgeSourceId)?.removeClass('edge-source'); } catch {}
          setEdgeSourceId(null);
        }}>S</Button>
        <Button size="sm" variant={tool === 'add-node' ? 'default' : 'ghost'} className="w-10 h-10" onClick={() => {
          setTool('add-node');
          try { if (edgeSourceId && cyRef.current) cyRef.current.getElementById(edgeSourceId)?.removeClass('edge-source'); } catch {}
          setEdgeSourceId(null);
        }} title="Add node">+</Button>
        <Button size="sm" variant={tool === 'add-edge' ? 'default' : 'ghost'} className="w-10 h-10" onClick={() => {
          setTool('add-edge');
          try { if (edgeSourceId && cyRef.current) cyRef.current.getElementById(edgeSourceId)?.removeClass('edge-source'); } catch {}
          setEdgeSourceId(null);
        }} title="Add edge">⇄</Button>

      </div>

      <div
        ref={containerRef}
        className="flex-1 h-full"
        style={{ minHeight: 600, height: '600px' }}
        aria-label="Project network visualization"
      />

      {/* small debug overlay so it's obvious when networks are empty or loaded */}
      <div className="absolute left-3 top-3 bg-white/80 rounded px-2 py-1 text-xs shadow z-20">
        Mode: {tool} • Nodes: {(network?.nodes || []).length} • Edges: {(network?.edges || []).length} • Selected: {selectedNode ? selectedNode.id : 'none'}
      </div>

      {/* Draft node input form (appears when user clicks canvas in add-node mode) */}
      {newNodeDraft && containerRef.current && (
        (() => {
          // center the draft form in the container for reliability
          return (
            <div className="absolute z-60 left-1/2 top-1/2" style={{ transform: 'translate(-50%, -50%)' }}>
              <div className="bg-card border rounded p-3 w-56 shadow-lg">
                <div className="text-sm font-medium mb-2">New node</div>
                <label className="text-xs">Label</label>
                <input className="w-full mb-2 p-1 border rounded" value={newNodeDraft.label} onChange={(e) => setNewNodeDraft({ ...newNodeDraft, label: e.target.value })} />
                <label className="text-xs">Type</label>
                <input className="w-full mb-3 p-1 border rounded" value={newNodeDraft.type} onChange={(e) => setNewNodeDraft({ ...newNodeDraft, type: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setNewNodeDraft(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => {
                    try {
                      const cy = cyRef.current!;
                      const newId = `n-${Date.now()}-${nodeCounterRef.current++}`;
                      cy.add({ group: 'nodes', data: { id: newId, label: newNodeDraft.label || newId, type: newNodeDraft.type || 'custom' }, position: { x: newNodeDraft.modelPos.x, y: newNodeDraft.modelPos.y } } as any);
                      const added = cy.getElementById(newId);
                      if (added) {
                        added.select();
                        setSelectedNode({ id: newId, label: newNodeDraft.label || newId, type: newNodeDraft.type || 'custom' });
                      }
                    } catch (err) {
                      // ignore
                    } finally {
                      setNewNodeDraft(null);
                    }
                  }}>Add</Button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {selectedNode && (
        <aside className="absolute right-0 top-0 bottom-0 w-80 border-l p-4 bg-card z-50" style={{ zIndex: 50 }}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold">Node properties</h3>
              <div className="text-xs text-muted-foreground">ID: {selectedNode.id}</div>
            </div>
            <div>
              <Button size="sm" variant="ghost" onClick={() => {
                setSelectedNode(null);
                if (cyRef.current) {
                  cyRef.current.elements().removeClass('faded');
                  cyRef.current.elements().unselect();
                }
              }}>Close</Button>
            </div>
          </div>

          <label className="text-xs font-medium">Label</label>
          <input
            className="w-full mb-2 mt-1 p-2 rounded border"
            value={selectedNode.label}
            onChange={(e) => {
              const newLabel = e.target.value;
              // update react state
              setSelectedNode((prev) => (prev ? { ...prev, label: newLabel } : prev));
              // update cytoscape node data if present
              try {
                const id = selectedNode.id;
                const node = cyRef.current?.getElementById(id);
                if (node) node.data('label', newLabel);
              } catch {}
            }}
          />

          <div className="text-xs text-muted-foreground mt-2"><strong>Type:</strong> {selectedNode.type}</div>
        </aside>
      )}
    </div>
  );
};

export default NetworkGraph;