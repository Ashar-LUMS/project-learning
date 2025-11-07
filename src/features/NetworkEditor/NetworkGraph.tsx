import React, { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import { supabase } from "../../supabaseClient";

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

      // basic interaction: focus node on tap/click
      cyRef.current.on('tap', 'node', (evt) => {
        const node = evt.target;
        const neighborhood = node.closedNeighborhood();
        cyRef.current?.elements().removeClass('faded');
        cyRef.current?.elements().not(neighborhood).addClass('faded');
        node.select();
      });
      cyRef.current.on('tap', (evt) => {
        if (evt.target === cyRef.current) {
          cyRef.current?.elements().removeClass('faded');
          cyRef.current?.elements().unselect();
        }
      });
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
      // keep instance alive across renders; no cleanup here
    };
  }, [elements, typeColors]);

  if (isLoading) return <div role="status" aria-live="polite">Loading network visualization...</div>;
  if (error) return <div role="alert" className="text-red-600">Failed to load network: {error}</div>;
  
  return (
    <div
      ref={containerRef}
      className="w-full h-full relative min-h-[800px] rounded-2xl bg-white border"
      aria-label="Project network visualization"
    />
  );
};

export default NetworkGraph;