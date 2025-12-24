/**
 * Probabilistic analysis (PA) for Boolean/weighted networks.
 *
 * The implementation models state transitions with a mean-field Markov process
 * inspired by TISON: each node updates its activation probability using a
 * sigmoid response over the weighted net input, tempered by a noise parameter
 * (mu) and a self-degradation constant (c). The process iteratively applies a
 * kinetic master equation until convergence and returns the steady-state
 * probabilities together with potential energies (PE = -ln(P_i)).
 */

import type {
  AnalysisNode,
  AnalysisEdge,
  ProbabilisticAnalysisOptions,
  ProbabilisticAnalysisResult,
} from "./types";

const ZERO_TOLERANCE = 1e-9;
const MIN_PROBABILITY = 1e-9;

const clamp01 = (value: number): number => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const safeLogistic = (value: number, noise: number): number => {
  const scale = Math.max(Math.abs(noise), 1e-6);
  const exponent = -value / scale;
  // Clamp exponent to avoid floating point overflow
  if (exponent > 60) return 0;
  if (exponent < -60) return 1;
  return 1 / (1 + Math.exp(exponent));
};

export function performProbabilisticAnalysis(
  nodes: AnalysisNode[],
  edges: AnalysisEdge[],
  options: ProbabilisticAnalysisOptions = {},
): ProbabilisticAnalysisResult {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return {
      nodeOrder: [],
      probabilities: {},
      potentialEnergies: {},
      iterations: 0,
      converged: true,
      warnings: ["No nodes provided; probabilistic analysis skipped."],
    };
  }

  const warnings: string[] = [];
  const nodeOrder = nodes.map((node) => node.id);
  const indexLookup = new Map<string, number>();
  nodeOrder.forEach((id, index) => indexLookup.set(id, index));

  const incoming: Array<Array<{ index: number; weight: number }>> = nodeOrder.map(() => []);
  for (const edge of edges) {
    const sourceIndex = indexLookup.get(edge.source);
    const targetIndex = indexLookup.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    incoming[targetIndex].push({ index: sourceIndex, weight: edge.weight ?? 1 });
  }

  const noise = options.noise ?? 0.25;
  const selfDegradation = clamp01(options.selfDegradation ?? 0.1);
  const persistence = clamp01(1 - selfDegradation);
  const maxIterations = Math.max(1, Math.floor(options.maxIterations ?? 500));
  const tolerance = Math.max(1e-8, options.tolerance ?? 1e-4);
  const biases = options.biases ?? {};
  const basalActivity = options.basalActivity ?? {};
  const initialProbabilities = options.initialProbabilities ?? {};
  const globalInitial = clamp01(options.initialProbability ?? 0.5);

  let probabilities = nodeOrder.map((id) => clamp01(initialProbabilities[id] ?? globalInitial));
  let iterations = 0;
  let converged = false;

  for (; iterations < maxIterations; iterations += 1) {
    const nextProbabilities = probabilities.slice();
    let maxDelta = 0;

    for (let idx = 0; idx < nodeOrder.length; idx += 1) {
      const nodeId = nodeOrder[idx];
      let netInput = 0;

      for (const entry of incoming[idx]) {
        const sourceProbability = probabilities[entry.index];
        netInput += entry.weight * sourceProbability;
      }

      netInput += biases[nodeId] ?? 0;
      netInput += basalActivity[nodeId] ?? 0;

      let updatedProbability: number;

      if (Math.abs(netInput) < ZERO_TOLERANCE) {
        // With zero net input, the node degrades toward zero.
        updatedProbability = clamp01(probabilities[idx] * persistence);
      } else {
        const activationProbability = safeLogistic(netInput, noise);
        // Apply persistence to current state, then blend in fresh activation tempered by degradation.
        // This ensures the node's history (persistence * current) dominates over new signal.
        updatedProbability = clamp01(persistence * probabilities[idx] + (1 - persistence) * activationProbability);
      }

      maxDelta = Math.max(maxDelta, Math.abs(updatedProbability - probabilities[idx]));
      nextProbabilities[idx] = updatedProbability;
    }

    probabilities = nextProbabilities;

    if (maxDelta < tolerance) {
      converged = true;
      iterations += 1; // include the iteration that satisfied the tolerance
      break;
    }
  }

  if (!converged && iterations >= maxIterations) {
    warnings.push(
      `Probabilistic analysis reached the maximum iteration count (${maxIterations}) before converging. ` +
        `Consider increasing maxIterations or relaxing the tolerance.`,
    );
  }

  const probabilityMap: Record<string, number> = {};
  const potentialEnergyMap: Record<string, number> = {};
  probabilities.forEach((value, index) => {
    const nodeId = nodeOrder[index];
    const clamped = clamp01(value);
    probabilityMap[nodeId] = clamped;
    potentialEnergyMap[nodeId] = -Math.log(Math.max(clamped, MIN_PROBABILITY));
  });

  return {
    nodeOrder,
    probabilities: probabilityMap,
    potentialEnergies: potentialEnergyMap,
    iterations,
    converged,
    warnings,
  };
}
