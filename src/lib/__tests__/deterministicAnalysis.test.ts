import { describe, it, expect } from 'vitest';
import { performDeterministicAnalysis } from '../deterministicAnalysis';

describe('deterministicAnalysis', () => {
  it('finds a fixed point for A = A', () => {
    const nodes = [{ id: 'A', label: 'A' }];
    const rules = ['A = A'];
    const result = performDeterministicAnalysis({ nodes, rules });
    expect(result.nodeOrder).toEqual(['A']);
    expect(result.attractors.length).toBeGreaterThan(0);
    const hasFixed = result.attractors.some(a => a.type === 'fixed-point');
    expect(hasFixed).toBe(true);
  });

  it('parses AND/OR/NOT and returns unified result format', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const rules = ['A = A', 'B = A AND !C', 'C = B OR A'];
    const result = performDeterministicAnalysis({ nodes, rules });
    expect(result.nodeOrder).toEqual(['A', 'B', 'C']);
    expect(Object.keys(result.nodeLabels)).toContain('A');
    expect(Array.isArray(result.attractors)).toBe(true);
  });
});
