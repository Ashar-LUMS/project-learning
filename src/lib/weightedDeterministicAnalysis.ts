/*
  Weighted deterministic analysis (synchronous updates).

  This enumerates the Boolean state space of a network whose next state is
  computed from a weighted sum of inputs per node followed by a step function.

  Inputs are provided separately as (1) nodes and (2) a weight matrix.
  - nodes: array of node ids (with optional labels)
  - weights: N x N matrix, where weights[i][j] is the influence from node i to node j
  - biases (optional): length N vector added to each node's input sum

  Update rule per node j at time t+1:
    x_j(t+1) = step( sum_i (weights[i][j] * x_i(t)) + bias_j )

  The step threshold is zero; ties (exactly zero) are resolved via options.tieBehavior.

  The output format uses standard analysis types for attractor visualization.
*/

// Define analysis types locally
type DeterministicAttractor = {
  id?: number;
  type: 'fixed' | 'cycle' | 'fixed-point' | 'limit-cycle';
  states: number[][] | Array<{ binary: string; values: Record<string, 0 | 1> }>;
  size?: number;
  period?: number;
  basinSize?: number;
  basinShare?: number;
};

type DeterministicAnalysisResult = {
  attractors: DeterministicAttractor[];
  nodeOrder: string[];
  nodeLabels?: Record<string, string>;
  warnings: string[];
  exploredStateCount?: number;
  totalStateSpace?: number;
  totalStatesExplored?: number;
  runtime?: number;
  truncated?: boolean;
  unresolvedStates?: number;
};

import { decodeState, encodeState, formatState } from './stateEncoding';

export interface WeightedNode {
  id: string;
  label?: string | null;
}

export type TieBehavior = 'zero-as-zero' | 'zero-as-one' | 'hold';

export interface WeightedAnalysisOptions {
  stateCap?: number;   // maximum number of states to explore (defaults to 2^17)
  stepCap?: number;    // maximum steps per trajectory (defaults to 2^17)
  tieBehavior?: TieBehavior; // how to resolve net input == 0
}

export interface WeightedNetworkMatrix {
  nodes: WeightedNode[];
  /** weights[i][j] is influence from nodes[i] to nodes[j] */
  weights: number[][];
  /** biases[j] added to node j's net input; default 0 */
  biases?: number[];
}

export interface WeightedEdge {
  source: string;
  target: string;
  weight: number;
}

const DEFAULT_STATE_CAP = 262144; // 2^18
const DEFAULT_STEP_CAP = 262144;
const MAX_SUPPORTED_NODES = 18;

// shared helpers imported from stateEncoding.ts

export function edgesToMatrix(
  nodes: WeightedNode[],
  edges: WeightedEdge[],
): number[][] {
  const n = nodes.length;
  const indexOf = new Map<string, number>();
  nodes.forEach((nd, i) => indexOf.set(nd.id, i));
  const W = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (const e of edges) {
    const i = indexOf.get(e.source);
    const j = indexOf.get(e.target);
    if (i === undefined || j === undefined) continue;
    W[i][j] = e.weight;
  }
  return W;
}

