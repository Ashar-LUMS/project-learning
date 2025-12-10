import type { DeterministicAnalysisResult } from './deterministicAnalysis';

export type ProbabilisticOptions = {
  simulations: number;
  seed?: number;
  activationProbabilities?: Record<string, number>; // node id -> P(activate)
};

export type ProbabilisticInput = {
  nodeIds: string[];
  nodeLabels: Record<string, string>;
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function runProbabilisticAnalysis(
  input: ProbabilisticInput,
  options: ProbabilisticOptions
): DeterministicAnalysisResult {
  const { nodeIds, nodeLabels } = input;
  const { simulations, seed = 1234, activationProbabilities = {} } = options;
  const rnd = mulberry32(seed);

  const totalStateSpace = Math.pow(2, nodeIds.length);
  const exploredStateCount = Math.min(simulations, totalStateSpace);

  const stateCounts: Record<string, number> = {};
  for (let s = 0; s < exploredStateCount; s++) {
    let bits = '';
    const values: Record<string, 0 | 1> = {} as any;
    for (const id of nodeIds) {
      const p = typeof activationProbabilities[id] === 'number' ? activationProbabilities[id] : 0.5;
      const v = rnd() < p ? 1 : 0;
      values[id] = v as 0 | 1;
      bits += v.toString();
    }
    stateCounts[bits] = (stateCounts[bits] ?? 0) + 1;
  }

  const attractors = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.min(5, Object.keys(stateCounts).length))
    .map(([binary, count], idx) => ({
      id: idx,
      type: 'fixed-point' as any,
      period: 1,
      basinShare: count / exploredStateCount,
      basinSize: count,
      states: [
        {
          index: 0,
          binary,
          values: nodeIds.reduce((acc, id, i) => {
            acc[id] = Number(binary[i]) as 0 | 1;
            return acc;
          }, {} as Record<string, 0 | 1>),
        },
      ],
    }));

  const warnings: string[] = [];
  if (exploredStateCount < totalStateSpace) {
    warnings.push('Probabilistic analysis explored a subset of state space.');
  }

  return {
    nodeOrder: nodeIds,
    nodeLabels,
    totalStateSpace,
    exploredStateCount,
    attractors,
    truncated: exploredStateCount < totalStateSpace,
    unresolvedStates: 0,
    warnings,
  };
}
