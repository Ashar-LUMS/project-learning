import React, { useEffect, useMemo, useRef } from 'react';
import cytoscape, { type Core } from 'cytoscape';

export type AttractorState = {
  binary: string;
};

type Props = {
  states: AttractorState[];
  className?: string;
};

/*
  Renders a small Cytoscape graph for a single attractor cycle.
  - If period === 1: single node with a self-loop
  - If period > 1: nodes S1..Sk connected in a directed cycle
*/
const AttractorGraph: React.FC<Props> = ({ states, className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

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
        ],
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
  }, [elements, period]);

  return (
    <div className={className || "w-full h-40"}>
      <div ref={containerRef} className="w-full h-full rounded-md border bg-white" />
    </div>
  );
};

export default AttractorGraph;
