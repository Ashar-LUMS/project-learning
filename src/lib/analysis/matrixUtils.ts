/**
 * Utilities for converting network edges to a weighted adjacency matrix
 * and vice versa.
 */

import type { AnalysisEdge, WeightMatrix, WeightedAnalysisOptions } from './types';

/**
 * Convert a list of edges to a weight matrix.
 * @param nodes Array of node IDs
 * @param edges Array of edges with weights
 * @param options Analysis options (biases, threshold, etc.)
 * @returns Weight matrix with NxN adjacency matrix and metadata
 */
export function edgesToMatrix(
  nodes: string[],
  edges: AnalysisEdge[],
  options: WeightedAnalysisOptions = {}
): WeightMatrix {
  const {
    biases = {},
    thresholdMultiplier = 0.5,
    tieBehavior = 'zero-as-zero',
  } = options;

  const n = nodes.length;
  const nodeIndex = new Map(nodes.map((id, i) => [id, i]));

  // Initialize NxN matrix with zeros
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  // Populate matrix from edges
  edges.forEach((edge) => {
    const srcIdx = nodeIndex.get(edge.source);
    const tgtIdx = nodeIndex.get(edge.target);

    if (srcIdx !== undefined && tgtIdx !== undefined) {
      matrix[tgtIdx][srcIdx] = edge.weight ?? 1;
    }
  });

  // Normalize biases to all nodes
  const normalizedBiases: Record<string, number> = {};
  nodes.forEach((id) => {
    normalizedBiases[id] = biases[id] ?? 0;
  });

  return {
    nodes,
    matrix,
    biases: normalizedBiases,
    thresholdMultiplier,
    tieBehavior,
  };
}

/**
 * Convert a weight matrix back to edge list (for export/visualization).
 * @param weightMatrix The weight matrix
 * @returns Array of edges
 */
export function matrixToEdges(weightMatrix: WeightMatrix): AnalysisEdge[] {
  const { nodes, matrix } = weightMatrix;
  const edges: AnalysisEdge[] = [];

  for (let tgtIdx = 0; tgtIdx < matrix.length; tgtIdx++) {
    for (let srcIdx = 0; srcIdx < matrix[tgtIdx].length; srcIdx++) {
      const weight = matrix[tgtIdx][srcIdx];
      if (weight !== 0) {
        edges.push({
          source: nodes[srcIdx],
          target: nodes[tgtIdx],
          weight,
        });
      }
    }
  }

  return edges;
}

/**
 * Compute the in-degree (sum of incoming weights) for a node.
 * @param nodeIdx Index of the node
 * @param weightMatrix The weight matrix
 * @returns Sum of incoming weights
 */
export function getInDegree(nodeIdx: number, weightMatrix: WeightMatrix): number {
  const column = weightMatrix.matrix[nodeIdx];
  return column.reduce((sum, w) => sum + Math.abs(w), 0);
}

/**
 * Compute the threshold for a node given its in-degree.
 * @param inDegree The in-degree (sum of incoming weights)
 * @param thresholdMultiplier Multiplier for threshold (default 0.5)
 * @returns Computed threshold
 */
export function computeThreshold(
  inDegree: number,
  thresholdMultiplier: number = 0.5
): number {
  return inDegree * thresholdMultiplier;
}
