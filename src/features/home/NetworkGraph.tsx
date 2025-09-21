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
  metadata?: {
    dataset?: string;
    version?: string;
    description?: string;
  };
};

export function useNetworkData(projectId?: string) {
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
  }, [projectId]);

  return { data, isLoading, error } as const;
}

type Props = {
  projectId?: string | null;
  height?: number | string;
};

const NetworkGraph: React.FC<Props> = ({ projectId, height = 600 }) => {
  const { data: network, isLoading, error } = useNetworkData(projectId ?? undefined);
  const fgRef = useRef<ForceGraphMethods<any, { [others: string]: any; source?: any; target?: any; }> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  // Responsive: use ResizeObserver to adjust size
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ width: Math.max(300, Math.floor(cr.width)), height: Math.max(300, Math.floor(cr.height)) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
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
    // center node and slightly zoom in
    if (!fgRef.current) return;
    const distance = 120;
    const distRatio = 1 + distance / Math.hypot(node.x ?? 1, node.y ?? 1);

    fgRef.current.centerAt((node.x ?? 0) * distRatio, (node.y ?? 0) * distRatio, 400);
    fgRef.current.zoom(1.5, 400);
  }, []);

  if (isLoading) return <div role="status" aria-live="polite">Loading network visualization...</div>;
  if (error) return <div role="alert" className="text-red-600">Failed to load network: {error}</div>;
  if (!network || (!network.nodes?.length && !network.edges?.length)) return <div className="text-gray-600">No network data available for this project.</div>;

  return (
    <div ref={containerRef} style={{ width: "100%", height }} aria-label="Project network visualization">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={size.width}
        height={size.height}
        nodeLabel={(n: any) => `${n.name} — ${n.type}`}
        linkLabel={(l: any) => l.interaction}
        onNodeClick={handleNodeClick}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          const color = colorMap.get(node.type) || "#999";
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
      />

      {/* Legend */}
      <div style={{ position: "absolute", right: 12, top: 12, background: "rgba(255,255,255,0.9)", borderRadius: 8, padding: "8px 10px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Legend</div>
        {nodeTypes.length === 0 ? (
          <div style={{ fontSize: 12, color: "#666" }}>—</div>
        ) : (
          nodeTypes.map((t) => (
            <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: colorMap.get(t) || "#999" }} aria-hidden />
              <div style={{ fontSize: 12 }}>{t}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NetworkGraph;