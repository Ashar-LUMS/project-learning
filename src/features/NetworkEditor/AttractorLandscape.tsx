import { useEffect, useRef } from 'react';
import type { DeterministicAttractor } from '@/lib/analysis/types';

interface AttractorLandscapeProps {
  attractors: DeterministicAttractor[];
  className?: string;
}

export default function AttractorLandscape({ attractors, className = '' }: AttractorLandscapeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || attractors.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    // Calculate layout
    const plotWidth = width - 2 * padding;
    const plotHeight = height - 2 * padding - 30; // Extra space for labels

    // Sort attractors by basin share for better visualization
    const sortedAttractors = [...attractors].sort((a, b) => b.basinShare - a.basinShare);

    // Draw attractors as bars/peaks
    const barWidth = plotWidth / sortedAttractors.length;
    const maxHeight = plotHeight * 0.8;

    sortedAttractors.forEach((attr, index) => {
      const x = padding + index * barWidth;
      const barHeight = attr.basinShare * maxHeight;
      const y = padding + plotHeight - barHeight;

      // Color based on attractor type
      const colors = {
        'fixed-point': '#3b82f6',  // blue
        'limit-cycle': '#8b5cf6'   // violet
      };
      const color = colors[attr.type as keyof typeof colors] || '#6b7280';

      // Draw bar with gradient
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '80');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x + barWidth * 0.1, y, barWidth * 0.8, barHeight);

      // Draw border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + barWidth * 0.1, y, barWidth * 0.8, barHeight);

      // Draw attractor label
      ctx.fillStyle = '#374151';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `#${attr.id + 1}`,
        x + barWidth / 2,
        padding + plotHeight + 15
      );

      // Draw period info
      ctx.fillStyle = '#6b7280';
      ctx.font = '9px sans-serif';
      ctx.fillText(
        attr.type === 'fixed-point' ? 'P1' : `P${attr.period}`,
        x + barWidth / 2,
        padding + plotHeight + 27
      );

      // Draw basin percentage on bar if space allows
      if (barHeight > 30) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        const percentage = (attr.basinShare * 100).toFixed(1) + '%';
        ctx.fillText(percentage, x + barWidth / 2, y + barHeight / 2 + 4);
      }
    });

    // Draw axes
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + plotHeight);
    ctx.lineTo(padding + plotWidth, padding + plotHeight);
    ctx.stroke();

    // Y-axis label
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(15, padding + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Basin Size (%)', 0, 0);
    ctx.restore();

    // X-axis label
    ctx.fillText('Attractors', padding + plotWidth / 2, height - 8);

    // Draw Y-axis ticks and labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
    yTicks.forEach(tick => {
      const y = padding + plotHeight - tick * maxHeight;
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + plotWidth, y);
      ctx.stroke();
      
      ctx.fillStyle = '#6b7280';
      ctx.fillText((tick * 100).toFixed(0), padding - 5, y + 3);
    });

    // Legend
    const legendX = width - padding - 120;
    const legendY = padding;
    const legendItems = [
      { label: 'Fixed Point', color: '#3b82f6' },
      { label: 'Limit Cycle', color: '#8b5cf6' }
    ];

    legendItems.forEach((item, i) => {
      const y = legendY + i * 20;
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, y, 12, 12);
      ctx.strokeStyle = item.color;
      ctx.strokeRect(legendX, y, 12, 12);
      
      ctx.fillStyle = '#374151';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 18, y + 9);
    });

  }, [attractors]);

  if (attractors.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 text-sm text-muted-foreground ${className}`}>
        No attractors to visualize
      </div>
    );
  }

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '300px' }}
        className="rounded-md"
      />
    </div>
  );
}
