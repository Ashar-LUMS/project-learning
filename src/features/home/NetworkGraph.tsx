import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
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

export function useNetworkData(projectId?: string, refreshToken: number = 0) {
  const [data, setData] = useState<NetworkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        let res: any;
        if (projectId) {
          res = await supabase.from("projects").select("network_data").eq("id", projectId).single();
        } else {
          res = await supabase.from("projects").select("network_data").single();
        }

        if (res?.error) {
          if (!controller.signal.aborted && isMounted) {
            setError(res.error.message || "Failed to fetch network data");
            setData(null);
          }
        } else {
          const payload = res?.data?.network_data ?? res?.data ?? null;
          if (!controller.signal.aborted && isMounted) {
            setData(payload);
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
  }, [projectId, refreshToken]);

  return { data, isLoading, error } as const;
}

type Props = {
  projectId?: string | null;
  height?: number | string;
  refreshToken?: number;
};

const NetworkGraph: React.FC<Props> = ({ projectId, refreshToken = 0 }) => {
  const { data: network, isLoading, error } = useNetworkData(projectId ?? undefined, refreshToken);
  const fgRef = useRef<ForceGraphMethods<any, { [others: string]: any; source?: any; target?: any; }> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 1600, height: 1200 });

  // AGGRESSIVE ResizeObserver - Use exact container size
  useEffect(() => {
    if (!containerRef.current) return;
    
    const el = containerRef.current;
    
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      console.log("Container rect:", rect.width, "x", rect.height);
      
      // USE EXACT CONTAINER SIZE - NO LIMITS
      const newWidth = Math.floor(rect.width);
      const newHeight = Math.floor(rect.height);
      
      console.log("Setting canvas to:", newWidth, "x", newHeight);
      setSize({ width: newWidth, height: newHeight });
    };

    // Multiple attempts to get proper size
    const attempts = [50, 100, 200, 500, 1000];
    attempts.forEach(delay => {
      setTimeout(updateSize, delay);
    });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        console.log("ResizeObserver:", width, "x", height);
        setSize({ 
          width: Math.floor(width), 
          height: Math.floor(height)
        });
      }
    });
    
    ro.observe(el);
    window.addEventListener('resize', updateSize);
    
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const graphData = useMemo(() => {
    if (!network) return { nodes: [], links: [] };
    return {
      nodes: (network.nodes || []).map((n) => ({ id: n.id, name: n.label, type: n.type })),
      links: (network.edges || []).map((e) => ({ source: e.source, target: e.target, interaction: e.interaction })),
    };
  }, [network]);

  const nodeTypes = useMemo(() => {
    const set = new Set<string>();
    (network?.nodes || []).forEach((n) => set.add(n.type));
    return Array.from(set);
  }, [network]);

  // Create color map for node types
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    nodeTypes.forEach((t, i) => {
      const hue = (i * 137) % 360; // distribute colors
      map.set(t, `hsl(${hue}, 60%, 50%)`);
    });
    return map;
  }, [nodeTypes]);

  const handleNodeClick = useCallback((node: any) => {
    if (!fgRef.current) return;
    const distance = 120;
    const distRatio = 1 + distance / Math.hypot(node.x ?? 1, node.y ?? 1);

    fgRef.current.centerAt((node.x ?? 0) * distRatio, (node.y ?? 0) * distRatio, 400);
    fgRef.current.zoom(1.5, 400);
  }, []);

  // Auto-fit when graph data changes
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current?.zoomToFit(400, 50);
      }, 1000);
    }
  }, [graphData]);

  if (isLoading) return <div role="status" aria-live="polite">Loading network visualization...</div>;
  if (error) return <div role="alert" className="text-red-600">Failed to load network: {error}</div>;
  
  return (
    <div 
      ref={containerRef} 
      // FIXED: Added box-border and removed overflow-hidden to see full borders
      className="w-full h-full relative min-h-[800px] border-4 border-red-500 rounded-2xl bg-blue-50 box-border"
      aria-label="Project network visualization" 
    >
      {/* Enhanced debug info */}
      <div className="absolute top-2 left-2 z-10 bg-black/90 text-white text-sm p-3 rounded-lg font-mono">
        <div>Canvas: {size.width} x {size.height}px</div>
        <div>Nodes: {graphData.nodes.length}</div>
        <div>Links: {graphData.links.length}</div>
      </div>
      
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={size.width}
        height={size.height}
        nodeLabel={(n: any) => `${n.name} — ${n.type}`}
        linkLabel={(l: any) => l.interaction}
        onNodeClick={handleNodeClick}
        linkDirectionalParticles={3}
        linkDirectionalParticleSpeed={0.005}
        // Force engine settings
        cooldownTime={Infinity}
        d3AlphaMin={0.001}
        d3AlphaDecay={0.002}
        d3VelocityDecay={0.1}
        // Much larger visual elements
        nodeRelSize={20}
        nodeVal={() => 25}
        linkWidth={5}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          const color = colorMap.get(node.type) || "#999";
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI, false); // Much larger nodes
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 5;
          ctx.stroke();
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 25, 0, 2 * Math.PI, false); // Much larger hover area
          ctx.fill();
        }}
        onEngineStop={() => {
          setTimeout(() => {
            fgRef.current?.zoomToFit(400, 80);
          }, 200);
        }}
      />
    </div>
  );
};

export default NetworkGraph;