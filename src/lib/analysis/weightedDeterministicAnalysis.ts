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
import { computeThreshold } from './matrixUtils';
import { ANALYSIS_CONFIG, computeAdaptiveCaps } from '@/config/constants';

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
function encodeBits(bits: Uint8Array, chars: string[]): string {
  for (let i = 0; i < bits.length; i++) {
    chars[i] = bits[i] ? '1' : '0';
  }
  return chars.join('');
}

/**
 * Decode a binary string to a state object.
 */
function decodeBits(binary: string, out: Uint8Array): void {
  for (let i = 0; i < out.length; i++) {
    out[i] = binary.charCodeAt(i) === 49 ? 1 : 0; // '1'
  }
}

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
type IncomingEdge = { srcIdx: number; weight: number };

function makeRandomBinaryState(bitCount: number): string {
  const chars = new Array<string>(bitCount);
  for (let i = 0; i < bitCount; i++) {
    chars[i] = Math.random() < 0.5 ? '0' : '1';
  }
  return chars.join('');
}

function sampleInitialStates(bitCount: number, count: number): string[] {
  const unique = new Set<string>();
  const maxAttempts = Math.max(10_000, count * 10);
  let attempts = 0;
  while (unique.size < count && attempts < maxAttempts) {
    unique.add(makeRandomBinaryState(bitCount));
    attempts += 1;
  }

  // Extremely small state spaces can collide a lot; fall back to sequential fill.
  if (unique.size < count) {
    for (let i = 0; unique.size < count; i += 1) {
      unique.add(i.toString(2).padStart(bitCount, '0'));
    }
  }

  return Array.from(unique);
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
  const {
    stateCap: requestedStateCap = ANALYSIS_CONFIG.DEFAULT_STATE_CAP,
    stepCap: requestedStepCap = ANALYSIS_CONFIG.DEFAULT_STEP_CAP,
    tieBehavior = 'hold',
    biases = {},
    thresholdMultiplier = 0,
  } = options;

  const nodeOrder = nodes.map((n) => n.id);
  const nodeLabels: Record<string, string> = Object.fromEntries(
    nodes.map((n) => [n.id, n.label || n.id])
  );

  const n = nodeOrder.length;
  const indexLookup = new Map<string, number>();
  nodeOrder.forEach((id, idx) => indexLookup.set(id, idx));

  const incoming: IncomingEdge[][] = Array.from({ length: n }, () => []);
  const inAbsSum = new Array<number>(n).fill(0);
  for (const edge of edges) {
    const srcIdx = indexLookup.get(edge.source);
    const tgtIdx = indexLookup.get(edge.target);
    if (srcIdx === undefined || tgtIdx === undefined) continue;
    const w = edge.weight ?? 1;
    if (!Number.isFinite(w) || w === 0) continue;
    incoming[tgtIdx].push({ srcIdx, weight: w });
    inAbsSum[tgtIdx] += Math.abs(w);
  }

  // Adaptively scale caps so total work stays browser-safe.
  const edgeCount = edges.filter(e => (e.weight ?? 1) !== 0).length;
  const { stateCap, stepCap } = computeAdaptiveCaps(n, edgeCount, requestedStateCap, requestedStepCap);

  const biasByIndex = nodeOrder.map((id) => (Number.isFinite(biases[id]) ? (biases[id] as number) : 0));
  const thresholds = inAbsSum.map((sum) => computeThreshold(Math.max(sum, 1), thresholdMultiplier));

  const totalStateSpace = n <= 52 ? 2 ** n : Number.POSITIVE_INFINITY;
  const maxStates = Number.isFinite(totalStateSpace) ? Math.min(stateCap, totalStateSpace) : stateCap;
  const truncated = maxStates < totalStateSpace;

  const attractors: InternalAttractor[] = [];
  const stateToAttractorId = new Map<string, number>();
  const basinSizes = new Map<number, number>();

  const warnings: string[] = [];

  const initialStates: string[] = truncated
    ? sampleInitialStates(n, maxStates)
    : Array.from({ length: maxStates }, (_, i) => i.toString(2).padStart(n, '0'));

  const scratchCurrent = new Uint8Array(n);
  const scratchNext = new Uint8Array(n);
  const scratchChars = new Array<string>(n);

  const computeNextBinary = (currentBinary: string): string => {
    decodeBits(currentBinary, scratchCurrent);

    for (let tgtIdx = 0; tgtIdx < n; tgtIdx++) {
      let weightedSum = biasByIndex[tgtIdx] ?? 0;
      for (const entry of incoming[tgtIdx]) {
        if (scratchCurrent[entry.srcIdx]) {
          weightedSum += entry.weight;
        }
      }

      const threshold = thresholds[tgtIdx];
      if (weightedSum > threshold) {
        scratchNext[tgtIdx] = 1;
      } else if (weightedSum < threshold) {
        scratchNext[tgtIdx] = 0;
      } else {
        if (tieBehavior === 'hold') {
          scratchNext[tgtIdx] = scratchCurrent[tgtIdx];
        } else if (tieBehavior === 'zero-as-one') {
          scratchNext[tgtIdx] = 1;
        } else {
          scratchNext[tgtIdx] = 0;
        }
      }
    }

    return encodeBits(scratchNext, scratchChars);
  };

  let unresolvedStates = 0;

  // Explore states
  for (const stateBinary of initialStates) {

    if (stateToAttractorId.has(stateBinary)) {
      // Already part of an attractor - already counted in basin, skip
      continue;
    }

    // Traverse from this state until we find a cycle or reach step cap
    const path: string[] = [stateBinary];
    const indexByState = new Map<string, number>([[stateBinary, 0]]);
    let currentBinary = stateBinary;
    let stepCount = 0;

    while (stepCount < stepCap) {
      const nextBinary = computeNextBinary(currentBinary);

      stepCount++;

      // Check for cycle
      const cycleIdx = indexByState.get(nextBinary);
      if (cycleIdx !== undefined) {
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
        for (const b of path) {
          if (!stateToAttractorId.has(b)) {
            stateToAttractorId.set(b, attractorId);
            basinSizes.set(attractorId, (basinSizes.get(attractorId) ?? 0) + 1);
          }
        }
        break;
      }

      path.push(nextBinary);
      indexByState.set(nextBinary, path.length - 1);
      currentBinary = nextBinary;

      if (stateToAttractorId.has(nextBinary)) {
        // Converged to an existing attractor
        const attractorId = stateToAttractorId.get(nextBinary)!;
        for (const b of path) {
          if (!stateToAttractorId.has(b)) {
            stateToAttractorId.set(b, attractorId);
            basinSizes.set(attractorId, (basinSizes.get(attractorId) ?? 0) + 1);
          }
        }
        break;
      }
    }

    if (stepCount >= stepCap) {
      unresolvedStates += path.length;
    }
  }

  // Compute basin shares
  const result: DeterministicAnalysisResult = {
    nodeOrder,
    nodeLabels,
    attractors: attractors.map((att) => ({
      ...att,
      basinShare: (basinSizes.get(att.id)! / Math.max(1, stateToAttractorId.size)),
    })),
    exploredStateCount: stateToAttractorId.size,
    totalStateSpace,
    truncated,
    warnings,
    unresolvedStates,
  };

  return result;
}
