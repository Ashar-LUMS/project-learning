import { useEffect, useRef } from 'react';
import type { DeterministicAttractor } from '@/lib/analysis/types';
import Plotly from 'plotly.js-dist-min';

interface AttractorLandscapeProps {
  attractors: DeterministicAttractor[];
  mappingType?: 'sammon' | 'naive-grid';
  className?: string;
}

/**
 * Sammon Mapping for attractor positions - uses basin share as the value
 * to preserve distances between attractors.
 */
function sammonMappingAttractors(attractors: DeterministicAttractor[], gridSize: number, iterations: number = 50): Array<{x: number; y: number}> {
  const n = attractors.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: gridSize / 2, y: gridSize / 2 }];
  
  // Initialize positions in a circle
  const positions = attractors.map((_, i) => ({
    x: gridSize / 2 + Math.cos((2 * Math.PI * i) / n) * gridSize * 0.3,
    y: gridSize / 2 + Math.sin((2 * Math.PI * i) / n) * gridSize * 0.3,
  }));
  
  // Use basin share difference as distance metric
  const targetDistances: number[][] = [];
  for (let i = 0; i < n; i++) {
    targetDistances[i] = [];
    for (let j = 0; j < n; j++) {
      targetDistances[i][j] = Math.abs(attractors[i].basinShare - attractors[j].basinShare) * gridSize;
    }
  }
  
  // Gradient descent to optimize positions
  const learningRate = 0.1;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) {
      let gradX = 0;
      let gradY = 0;
      
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const currentDist = Math.sqrt(dx * dx + dy * dy) + 1e-8;
        const targetDist = targetDistances[i][j] + 1e-8;
        
        const error = (currentDist - targetDist) / targetDist;
        gradX += error * dx / currentDist;
        gradY += error * dy / currentDist;
      }
      
      // Update position with constraints to stay in grid
      positions[i].x = Math.max(2, Math.min(gridSize - 2, positions[i].x - learningRate * gradX));
      positions[i].y = Math.max(2, Math.min(gridSize - 2, positions[i].y - learningRate * gradY));
    }
  }
  
  return positions;
}

