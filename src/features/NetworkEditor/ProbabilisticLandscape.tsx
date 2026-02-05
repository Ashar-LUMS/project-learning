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
  mappingType?: 'sammon' | 'naive-grid';
  className?: string;
}

/**
 * Sammon Mapping - a nonlinear dimensionality reduction technique
 * that tries to preserve pairwise distances between points.
 */
function sammonMapping(values: number[], iterations: number = 100): { x: number[]; y: number[] } {
  const n = values.length;
  if (n <= 1) return { x: [0], y: [0] };
  
  // Initialize positions randomly in a circle
  const positions = values.map((_, i) => ({
    x: Math.cos((2 * Math.PI * i) / n) * 0.5 + Math.random() * 0.1,
    y: Math.sin((2 * Math.PI * i) / n) * 0.5 + Math.random() * 0.1,
  }));
  
  // Compute original distances (use value differences as distance metric)
  const originalDistances: number[][] = [];
  for (let i = 0; i < n; i++) {
    originalDistances[i] = [];
    for (let j = 0; j < n; j++) {
      originalDistances[i][j] = Math.abs(values[i] - values[j]);
    }
  }
  
  // Normalize original distances
  const maxDist = Math.max(...originalDistances.flat().filter(d => d > 0), 1);
  const normDistances = originalDistances.map(row => row.map(d => d / maxDist));
  
  // Gradient descent
  const learningRate = 0.5;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) {
      let gradX = 0;
      let gradY = 0;
      
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const currentDist = Math.sqrt(dx * dx + dy * dy) + 1e-8;
        const origDist = normDistances[i][j] + 1e-8;
        
        const error = (currentDist - origDist) / origDist;
        gradX += error * dx / currentDist;
        gradY += error * dy / currentDist;
      }
      
      positions[i].x -= learningRate * gradX / n;
      positions[i].y -= learningRate * gradY / n;
    }
  }
  
  // Normalize to [0, gridSize-1] range
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  
  return {
    x: xs.map(x => ((x - minX) / rangeX)),
    y: ys.map(y => ((y - minY) / rangeY)),
  };
}

export const ProbabilisticLandscape: React.FC<ProbabilisticLandscapeProps> = ({
  nodeOrder,
  probabilities,
  potentialEnergies,
  type,
  mappingType = 'naive-grid',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly) return;

    const data = type === 'probability' ? probabilities : potentialEnergies;
    const values = nodeOrder.map(nodeId => data[nodeId] || 0);
    
    // Create a grid for the landscape
    const gridSize = Math.max(4, Math.ceil(Math.sqrt(nodeOrder.length)));

    // Create 2D grid of values
    let zValues: number[][] = [];
    const xValues: number[] = [];
    const yValues: number[] = [];

    for (let i = 0; i < gridSize; i++) {
      xValues.push(i);
      yValues.push(i);
    }
    
    if (mappingType === 'sammon') {
      // Use Sammon mapping to position nodes
      const { x: mappedX, y: mappedY } = sammonMapping(values);
      
      // Initialize grid with zeros
      for (let y = 0; y < gridSize; y++) {
        zValues[y] = new Array(gridSize).fill(0);
      }
      
      // Place values at mapped positions with Gaussian spread
      const sigma = 0.8; // Spread of influence
      for (let idx = 0; idx < nodeOrder.length; idx++) {
        const px = mappedX[idx] * (gridSize - 1);
        const py = mappedY[idx] * (gridSize - 1);
        const value = values[idx];
        
        // Add Gaussian contribution to grid
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const dx = x - px;
            const dy = y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const gaussian = Math.exp(-(dist * dist) / (2 * sigma * sigma));
            zValues[y][x] += value * gaussian;
          }
        }
      }
      
      // Normalize so that the grid reflects the actual value range
      const maxZ = Math.max(...zValues.flat());
      const maxVal = Math.max(...values);
      if (maxZ > 0 && maxVal > 0) {
        const scale = maxVal / maxZ;
        zValues = zValues.map(row => row.map(v => v * scale));
      }
    } else {
      // Naive grid layout - simple row-major order
      for (let y = 0; y < gridSize; y++) {
        const row: number[] = [];
        for (let x = 0; x < gridSize; x++) {
          const index = y * gridSize + x;
          if (index < nodeOrder.length) {
            row.push(values[index]);
          } else {
            row.push(0);
          }
        }
        zValues.push(row);
      }
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
  }, [nodeOrder, probabilities, potentialEnergies, type, mappingType]);

  // Legend content based on type
  const mappingLabel = mappingType === 'sammon' ? 'Sammon Mapping' : 'Naive Grid';
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
      <div className="text-[10px] text-blue-600 mt-1 border-t pt-1">Mapping: {mappingLabel}</div>
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
      <div className="text-[10px] text-blue-600 mt-1 border-t pt-1">Mapping: {mappingLabel}</div>
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
