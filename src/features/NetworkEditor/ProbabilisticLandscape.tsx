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

  useEffect(() => {
    if (!containerRef.current || !window.Plotly) return;

    // Create a grid for the landscape
    const gridSize = Math.ceil(Math.sqrt(nodeOrder.length));
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

    const colorscale = type === 'probability'
      ? 'Viridis'
      : 'RdYlBu_r';

    const trace = {
      type: 'surface',
      x: xValues,
      y: yValues,
      z: zValues,
      colorscale: colorscale,
      showscale: true,
      colorbar: {
        title: type === 'probability' ? 'Probability' : 'Energy',
        thickness: 20,
        len: 0.7,
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
    };

    const layout = {
      autosize: true,
      height: containerRef.current?.clientHeight || 350,
      margin: { l: 0, r: 0, t: 30, b: 0 },
      title: type === 'probability' ? 'Probability Landscape' : 'Potential Energy Landscape',
      scene: {
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.3 },
          center: { x: 0, y: 0, z: 0 },
        },
        xaxis: {
          title: '',
          showgrid: true,
          gridcolor: '#e0e0e0',
          showticklabels: false,
        },
        yaxis: {
          title: '',
          showgrid: true,
          gridcolor: '#e0e0e0',
          showticklabels: false,
        },
        zaxis: {
          title: type === 'probability' ? 'P' : 'Energy',
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
        try { window.Plotly.purge(containerRef.current); } catch (e) { /* ignore purge errors */ }
      }

      window.Plotly.newPlot(containerRef.current, [trace as any], layout as any, config as any);
    } catch (err) {
      // Fail gracefully: log and clear any partial DOM so errors don't bubble
      // up to an ErrorBoundary leaving overlays/portals in the DOM.
      // eslint-disable-next-line no-console
      console.error('Plotly render failed:', err);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    }
  }, [nodeOrder, probabilities, potentialEnergies, type]);

  return <div ref={containerRef} className={`${className} w-full h-full`} />;
};

export default ProbabilisticLandscape;
