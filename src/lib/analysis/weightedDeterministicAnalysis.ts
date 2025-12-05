/**
 * Weighted deterministic network analysis.
 *
 * This module performs synchronous dynamics on a weighted network where:
 * - Each node has incoming weighted edges from other nodes.
 * - A node's next state is determined by summing weighted inputs from active (value=1) predecessors.
 * - The sum is compared to a threshold to determine the next state.
 * - Tie behavior (when sum equals threshold) is configurable.
 *
 * The analysis returns attractors (fixed points and limit cycles) and basin of attraction sizes.
 */

import type {
  AnalysisNode,
  AnalysisEdge,
  DeterministicAnalysisResult,
  StateSnapshot,
  WeightedAnalysisOptions,
} from './types';
import { edgesToMatrix, computeThreshold } from './matrixUtils';

interface InternalAttractor {
  id: number;
  type: 'fixed-point' | 'limit-cycle';
  period: number;
  states: StateSnapshot[];
  basinSize: number;
}

/**
 * Encode a state object to a binary string.
 */
function encodeState(state: Record<string, 0 | 1>, nodeOrder: string[]): string {
  return nodeOrder.map((id) => (state[id] ? '1' : '0')).join('');
}

/**
 * Decode a binary string to a state object.
 */
function decodeState(binary: string, nodeOrder: string[]): Record<string, 0 | 1> {
  const state: Record<string, 0 | 1> = {};
  for (let i = 0; i < nodeOrder.length; i++) {
    state[nodeOrder[i]] = (binary[i] === '1' ? 1 : 0) as 0 | 1;
  }
  return state;
}

/**
 * Format a state snapshot for display.
 */
function formatState(binary: string, nodeOrder: string[]): StateSnapshot {
  return {
    binary,
    values: decodeState(binary, nodeOrder),
  };
}

/**
 * Compute the next state for a weighted network.
 *
 * Each node's next value is determined by:
 * 1. Sum incoming weights from active (value=1) predecessors.
 * 2. Compare sum to threshold.
 * 3. If sum > threshold: next = 1.
 * 4. If sum < threshold: next = 0.
 * 5. If sum === threshold: apply tie behavior.
 */
function computeNextState(
  currentState: Record<string, 0 | 1>,
  nodeOrder: string[],
  weightMatrix: number[][],
  biases: Record<string, number>,
  thresholdMultiplier: number,
  tieBehavior: 'zero-as-zero' | 'zero-as-one' | 'hold'
): Record<string, 0 | 1> {
  const nextState: Record<string, 0 | 1> = {};

  for (let tgtIdx = 0; tgtIdx < nodeOrder.length; tgtIdx++) {
    const nodeId = nodeOrder[tgtIdx];
    const incomingWeights = weightMatrix[tgtIdx];
    const bias = biases[nodeId] ?? 0;

    // Sum incoming weighted inputs
    let weightedSum = bias;
    for (let srcIdx = 0; srcIdx < incomingWeights.length; srcIdx++) {
      const weight = incomingWeights[srcIdx];
      if (weight !== 0 && currentState[nodeOrder[srcIdx]] === 1) {
        weightedSum += weight;
      }
    }

    // Compute threshold
    const inDegree = Math.max(
      incomingWeights.reduce((sum, w) => sum + Math.abs(w), 0),
      1 // Ensure at least 1 to avoid division by zero
    );
    const threshold = computeThreshold(inDegree, thresholdMultiplier);

    // Apply comparison
    let nextValue: 0 | 1;
    if (weightedSum > threshold) {
      nextValue = 1;
    } else if (weightedSum < threshold) {
      nextValue = 0;
    } else {
      // Tie: apply behavior
      if (tieBehavior === 'hold') {
        nextValue = currentState[nodeId];
      } else if (tieBehavior === 'zero-as-one') {
        nextValue = 1;
      } else {
        // 'zero-as-zero' (default)
        nextValue = 0;
      }
    }

    nextState[nodeId] = nextValue;
  }

  return nextState;
}

