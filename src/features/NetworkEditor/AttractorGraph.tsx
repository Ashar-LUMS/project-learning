import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core } from 'cytoscape';

export type AttractorState = {
  binary: string;
};

type Props = {
  states: AttractorState[];
  className?: string;
  nodeLabels?: string[]; // Optional node labels for state interpretation
};

/*
  Renders a small Cytoscape graph for a single attractor cycle.
  - If period === 1: single node with a self-loop
  - If period > 1: nodes S1..Sk connected in a directed cycle
  - Interactive features: hover tooltips, zoom, pan, click to highlight
*/
const AttractorGraph: React.FC<Props> = ({ states, className, nodeLabels }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const period = states.length;

  const elements = useMemo(() => {
    if (!period) return [] as any[];
    const nodes = states.map((s, i) => ({
      data: {
        id: `s-${i}`,
        label: period === 1 ? 'Fixed' : `S${i + 1}`,
        binary: s.binary,
      },
    }));
    const edges = period === 1
      ? [{ data: { id: 'e-0', source: 's-0', target: 's-0' }, classes: 'self-loop' }]
      : states.map((_, i) => ({
          data: {
            id: `e-${i}`,
            source: `s-${i}`,
            target: `s-${(i + 1) % period}`,
          },
        }));
    return [...nodes, ...edges];
  }, [states, period]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!cyRef.current) {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: [],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#2563eb',
              'label': 'data(label)',
              'color': '#0b1020',
              'font-size': 10,
              'text-valign': 'center',
              'text-halign': 'center',
              'width': 22,
              'height': 22,
              'border-width': 1,
              'border-color': '#93c5fd',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#64748b',
              'target-arrow-color': '#64748b',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 0.8,
            },
          },
          {
            selector: 'edge.self-loop',
            style: {
              'curve-style': 'bezier',
              'control-point-step-size': 20,
              'loop-direction': '0deg',
              'loop-sweep': '60deg',
            },
          },
          {
            selector: 'node:selected',
            style: {
              'background-color': '#16a34a',
              'border-color': '#22c55e',
              'border-width': 3,
            },
          },
          {
            selector: 'node.highlighted',
            style: {
              'background-color': '#7c3aed',
              'border-color': '#a855f7',
              'border-width': 2,
            },
          },
        ],
        // Enable interactivity
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
        selectionType: 'single',
      });

      // Add interaction handlers
      cyRef.current.on('mouseover', 'node', (evt) => {
        const node = evt.target;
        const binary = node.data('binary') as string;
        const pos = evt.renderedPosition;
        
        // Format state with node labels if available
        let stateText = binary;
        if (nodeLabels && nodeLabels.length > 0) {
          const activeNodes = binary.split('').map((bit, i) => 
            bit === '1' ? (nodeLabels[i] || `N${i}`) : null
          ).filter(Boolean);
          stateText = activeNodes.length > 0 
            ? `Active: ${activeNodes.join(', ')}`
            : 'All inactive';
        }
        
        setTooltip({ text: `State: ${binary}\n${stateText}`, x: pos.x, y: pos.y });
        node.addClass('highlighted');
      });

      cyRef.current.on('mouseout', 'node', (evt) => {
        setTooltip(null);
        evt.target.removeClass('highlighted');
      });

      cyRef.current.on('tap', 'node', (evt) => {
        const nodeId = evt.target.id();
        setSelectedState(prev => prev === nodeId ? null : nodeId);
      });
    }

    const cy = cyRef.current!;
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements as any);
    });
    const layout = cy.layout({ name: period > 1 ? 'circle' : 'grid', fit: true, animate: false });
    layout.run();
    setTimeout(() => {
      cy.resize();
      cy.fit(undefined, 12);
    }, 50);

    return () => {
      // keep instance alive
    };
  }, [elements, period, nodeLabels]);

  // Zoom controls
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.2);
  const handleFit = () => cyRef.current?.fit(undefined, 12);

  return (
    <div className={`relative ${className || "w-full h-48"}`}>
      <div ref={containerRef} className="w-full h-full rounded-md border bg-white" />
      
      {/* Tooltip */}
      {tooltip && (
        <div 
          className="absolute z-10 px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg pointer-events-none whitespace-pre-line"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          {tooltip.text}
        </div>
      )}
      
      {/* Zoom Controls */}
      <div className="absolute bottom-2 right-2 flex gap-1 z-10">
        <button 
          onClick={handleZoomIn}
          className="w-6 h-6 flex items-center justify-center bg-white/90 hover:bg-white border rounded text-xs font-medium shadow-sm"
          title="Zoom in"
        >
          +
        </button>
        <button 
          onClick={handleZoomOut}
          className="w-6 h-6 flex items-center justify-center bg-white/90 hover:bg-white border rounded text-xs font-medium shadow-sm"
          title="Zoom out"
        >
          −
        </button>
        <button 
          onClick={handleFit}
          className="w-6 h-6 flex items-center justify-center bg-white/90 hover:bg-white border rounded text-xs font-medium shadow-sm"
          title="Fit to view"
        >
          ⊡
        </button>
      </div>
      
      {/* Selected state info */}
      {selectedState && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded border border-green-200">
          Selected: {selectedState.replace('s-', 'S')}
        </div>
      )}
    </div>
  );
};

export default AttractorGraph;
