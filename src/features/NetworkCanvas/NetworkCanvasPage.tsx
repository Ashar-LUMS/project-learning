import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Beaker, ArrowUpCircle, ArrowDownCircle, MinusCircle, PlusCircle, PencilLine, Eye, Unlink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Link as LinkIcon, BookPlus, Hand, Move, Save, Trash2 } from "lucide-react";
import { useState } from "react";

// Minimal full-page canvas. Later we'll add buttons for nodes/edges/rules.
export default function NetworkCanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<"pan"|"select"|"add-node"|"add-edge"|"add-rule">("pan");
  const [nodes, setNodes] = useState<Array<{ id: string; x: number; y: number; label?: string; therapy?: "knock-up"|"knock-down"|"knock-out"|"knock-in" }>>([]);
  const [edges, setEdges] = useState<Array<{ id: string; source: string; target: string }>>([]);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  const isPanningRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const draftEdgeFromRef = useRef<string | null>(null);
  const nextNodeIdRef = useRef(1);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear full canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply device pixel ratio transform and pan offset
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(offset.x, offset.y);

    // Draw edges with arrowheads and subtle shadows
    for (const e of edges) {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      if (!s || !t) continue;
      const isSelected = selectedEdgeIds.has(e.id);
      const baseColor = isSelected ? "#ef4444" : "#64748b"; // red-500 or slate-500
      ctx.lineWidth = isSelected ? 2 : 1.75;

      // edge shadow
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.08)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      ctx.strokeStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.restore();

      // arrowhead
      const dx = t.x - s.x, dy = t.y - s.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len, uy = dy / len;
      const arrowSize = 7;
      const ax = t.x - ux * 10; // place arrow a bit before target
      const ay = t.y - uy * 10;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - uy * arrowSize + ux * arrowSize, ay + ux * arrowSize + uy * arrowSize);
      ctx.lineTo(ax + uy * arrowSize + ux * arrowSize, ay - ux * arrowSize + uy * arrowSize);
      ctx.closePath();
      ctx.fill();
    }

    // Draw nodes
    for (const n of nodes) {
      const isSource = draftEdgeFromRef.current === n.id;
      const isSelected = selectedNodeIds.has(n.id);
      const r = 12;

      // node glow for selected/source
      if (isSource || isSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.shadowColor = isSource ? "rgba(37,99,235,0.45)" : "rgba(30,64,175,0.35)";
        ctx.shadowBlur = 8;
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "transparent";
        ctx.fill();
        ctx.restore();
      }

      // node base
      ctx.beginPath();
      ctx.fillStyle = isSelected ? "#e2e8f0" : "#ffffff"; // selected slate-200
      ctx.strokeStyle = isSource ? "#2563eb" : isSelected ? "#1e40af" : "#334155"; // blue-600, blue-800, slate-700
      ctx.lineWidth = isSource || isSelected ? 2 : 1.5;
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // node label (id for now)
      const label = n.label ?? n.id;
      ctx.fillStyle = "#111827"; // gray-900
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
      const metrics = ctx.measureText(label);
      ctx.fillText(label, n.x - metrics.width / 2, n.y - r - 6);
    }

    // HUD text
    ctx.fillStyle = "#1e40af"; // blue-800
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(`Mode: ${mode}`, 16 - offset.x, 24 - offset.y);
  }, [nodes, edges, offset, mode]);

  // Resize canvas to fill viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor((window.innerHeight - 64) * dpr); // minus header approx
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight - 64}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Helpers
  const getCanvasRelative = (evt: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    return { x, y };
  };

  const screenToWorld = (p: { x: number; y: number }) => ({ x: p.x - offset.x, y: p.y - offset.y });
  // const worldToScreen = (p: { x: number; y: number }) => ({ x: p.x + offset.x, y: p.y + offset.y });

  const hitNode = (worldX: number, worldY: number, radius = 12) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = worldX - n.x;
      const dy = worldY - n.y;
      if (dx * dx + dy * dy <= radius * radius) return n;
    }
    return null;
  };

  // Mouse handlers
  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === "pan") {
      isPanningRef.current = true;
      lastPosRef.current = getCanvasRelative(e);
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === "pan" && isPanningRef.current && lastPosRef.current) {
      const cur = getCanvasRelative(e);
      const dx = cur.x - lastPosRef.current.x;
      const dy = cur.y - lastPosRef.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPosRef.current = cur;
    }
  };

  const onCanvasMouseUp = () => {
    isPanningRef.current = false;
    lastPosRef.current = null;
  };

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = screenToWorld(getCanvasRelative(e));
    if (mode === "add-node") {
      const id = `n${nextNodeIdRef.current++}`;
      setNodes(prev => [...prev, { id, x: pt.x, y: pt.y, label: id }]);
      return;
    }
    if (mode === "add-edge") {
      const hit = hitNode(pt.x, pt.y);
      if (!hit) return;
      const from = draftEdgeFromRef.current;
      if (!from) {
        draftEdgeFromRef.current = hit.id;
      } else {
        if (from !== hit.id) {
          const id = `edge:${from}:${hit.id}`;
          setEdges(prev => (
            prev.some(e => e.id === id) ? prev : [...prev, { id, source: from, target: hit.id }]
          ));
        }
        draftEdgeFromRef.current = null;
      }
      return;
    }
    if (mode === "select") {
      const node = hitNode(pt.x, pt.y);
      if (node) {
        setSelectedNodeIds(prev => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
          return next;
        });
        // toggle connected edges selection for convenience
        setSelectedEdgeIds(prev => {
          const next = new Set(prev);
          for (const e of edges) {
            if (e.source === node.id || e.target === node.id) {
              if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
            }
          }
          return next;
        });
      } else {
        // Attempt edge hit test (simple distance to segment)
        let hitEdge: { id: string } | null = null;
        for (const e of edges) {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          if (!s || !t) continue;
          const ax = s.x, ay = s.y, bx = t.x, by = t.y;
          const vx = bx - ax, vy = by - ay;
          const wx = pt.x - ax, wy = pt.y - ay;
          const c1 = vx * wx + vy * wy;
          const c2 = vx * vx + vy * vy;
          let u = c2 ? c1 / c2 : 0;
          u = Math.max(0, Math.min(1, u));
          const px = ax + u * vx, py = ay + u * vy;
          const dist2 = (pt.x - px) ** 2 + (pt.y - py) ** 2;
          if (dist2 <= 9) { hitEdge = { id: e.id }; break; } // within 3px
        }
        if (hitEdge) {
          setSelectedEdgeIds(prev => {
            const next = new Set(prev);
            if (next.has(hitEdge!.id)) next.delete(hitEdge!.id); else next.add(hitEdge!.id);
            return next;
          });
        } else {
          // click empty: clear selections
          setSelectedNodeIds(new Set());
          setSelectedEdgeIds(new Set());
        }
      }
      return;
    }
  };

  // Delete selected nodes/edges
  const deleteSelected = () => {
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
    setEdges(prev => prev.filter(e => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
    setNodes(prev => prev.filter(n => !selectedNodeIds.has(n.id)));
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
  };

  // Therapeutic actions
  const applyTherapyToSelectedNodes = (therapy: "knock-up"|"knock-down"|"knock-out"|"knock-in") => {
    if (selectedNodeIds.size === 0) return;
    setNodes(prev => prev.map(n => selectedNodeIds.has(n.id) ? { ...n, therapy } : n));
  };

  const edgeKnockIn = () => {
    // For now, simply highlight selected edges by duplicating a therapy-like effect via selection retain
    if (selectedEdgeIds.size === 0) return;
    // Could store edge therapy status later; here we no-op with log
    console.log("Edge Knock In:", Array.from(selectedEdgeIds));
  };

  const edgeKnockOut = () => {
    // Remove selected edges (knock out)
    if (selectedEdgeIds.size === 0) return;
    setEdges(prev => prev.filter(e => !selectedEdgeIds.has(e.id)));
    setSelectedEdgeIds(new Set());
  };

  const renameSelectedNodes = () => {
    if (selectedNodeIds.size === 0) return;
    const name = window.prompt("Rename selected nodes to:");
    if (name === null || name.trim() === "") return;
    setNodes(prev => prev.map(n => selectedNodeIds.has(n.id) ? { ...n, label: name } : n));
  };

  const viewResults = () => {
    // Placeholder: summarize counts
    const summary = {
      nodes: nodes.length,
      edges: edges.length,
      selectedNodes: selectedNodeIds.size,
      selectedEdges: selectedEdgeIds.size,
      therapies: nodes.reduce((acc: Record<string, number>, n) => {
        if (n.therapy) acc[n.therapy] = (acc[n.therapy] || 0) + 1;
        return acc;
      }, {})
    };
    console.log("Results summary:", summary);
    alert(`Nodes: ${summary.nodes}\nEdges: ${summary.edges}\nSelected Nodes: ${summary.selectedNodes}\nSelected Edges: ${summary.selectedEdges}\nTherapies: ${JSON.stringify(summary.therapies)}`);
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] bg-white">
      {/* Right-side toolbar: Therapy options dropdown (match left toolbar styling) */}
      <div className="absolute top-4 right-[10px] z-10">
        <div className="flex flex-col gap-2 p-2 rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Therapy options">
                    <Beaker className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Therapy options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" sideOffset={6} className="rounded-lg">
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); applyTherapyToSelectedNodes("knock-up"); }} aria-label="Knock Up" title="Knock Up">
                <ArrowUpCircle className="h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); applyTherapyToSelectedNodes("knock-down"); }} aria-label="Knock Down" title="Knock Down">
                <ArrowDownCircle className="h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); applyTherapyToSelectedNodes("knock-out"); }} aria-label="Knock Out" title="Knock Out">
                <MinusCircle className="h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); applyTherapyToSelectedNodes("knock-in"); }} aria-label="Knock In" title="Knock In">
                <PlusCircle className="h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); edgeKnockIn(); }} aria-label="Edge Knock In" title="Edge Knock In">
                <LinkIcon className="h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); edgeKnockOut(); }} aria-label="Edge Knock Out" title="Edge Knock Out">
                <Unlink className="h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); deleteSelected(); }} aria-label="Delete" title="Delete">
                <Trash2 className="h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); renameSelectedNodes(); }} aria-label="Rename" title="Rename">
                <PencilLine className="h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); viewResults(); }} aria-label="View Results" title="View Results">
                <Eye className="h-4 w-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Compact vertical toolbar offset slightly from the left */}
      <TooltipProvider>
        <div
          className="absolute top-4 left-3 z-10 flex flex-col gap-2 p-2 rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm"
          aria-label="Network editor tools"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === "pan" ? "default" : "outline"}
                size="icon"
                aria-label="Pan/Move"
                onClick={() => setMode("pan")}
              >
                <Move className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pan/Move</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === "select" ? "default" : "outline"}
                size="icon"
                aria-label="Select"
                onClick={() => setMode("select")}
              >
                <Hand className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Select</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === "add-node" ? "default" : "outline"}
                size="icon"
                aria-label="Add Node"
                onClick={() => setMode("add-node")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Node</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === "add-edge" ? "default" : "outline"}
                size="icon"
                aria-label="Add Edge"
                onClick={() => setMode("add-edge")}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Edge</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === "add-rule" ? "default" : "outline"}
                size="icon"
                aria-label="Add Rule"
                onClick={() => setMode("add-rule")}
              >
                <BookPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Rule</TooltipContent>
          </Tooltip>

          <div className="h-px w-full bg-gray-200 my-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Save">
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Delete" onClick={deleteSelected}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete Selected</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Canvas fills the remaining area */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair"
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
        onClick={onCanvasClick}
      />
    </div>
  );
}
