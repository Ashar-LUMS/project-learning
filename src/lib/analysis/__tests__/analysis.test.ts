/**
 * Tests for weighted deterministic analysis and matrix utilities.
 */

import { describe, it, expect } from 'vitest';
import { edgesToMatrix, matrixToEdges, computeThreshold } from '../matrixUtils';
import { performWeightedAnalysis } from '../weightedDeterministicAnalysis';
import type { AnalysisNode, AnalysisEdge } from '../types';

describe('matrixUtils', () => {
  describe('edgesToMatrix', () => {
    it('converts edges to a weight matrix', () => {
      const nodeOrder = ['A', 'B'];
      const edges: AnalysisEdge[] = [
        { source: 'A', target: 'B', weight: 2 },
        { source: 'B', target: 'A', weight: 1 },
      ];

      const result = edgesToMatrix(nodeOrder, edges);
      expect(result.matrix).toEqual([
        [0, 1], // A's incoming: from B = 1
        [2, 0], // B's incoming: from A = 2
      ]);
    });

    it('handles missing edges with weight 0', () => {
      const nodeOrder = ['A', 'B', 'C'];
      const edges: AnalysisEdge[] = [{ source: 'A', target: 'B', weight: 1 }];

      const result = edgesToMatrix(nodeOrder, edges);
      expect(result.matrix[0]).toEqual([0, 0, 0]); // A receives nothing
      expect(result.matrix[1]).toEqual([1, 0, 0]); // B receives from A
      expect(result.matrix[2]).toEqual([0, 0, 0]); // C receives nothing
    });

    it('supports biases', () => {
      const nodeOrder = ['A', 'B'];
      const edges: AnalysisEdge[] = [];
      const biases = { A: 0.5, B: -0.5 };

      const result = edgesToMatrix(nodeOrder, edges, { biases });
      expect(result.biases).toEqual(biases);
    });
  });

  describe('matrixToEdges', () => {
    it('converts a weight matrix back to edges', () => {
      const nodeOrder = ['A', 'B'];
      const weightMatrix = {
        nodes: nodeOrder,
        matrix: [
          [0, 1],
          [2, 0],
        ],
        biases: {},
        thresholdMultiplier: 0.5,
        tieBehavior: 'zero-as-zero' as const,
      };

      const edges = matrixToEdges(weightMatrix);
      expect(edges).toEqual([
        { source: 'B', target: 'A', weight: 1 },
        { source: 'A', target: 'B', weight: 2 },
      ]);
    });

    it('omits zero-weight edges', () => {
      const nodeOrder = ['A', 'B', 'C'];
      const weightMatrix = {
        nodes: nodeOrder,
        matrix: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 2, 0],
        ],
        biases: {},
        thresholdMultiplier: 0.5,
        tieBehavior: 'zero-as-zero' as const,
      };

      const edges = matrixToEdges(weightMatrix);
      expect(edges).toEqual([
        { source: 'A', target: 'B', weight: 1 },
        { source: 'B', target: 'C', weight: 2 },
      ]);
    });
  });

  describe('computeThreshold', () => {
    it('computes threshold as inDegree * multiplier', () => {
      expect(computeThreshold(4, 0.5)).toBe(2);
      expect(computeThreshold(2, 0.5)).toBe(1);
      expect(computeThreshold(3, 1.0)).toBe(3);
    });
  });
});

describe('performWeightedAnalysis', () => {
  it('detects fixed points in a simple network', () => {
    const nodes: AnalysisNode[] = [
      { id: 'A', label: 'Node A' },
      { id: 'B', label: 'Node B' },
    ];
    const edges: AnalysisEdge[] = [
      { source: 'A', target: 'B', weight: 1 },
      { source: 'B', target: 'A', weight: 1 },
    ];

    const result = performWeightedAnalysis(nodes, edges);

    expect(result.nodeOrder).toEqual(['A', 'B']);
    expect(result.nodeLabels).toEqual({ A: 'Node A', B: 'Node B' });
    expect(result.attractors.length).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it('handles networks with biases', () => {
    const nodes: AnalysisNode[] = [
      { id: 'A' },
      { id: 'B' },
    ];
    const edges: AnalysisEdge[] = [
      { source: 'A', target: 'B', weight: 1 },
    ];

    const result = performWeightedAnalysis(nodes, edges, {
      biases: { A: 0.5, B: -0.5 },
      thresholdMultiplier: 0.5,
    });

    expect(result.attractors.length).toBeGreaterThan(0);
  });

  it('detects limit cycles', () => {
    // A cyclic network: A → B → C → A
    const nodes: AnalysisNode[] = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
    ];
    const edges: AnalysisEdge[] = [
      { source: 'A', target: 'B', weight: 1 },
      { source: 'B', target: 'C', weight: 1 },
      { source: 'C', target: 'A', weight: 1 },
    ];

    const result = performWeightedAnalysis(nodes, edges, { thresholdMultiplier: 0.5 });

    // Should find at least one attractor
    expect(result.attractors.length).toBeGreaterThan(0);
  });

  it('respects stateCap parameter', () => {
    const nodes: AnalysisNode[] = Array.from({ length: 5 }, (_, i) => ({
      id: String.fromCharCode(65 + i),
    }));
    const edges: AnalysisEdge[] = [];

    const result = performWeightedAnalysis(nodes, edges, { stateCap: 10 });

    expect(result.truncated).toBe(true);
    expect(result.exploredStateCount).toBeLessThanOrEqual(10);
  });

  it('applies tie-breaking behavior correctly', () => {
    const nodes: AnalysisNode[] = [
      { id: 'A' },
      { id: 'B' },
    ];
    const edges: AnalysisEdge[] = [
      { source: 'A', target: 'B', weight: 1 },
      { source: 'B', target: 'A', weight: 1 },
    ];

    // Test each tie behavior
    const resultZero = performWeightedAnalysis(nodes, edges, { tieBehavior: 'zero-as-zero' });
    const resultOne = performWeightedAnalysis(nodes, edges, { tieBehavior: 'zero-as-one' });
    const resultHold = performWeightedAnalysis(nodes, edges, { tieBehavior: 'hold' });

    expect(resultZero.attractors.length).toBeGreaterThan(0);
    expect(resultOne.attractors.length).toBeGreaterThan(0);
    expect(resultHold.attractors.length).toBeGreaterThan(0);
  });

  it('basin shares sum to 1.0 (100%) for non-truncated analysis', () => {
    const nodes: AnalysisNode[] = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
    ];
    const edges: AnalysisEdge[] = [
      { source: 'A', target: 'B', weight: 1 },
      { source: 'B', target: 'C', weight: 1 },
      { source: 'C', target: 'A', weight: -1 },
    ];

    const result = performWeightedAnalysis(nodes, edges, { thresholdMultiplier: 0.5 });

    // Sum of all basin shares should equal 1.0 (within floating point tolerance)
    const totalBasinShare = result.attractors.reduce((sum, att) => sum + att.basinShare, 0);
    expect(totalBasinShare).toBeCloseTo(1.0, 5);
    
    // No individual basin share should exceed 1.0
    result.attractors.forEach(att => {
      expect(att.basinShare).toBeLessThanOrEqual(1.0);
      expect(att.basinShare).toBeGreaterThanOrEqual(0);
    });
  });
});