export default function AttractorLandscape({ attractors, mappingType = 'naive-grid', className = '' }: AttractorLandscapeProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || attractors.length === 0) return;

    let resizeObserver: ResizeObserver | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const currentPlotRef = plotRef.current;

    const renderPlot = () => {
      if (!currentPlotRef) return;
      
      try {
        // Create a 2D grid for the landscape
        const gridSize = 20;
        const x = Array.from({ length: gridSize }, (_, i) => i);
        const y = Array.from({ length: gridSize }, (_, i) => i);
        
        // Initialize z values (energy landscape)
        // We invert so attractors appear as VALLEYS (low stability score = stable)
        const z: number[][] = Array.from({ length: gridSize }, () => 
          Array.from({ length: gridSize }, () => 1) // Start at high "instability"
        );

        // Get attractor positions based on mapping type
        let attractorPositions: Array<{x: number; y: number}>;
        
        if (mappingType === 'sammon') {
          attractorPositions = sammonMappingAttractors(attractors, gridSize);
        } else {
          // Naive grid: circular layout
          attractorPositions = attractors.map((_, idx) => {
            const angle = (idx / attractors.length) * 2 * Math.PI;
            const radius = gridSize * 0.3;
            return {
              x: gridSize / 2 + Math.cos(angle) * radius,
              y: gridSize / 2 + Math.sin(angle) * radius,
            };
          });
        }

        // Create valleys for each attractor based on basin share
        // Larger basin share = deeper valley = more stable
        attractors.forEach((attr, idx) => {
          const centerX = attractorPositions[idx].x;
          const centerY = attractorPositions[idx].y;
          
          // Create a Gaussian valley for this attractor (inverted)
          for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
              const dx = i - centerX;
              const dy = j - centerY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const sigma = 2.5; // Width of the valley
              const depth = attr.basinShare; // Depth proportional to basin share
              const gaussian = depth * Math.exp(-(dist * dist) / (2 * sigma * sigma));
              z[j][i] -= gaussian; // Subtract to create valleys
            }
          }
        });

        // Smooth the landscape using simple averaging
        const smoothZ = z.map((row, i) => 
          row.map((val, j) => {
            let sum = val;
            let count = 1;
            for (let di = -1; di <= 1; di++) {
              for (let dj = -1; dj <= 1; dj++) {
                if (di === 0 && dj === 0) continue;
                const ni = i + di;
                const nj = j + dj;
                if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                  sum += z[ni][nj];
                  count++;
                }
              }
            }
            return sum / count;
          })
        );

        // Generate attractor labels for annotations
        const annotations = attractors.map((attr, idx) => {
          const centerX = attractorPositions[idx].x;
          const centerY = attractorPositions[idx].y;
          return {
            x: centerX,
            y: centerY,
            z: 1 - attr.basinShare - 0.1, // Position slightly above the valley bottom
            text: `A${idx + 1}<br>${(attr.basinShare * 100).toFixed(0)}%`,
            showarrow: false,
            font: { size: 10, color: '#1e293b' },
          };
        });

        const data: Partial<Plotly.PlotData>[] = [{
          type: 'surface',
          x: x,
          y: y,
          z: smoothZ,
          colorscale: [
            [0, '#1e40af'],   // Deep blue = stable valleys (attractors)
            [0.25, '#3b82f6'],
            [0.5, '#93c5fd'],
            [0.75, '#fcd34d'],
            [1, '#ef4444']    // Red = unstable peaks (transient states)
          ],
          showscale: true,
          colorbar: {
            title: {
              text: 'Stability',
              side: 'right',
              font: { size: 12 }
            },
            tickvals: [],
            ticktext: [],
            thickness: 15,
            len: 0.6,
            y: 0.5,
          },
          hovertemplate: 
            'Stability Score: %{z:.3f}<extra></extra>',
        } as any];

        const layout: Partial<Plotly.Layout> = {
          title: {
            text: 'Attractor Landscape<br><span style="font-size:11px;color:#6b7280">Valleys = Stable Attractors (deeper = larger basin) • Peaks = Transient States</span>',
            font: { size: 15, color: '#1f2937' },
            y: 0.95,
          },
          autosize: true,
          scene: {
            camera: {
              eye: { x: 1.5, y: 1.5, z: 1.3 },
              center: { x: 0, y: 0, z: -0.2 }
            },
            xaxis: { 
              title: { text: 'State Space (dim 1)', font: { size: 11 } }, 
              showgrid: true, 
              gridcolor: '#e5e7eb',
              showticklabels: false,
            },
            yaxis: { 
              title: { text: 'State Space (dim 2)', font: { size: 11 } }, 
              showgrid: true, 
              gridcolor: '#e5e7eb',
              showticklabels: false,
            },
            zaxis: { 
              title: { text: 'Instability ↑', font: { size: 11 } }, 
              showgrid: true, 
              gridcolor: '#e5e7eb',
            },
            bgcolor: '#fafafa',
            annotations: annotations as any,
          },
          paper_bgcolor: '#ffffff',
          plot_bgcolor: '#fafafa',
          margin: { l: 10, r: 10, t: 60, b: 10 },
        };

        const config: Partial<Plotly.Config> = {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'] as any,
        };

        Plotly.newPlot(currentPlotRef, data, layout, config);

        // Handle resize when fullscreen changes
        resizeObserver = new ResizeObserver(() => {
          if (currentPlotRef) {
            Plotly.Plots.resize(currentPlotRef);
          }
        });
        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }
      } catch (err) {
        console.error('Failed to render Plotly landscape:', err);
      }
    };

    // Use a small timeout to ensure the dialog has rendered and the container has dimensions
    timeoutId = setTimeout(() => {
      if (!currentPlotRef) return;
      
      // Check if container has dimensions
      const rect = currentPlotRef.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Retry after a frame if dimensions are zero
        requestAnimationFrame(renderPlot);
        return;
      }
      
      renderPlot();
    }, 100);

    // Consolidated cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (currentPlotRef) {
        try {
          Plotly.purge(currentPlotRef);
        } catch (err) {
          console.error('Failed to clean up Plotly:', err);
        }
      }
    };
  }, [attractors, mappingType]);

  if (attractors.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 text-sm text-muted-foreground ${className}`}>
        No attractors to visualize
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`${className} w-full h-full relative`}
      style={{ minHeight: '450px', height: '100%' }}
    >
      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-10 bg-background/90 border rounded-md p-2 text-xs space-y-1 max-w-[200px]">
        <div className="font-medium text-foreground">Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-blue-700"></span>
          <span className="text-muted-foreground">Valleys = Stable attractors</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-500"></span>
          <span className="text-muted-foreground">Peaks = Transient states</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">Deeper valleys indicate larger basins of attraction</div>
        <div className="text-[10px] text-blue-600 mt-1 border-t pt-1">Mapping: {mappingType === 'sammon' ? 'Sammon Mapping' : 'Naive Grid'}</div>
      </div>

      <div ref={plotRef} style={{ width: '100%', height: '100%', minHeight: '450px' }} className="rounded-md" />
    </div>
  );
}
