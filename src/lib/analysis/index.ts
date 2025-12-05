/**
 * Main analysis module barrel export.
 * Re-exports both rule-based and weighted analysis engines and utilities.
 */

// Types
export type {
  AnalysisNode,
  AnalysisEdge,
  StateSnapshot,
  AttractorType,
  DeterministicAttractor,
  DeterministicAnalysisResult,
  DeterministicAnalysisOptions,
  WeightedAnalysisOptions,
  WeightMatrix,
} from './types';

// Matrix utilities
export { edgesToMatrix, matrixToEdges, getInDegree, computeThreshold } from './matrixUtils';

// Weighted analysis
export { performWeightedAnalysis } from './weightedDeterministicAnalysis';