export function performWeightedDeterministicAnalysis(
  network: WeightedNetworkMatrix,
  options?: WeightedAnalysisOptions,
): DeterministicAnalysisResult {
  if (!network) throw new Error('Network payload is required.');
  const nodes = Array.isArray(network.nodes) ? network.nodes : [];
  const weights = Array.isArray(network.weights) ? network.weights : [] as number[][];
  const biases = Array.isArray(network.biases) ? network.biases : [] as number[];

  if (!nodes.length) {
    return {
      nodeOrder: [],
      nodeLabels: {},
      attractors: [],
      exploredStateCount: 0,
      totalStateSpace: 0,
      truncated: false,
      warnings: ['No nodes supplied; analysis skipped.'],
      unresolvedStates: 0,
    };
  }

  const n = nodes.length;
  if (n > MAX_SUPPORTED_NODES) {
    throw new Error(`Weighted deterministic analysis supports up to ${MAX_SUPPORTED_NODES} nodes.`);
  }

  if (weights.length !== n || weights.some(row => row.length !== n)) {
    throw new Error('weights must be an N x N matrix aligned to nodes order.');
  }

  if (biases.length && biases.length !== n) {
    throw new Error('biases length must be 0 or N.');
  }

  const nodeOrder = nodes.map(nd => nd.id);
  const nodeLabels: Record<string, string> = {};
  for (const nd of nodes) {
    const clean = (nd.label || '').trim();
    nodeLabels[nd.id] = clean.length ? clean : nd.id;
  }

  const stateCap = options?.stateCap ?? DEFAULT_STATE_CAP;
  const stepCap = options?.stepCap ?? DEFAULT_STEP_CAP;
  const tieBehavior: TieBehavior = options?.tieBehavior ?? 'hold';

  const totalStateSpace = Math.pow(2, n);
  const truncated = totalStateSpace > stateCap;
  const warnings: string[] = truncated
    ? [`State space (${totalStateSpace}) exceeds cap (${stateCap}); analysis covers a subset.`]
    : [];

  const visitedStates = new Set<number>();
  const stateToAttractor = new Map<number, number>();
  const attractorCycles: number[][] = [];
  const attractorBasins: number[] = [];
  let unresolvedStates = 0;

  const scratchCurrent = new Uint8Array(n);
  const scratchNext = new Uint8Array(n);

  const computeNextState = (value: number): number => {
    decodeState(value, scratchCurrent);
    for (let j = 0; j < n; j += 1) {
      let sum = biases[j] || 0;
      for (let i = 0; i < n; i += 1) {
        if (scratchCurrent[i]) sum += weights[i][j];
      }
      if (sum > 0) scratchNext[j] = 1;
      else if (sum < 0) scratchNext[j] = 0;
      else {
        if (tieBehavior === 'zero-as-one') scratchNext[j] = 1;
        else if (tieBehavior === 'hold') scratchNext[j] = scratchCurrent[j];
        else scratchNext[j] = 0; // zero-as-zero
      }
    }
    return encodeState(scratchNext);
  };

  const initialLimit = truncated ? stateCap : totalStateSpace;

  for (let baseState = 0; baseState < initialLimit; baseState += 1) {
    if (stateToAttractor.has(baseState)) continue;

    const path: number[] = [];
    const indexByState = new Map<number, number>();
    let current = baseState;
    let steps = 0;
    let resolved = false;

    while (steps < stepCap) {
      if (stateToAttractor.has(current)) {
        const attractorId = stateToAttractor.get(current)!;
        for (const s of path) {
          if (!stateToAttractor.has(s)) {
            stateToAttractor.set(s, attractorId);
            attractorBasins[attractorId] += 1;
          }
        }
        resolved = true;
        break;
      }

      if (indexByState.has(current)) {
        const cycleStart = indexByState.get(current)!;
        const cycleStates = path.slice(cycleStart);
        const attractorId = attractorCycles.length;
        attractorCycles.push(cycleStates);
        attractorBasins.push(cycleStates.length);
        for (const s of cycleStates) stateToAttractor.set(s, attractorId);
        for (let i = 0; i < cycleStart; i += 1) {
          const s = path[i];
          stateToAttractor.set(s, attractorId);
          attractorBasins[attractorId] += 1;
        }
        resolved = true;
        break;
      }

      indexByState.set(current, path.length);
      path.push(current);
      visitedStates.add(current);
      const nextState = computeNextState(current);
      current = nextState;
      steps += 1;
    }

    if (!resolved) {
      unresolvedStates += path.length + 1;
      warnings.push(
        `Traversal step cap reached while analyzing state ${baseState.toString(2).padStart(n, '0')}.`,
      );
    }
  }

  let exploredStateCount = visitedStates.size;

  // Defensive check: ensure attractor basin counts do not exceed exploredStateCount
  // due to traversal accounting differences. If they do, normalize denominator
  // to the sum of basin sizes and emit a warning so callers can inspect.
  const totalAssignedToBasins = attractorBasins.reduce((acc, v) => acc + (v || 0), 0);
  if (totalAssignedToBasins > exploredStateCount) {
    warnings.push(`Attractor basin counts (${totalAssignedToBasins}) exceed visited state count (${exploredStateCount}); normalizing basin shares.`);
    exploredStateCount = totalAssignedToBasins;
  }

  const attractors: DeterministicAttractor[] = attractorCycles.map((cycleStates, id) => {
    const period = cycleStates.length;
    const type = period === 1 ? 'fixed-point' : 'limit-cycle' as const;
    const states = cycleStates.map((st) => formatState(st, nodeOrder, nodeLabels));
    const basinSize = attractorBasins[id] ?? cycleStates.length;
    const basinShare = exploredStateCount > 0 ? basinSize / exploredStateCount : 0;
    return { id, type, period, states, basinSize, basinShare };
  });

  return {
    nodeOrder,
    nodeLabels,
    attractors,
    exploredStateCount,
    totalStateSpace,
    truncated,
    warnings,
    unresolvedStates,
  } satisfies DeterministicAnalysisResult;
}

export default performWeightedDeterministicAnalysis;