/**
 * Perform weighted deterministic analysis on a network.
 *
 * @param nodes Array of nodes
 * @param edges Array of weighted edges
 * @param options Analysis options
 * @returns Analysis result with attractors and basin sizes
 */
export function performWeightedAnalysis(
  nodes: AnalysisNode[],
  edges: AnalysisEdge[],
  options: WeightedAnalysisOptions = {}
): DeterministicAnalysisResult {
  const { stateCap = 2 ** 17, stepCap = 2 ** 17, tieBehavior = 'zero-as-zero', biases = {}, thresholdMultiplier = 0.5 } = options;

  const nodeOrder = nodes.map((n) => n.id);
  const nodeLabels: Record<string, string> = Object.fromEntries(
    nodes.map((n) => [n.id, n.label || n.id])
  );

  const weightMatrix = edgesToMatrix(nodeOrder, edges, { biases, thresholdMultiplier, tieBehavior }).matrix;

  const totalStateSpace = 2 ** nodeOrder.length;
  const maxStates = Math.min(stateCap, totalStateSpace);
  const truncated = maxStates < totalStateSpace;

  const attractors: InternalAttractor[] = [];
  const stateToAttractorId = new Map<string, number>();
  const basinSizes = new Map<number, number>();
  let exploredCount = 0;

  // Explore states
  for (let stateNum = 0; stateNum < maxStates; stateNum++) {
    const stateBinary = stateNum.toString(2).padStart(nodeOrder.length, '0');

    if (stateToAttractorId.has(stateBinary)) {
      // Already part of an attractor
      const attractorId = stateToAttractorId.get(stateBinary)!;
      basinSizes.set(attractorId, (basinSizes.get(attractorId) ?? 0) + 1);
      continue;
    }

    // Traverse from this state until we find a cycle or reach step cap
    const path: string[] = [stateBinary];
    let currentBinary = stateBinary;
    let stepCount = 0;

    while (stepCount < stepCap) {
      const currentState = decodeState(currentBinary, nodeOrder);
      const nextState = computeNextState(
        currentState,
        nodeOrder,
        weightMatrix,
        biases,
        thresholdMultiplier,
        tieBehavior
      );
      const nextBinary = encodeState(nextState, nodeOrder);

      stepCount++;

      // Check for cycle
      const cycleIdx = path.indexOf(nextBinary);
      if (cycleIdx >= 0) {
        // Found a cycle
        const cycleStates = path.slice(cycleIdx);
        const cycleType = cycleStates.length === 1 ? ('fixed-point' as const) : ('limit-cycle' as const);
        const attractorId = attractors.length;

        const attractor: InternalAttractor = {
          id: attractorId,
          type: cycleType,
          period: cycleStates.length,
          states: cycleStates.map((b) => formatState(b, nodeOrder)),
          basinSize: path.length, // Include transient states
        };
        attractors.push(attractor);

        // Mark all states in path as belonging to this attractor
        path.forEach((b) => {
          stateToAttractorId.set(b, attractorId);
          basinSizes.set(attractorId, (basinSizes.get(attractorId) ?? 0) + 1);
        });
        break;
      }

      path.push(nextBinary);
      currentBinary = nextBinary;

      if (stateToAttractorId.has(nextBinary)) {
        // Converged to an existing attractor
        const attractorId = stateToAttractorId.get(nextBinary)!;
        path.forEach((b) => {
          if (!stateToAttractorId.has(b)) {
            stateToAttractorId.set(b, attractorId);
            basinSizes.set(attractorId, (basinSizes.get(attractorId) ?? 0) + 1);
          }
        });
        break;
      }
    }

    exploredCount++;
  }

  // Compute basin shares
  const result: DeterministicAnalysisResult = {
    nodeOrder,
    nodeLabels,
    attractors: attractors.map((att) => ({
      ...att,
      basinShare: basinSizes.get(att.id)! / maxStates,
    })),
    exploredStateCount: exploredCount,
    totalStateSpace,
    truncated,
    warnings: truncated ? [`Analysis truncated: explored ${maxStates} of ${totalStateSpace} states`] : [],
    unresolvedStates: 0, // In weighted, all states resolve
  };

  return result;
}
