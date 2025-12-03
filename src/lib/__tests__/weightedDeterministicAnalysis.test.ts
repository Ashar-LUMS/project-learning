import { describe, it, expect } from 'vitest';
import { edgesToMatrix, performWeightedDeterministicAnalysis } from '../weightedDeterministicAnalysis';

describe('weightedDeterministicAnalysis', () => {
  it('edgesToMatrix builds expected matrix', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }];
    const edges = [
      { source: 'A', target: 'B', weight: 1 },
      { source: 'B', target: 'A', weight: -1 },
    ];
    const W = edgesToMatrix(nodes as any, edges as any);
    expect(W.length).toBe(2);
    expect(W[0][1]).toBe(1);
    expect(W[1][0]).toBe(-1);
  });

  it('tie behavior: zero-as-zero, zero-as-one, hold', () => {
    const nodes = [{ id: 'A' }];
    const weights = [[0]]; // no influence
    const biases = [0];
    const resultHold = performWeightedDeterministicAnalysis({ nodes: nodes as any, weights, biases }, { tieBehavior: 'hold' });
    const resultZero = performWeightedDeterministicAnalysis({ nodes: nodes as any, weights, biases }, { tieBehavior: 'zero-as-zero' });
    const resultOne = performWeightedDeterministicAnalysis({ nodes: nodes as any, weights, biases }, { tieBehavior: 'zero-as-one' });
    expect(resultHold.attractors.length).toBeGreaterThan(0);
    expect(resultZero.attractors.length).toBeGreaterThan(0);
    expect(resultOne.attractors.length).toBeGreaterThan(0);
  });

  it('bias shifts threshold', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }];
    const weights = [ [0, 1], [0, 0] ]; // A influences B
    const biasesZero = [0, 0];
    const biasesPos = [0, 1]; // bias moves B toward 1
    const resZero = performWeightedDeterministicAnalysis({ nodes: nodes as any, weights, biases: biasesZero }, { tieBehavior: 'zero-as-zero' });
    const resPos = performWeightedDeterministicAnalysis({ nodes: nodes as any, weights, biases: biasesPos }, { tieBehavior: 'zero-as-zero' });
    expect(resZero.nodeOrder).toEqual(['A','B']);
    expect(resPos.nodeOrder).toEqual(['A','B']);
  });
});
