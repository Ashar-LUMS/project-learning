import { useEffect, useRef } from 'react';
import type { DeterministicAttractor } from '@/lib/analysis/types';
import Plotly from 'plotly.js-dist-min';

interface AttractorLandscapeProps {
  attractors: DeterministicAttractor[];
  className?: string;
}

export default function AttractorLandscape({ attractors, className = '' }: AttractorLandscapeProps) {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || attractors.length === 0) return;

    try {
      // Create a 2D grid for the landscape
      const gridSize = 20;
      const x = Array.from({ length: gridSize }, (_, i) => i);
      const y = Array.from({ length: gridSize }, (_, i) => i);
      
      // Initialize z values (energy landscape)
      const z: number[][] = Array.from({ length: gridSize }, () => 
        Array.from({ length: gridSize }, () => 0)
      );

      // Create peaks/valleys for each attractor based on basin share
      attractors.forEach((attr, idx) => {
        // Position attractors in a circular pattern or grid
        const angle = (idx / attractors.length) * 2 * Math.PI;
        const radius = gridSize * 0.3;
        const centerX = gridSize / 2 + Math.cos(angle) * radius;
        const centerY = gridSize / 2 + Math.sin(angle) * radius;
        
        // Create a Gaussian peak for this attractor
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            const dx = i - centerX;
            const dy = j - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const sigma = 2.5; // Width of the peak
            const height = attr.basinShare * 0.03; // Scale height
            const gaussian = height * Math.exp(-(dist * dist) / (2 * sigma * sigma));
            z[j][i] += gaussian;
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

      const data: Partial<Plotly.PlotData>[] = [{
        type: 'surface',
        x: x,
        y: y,
        z: smoothZ,
        colorscale: [
          [0, '#0d47a1'],
          [0.3, '#1976d2'],
          [0.5, '#42a5f5'],
          [0.7, '#ffb74d'],
          [1, '#d32f2f']
        ],
        showscale: true,
        colorbar: {
          thickness: 20,
          len: 0.7
        }
      } as any];

      const layout: Partial<Plotly.Layout> = {
        title: {
          text: 'Attractor Landscape',
          font: { size: 16, color: '#374151' }
        },
        autosize: true,
        scene: {
          camera: {
            eye: { x: 1.5, y: 1.5, z: 1.3 },
            center: { x: 0, y: 0, z: -0.2 }
          },
          xaxis: { title: { text: '' }, showgrid: true, gridcolor: '#e5e7eb' },
          yaxis: { title: { text: '' }, showgrid: true, gridcolor: '#e5e7eb' },
          zaxis: { title: { text: '' }, showgrid: true, gridcolor: '#e5e7eb' },
          bgcolor: '#fafafa'
        },
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#fafafa',
        margin: { l: 0, r: 0, t: 40, b: 0 }
      };

      const config: Partial<Plotly.Config> = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['toImage']
      };

      Plotly.newPlot(plotRef.current, data, layout, config);
    } catch (err) {
      console.error('Failed to render Plotly landscape:', err);
    }

    return () => {
      if (plotRef.current) {
        try {
          Plotly.purge(plotRef.current);
        } catch (err) {
          console.error('Failed to clean up Plotly:', err);
        }
      }
    };
  }, [attractors]);

  if (attractors.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 text-sm text-muted-foreground ${className}`}>
        No attractors to visualize
      </div>
    );
  }

  return (
    <div className={`${className} w-full`} style={{ height: '500px' }}>
      <div ref={plotRef} style={{ width: '100%', height: '100%' }} className="rounded-md" />
    </div>
  );
}
