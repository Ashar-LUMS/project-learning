import React, { useEffect, useRef } from 'react';

declare const Plotly: any;

declare global {
  interface Window {
    Plotly?: any;
  }
}

interface ProbabilisticLandscapeProps {
  nodeOrder: string[];
  probabilities: Record<string, number>;
  potentialEnergies: Record<string, number>;
  type: 'probability' | 'energy';
  className?: string;
}

export const ProbabilisticLandscape: React.FC<ProbabilisticLandscapeProps> = ({
  nodeOrder,
  probabilities,
  potentialEnergies,
  type,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly) return;

    // Create a grid for the landscape
    const gridSize = Math.max(4, Math.ceil(Math.sqrt(nodeOrder.length)));
    const data = type === 'probability' ? probabilities : potentialEnergies;

    // Create 2D grid of values
    const zValues: number[][] = [];
    const xValues: number[] = [];
    const yValues: number[] = [];

    for (let i = 0; i < gridSize; i++) {
      xValues.push(i);
      yValues.push(i);
    }

    // Fill the grid with values
    for (let y = 0; y < gridSize; y++) {
      const row: number[] = [];
      for (let x = 0; x < gridSize; x++) {
        const index = y * gridSize + x;
        if (index < nodeOrder.length) {
          const nodeId = nodeOrder[index];
          row.push(data[nodeId] || 0);
        } else {
          row.push(0);
        }
      }
      zValues.push(row);
    }

    // Color scales with semantic meaning
    // For probability: high = peaks (viridis - yellow/green on top)
    // For energy: low = stable valleys (RdYlBu reversed - blue valleys, red peaks)
    const colorscale = type === 'probability'
      ? [
          [0, '#440154'],    // Low probability = dark purple
          [0.25, '#31688e'],
          [0.5, '#35b779'],
          [0.75, '#90d743'],
          [1, '#fde725']     // High probability = bright yellow
        ]
      : [
          [0, '#2166ac'],    // Low energy = stable blue valleys  
          [0.25, '#67a9cf'],
          [0.5, '#f7f7f7'],
          [0.75, '#ef8a62'],
          [1, '#b2182b']     // High energy = unstable red peaks
        ];

    const trace = {
      type: 'surface',
      x: xValues,
      y: yValues,
      z: zValues,
      colorscale: colorscale,
      showscale: true,
      colorbar: {
        title: {
          text: type === 'probability' ? 'Probability' : 'Potential Energy',
          side: 'right',
          font: { size: 11 },
        },
        thickness: 15,
        len: 0.6,
        y: 0.5,
      },
      contours: {
        z: {
          show: true,
          usecolormap: true,
          highlightcolor: '#ffffff',
          project: { z: true },
        },
      },
      lighting: {
        ambient: 0.6,
        diffuse: 0.8,
        specular: 0.4,
        roughness: 0.5,
        fresnel: 0.2,
      },
      hovertemplate: type === 'probability'
        ? 'Probability: %{z:.4f}<extra></extra>'
        : 'Energy: %{z:.4f}<extra></extra>',
    };

    // Build subtitle based on type
    const subtitle = type === 'probability'
      ? '<span style="font-size:11px;color:#6b7280">Peaks = High probability states • Valleys = Low probability states</span>'
      : '<span style="font-size:11px;color:#6b7280">Valleys = Stable states (low energy) • Peaks = Unstable states (high energy)</span>';

    const layout = {
      autosize: true,
      margin: { l: 10, r: 10, t: 70, b: 10 },
      title: {
        text: (type === 'probability' ? 'Probability Landscape' : 'Potential Energy Landscape') + '<br>' + subtitle,
        font: { size: 15, color: '#1f2937' },
        y: 0.95,
      },
      scene: {
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.3 },
          center: { x: 0, y: 0, z: 0 },
        },
        xaxis: {
          title: { text: 'State Space (dim 1)', font: { size: 11 } },
          showgrid: true,
          gridcolor: '#e0e0e0',
          showticklabels: false,
        },
        yaxis: {
          title: { text: 'State Space (dim 2)', font: { size: 11 } },
          showgrid: true,
          gridcolor: '#e0e0e0',
          showticklabels: false,
        },
        zaxis: {
          title: { 
            text: type === 'probability' ? 'Probability ↑' : 'Energy ↑', 
            font: { size: 11 } 
          },
          showgrid: true,
          gridcolor: '#e0e0e0',
        },
        bgcolor: '#ffffff',
      },
      paper_bgcolor: '#fafafa',
      plot_bgcolor: '#ffffff',
    };

    const config = {
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
      responsive: true,
    };

    try {
      if (window.Plotly.purge) {
        try { window.Plotly.purge(plotRef.current); } catch (e) { /* ignore purge errors */ }
      }

      window.Plotly.newPlot(plotRef.current, [trace as any], layout as any, config as any);

      // Handle resize when fullscreen changes
      const resizeObserver = new ResizeObserver(() => {
        if (plotRef.current && window.Plotly?.Plots?.resize) {
          window.Plotly.Plots.resize(plotRef.current);
        }
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
      };
    } catch (err) {
      // Fail gracefully: log and clear any partial DOM so errors don't bubble
      // up to an ErrorBoundary leaving overlays/portals in the DOM.
      // eslint-disable-next-line no-console
      console.error('Plotly render failed:', err);
      if (plotRef.current) {
        plotRef.current.innerHTML = '';
      }
    }
  }, [nodeOrder, probabilities, potentialEnergies, type]);

  // Legend content based on type
  const legendContent = type === 'probability' ? (
    <>
      <div className="font-medium text-foreground">Legend</div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ background: '#fde725' }}></span>
        <span className="text-muted-foreground">Peaks = High probability</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ background: '#440154' }}></span>
        <span className="text-muted-foreground">Valleys = Low probability</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">States the system is most likely to occupy appear as peaks</div>
    </>
  ) : (
    <>
      <div className="font-medium text-foreground">Legend</div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ background: '#2166ac' }}></span>
        <span className="text-muted-foreground">Valleys = Stable (low energy)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ background: '#b2182b' }}></span>
        <span className="text-muted-foreground">Peaks = Unstable (high energy)</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">System naturally flows toward low-energy valleys</div>
    </>
  );

  return (
    <div 
      ref={containerRef}
      className={`${className} w-full h-full relative`}
      style={{ minHeight: '400px' }}
    >
      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-10 bg-background/90 border rounded-md p-2 text-xs space-y-1 max-w-[220px]">
        {legendContent}
      </div>

      <div ref={plotRef} className="w-full h-full rounded-md" />
    </div>
  );
};

export default ProbabilisticLandscape;
