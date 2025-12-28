/**
 * Analysis Module - Quick Reference
 *
 * This file serves as a quick reference for all available exports
 * and their primary use cases.
 */

// ============================================================================
// TYPES
// ============================================================================

// Import from '@/lib/analysis' or '@/lib/analysis/types'
import type {
  AnalysisNode,           // { id: string; label?: string }
  AnalysisEdge,           // { source: string; target: string; weight?: number }
  StateSnapshot,          // { binary: string; values: Record<string, 0|1> }
  DeterministicAttractor, // Attractor with period, states, basin
  DeterministicAnalysisResult, // Main result type (used by both engines)
  DeterministicAnalysisOptions, // Rule-based options
  WeightedAnalysisOptions, // Weighted-specific options
  WeightMatrix,           // Weight matrix with metadata
} from '@/lib/analysis';

// ============================================================================
// FUNCTIONS - WEIGHTED ANALYSIS ENGINE
// ============================================================================

// import { performWeightedAnalysis } from '@/lib/analysis';

/**
 * Run weighted deterministic analysis on a network.
 *
 * @param nodes Array of nodes
 * @param edges Array of weighted edges
 * @param options Analysis options (thresholdMultiplier, tieBehavior, biases, etc.)
 * @returns Analysis result with attractors and basin information
 *
 * @example
 * const result = performWeightedAnalysis(nodes, edges, {
 *   thresholdMultiplier: 0.5,
 *   tieBehavior: 'zero-as-zero',
 * });
 * console.log(result.attractors);
 */
// function performWeightedAnalysis(
//   nodes: AnalysisNode[],
//   edges: AnalysisEdge[],
//   options?: WeightedAnalysisOptions
// ): DeterministicAnalysisResult;

// ============================================================================
// FUNCTIONS - MATRIX UTILITIES
// ============================================================================

// import { edgesToMatrix, matrixToEdges, getInDegree, computeThreshold } from '@/lib/analysis';

/**
 * Convert edge list to weight matrix.
 *
 * @param nodes Node IDs in analysis order
 * @param edges Edges with weights
 * @param options Options (biases, threshold multiplier, etc.)
 * @returns Weight matrix object with matrix, nodes, biases, etc.
 *
 * @example
 * const wm = edgesToMatrix(['A', 'B'], [{ source: 'A', target: 'B', weight: 2 }]);
 * console.log(wm.matrix); // [[0, 0], [2, 0]]
 */
// function edgesToMatrix(
//   nodes: string[],
//   edges: AnalysisEdge[],
//   options?: WeightedAnalysisOptions
// ): WeightMatrix;

/**
 * Convert weight matrix back to edge list.
 *
 * @param weightMatrix Weight matrix object (output from edgesToMatrix)
 * @returns Edge list (omits zero-weight edges)
 *
 * @example
 * const edges = matrixToEdges(wm);
 */
// function matrixToEdges(weightMatrix: WeightMatrix): AnalysisEdge[];

/**
 * Get the sum of incoming weights for a node.
 *
 * @param nodeIdx Index of the node in the weight matrix
 * @param weightMatrix Weight matrix object
 * @returns Sum of absolute values of incoming weights
 *
 * @example
 * const inDegree = getInDegree(0, wm); // For node A
 */
// function getInDegree(nodeIdx: number, weightMatrix: WeightMatrix): number;

/**
 * Compute the threshold for a node given its in-degree.
 *
 * @param inDegree Sum of incoming weights
 * @param thresholdMultiplier Multiplier (default 0.5)
 * @returns Threshold value
 *
 * @example
 * const threshold = computeThreshold(4, 0.5); // Returns 2
 */
// function computeThreshold(
//   inDegree: number,
//   thresholdMultiplier?: number
// ): number;

// ============================================================================
// HOOKS - REACT INTEGRATION
// ============================================================================

// import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';

/**
 * React hook for weighted deterministic analysis.
 *
 * @returns { result, isRunning, error, run, reset }
 *
 * @example
 * const { run, result, isRunning } = useWeightedAnalysis();
 * await run(nodes, edges, { thresholdMultiplier: 0.5 });
 * if (result) {
 *   console.log(result.attractors);
 * }
 */
// function useWeightedAnalysis(): {
//   result: DeterministicAnalysisResult | null;
//   isRunning: boolean;
//   error: string | null;
//   run: (nodes: AnalysisNode[], edges: AnalysisEdge[], options?: WeightedAnalysisOptions) => Promise<void>;
//   reset: () => void;
// };

// ============================================================================
// DOCUMENTATION FILES
// ============================================================================

// README.md - User guide with examples, options, and performance tips
// ALGORITHM.md - Mathematical foundation and pseudocode
// INTEGRATION_EXAMPLE.md - How to wire into NetworkEditorPage
// IMPLEMENTATION_SUMMARY.md - Architecture and implementation details

// ============================================================================
// COMMON WORKFLOWS
// ============================================================================

// --- Run analysis in a React component ---
/*
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';

export function AnalysisPanel() {
  const { run, result, isRunning, error } = useWeightedAnalysis();

  const handleAnalyze = async () => {
    const nodes = [{ id: 'A' }, { id: 'B' }];
    const edges = [{ source: 'A', target: 'B', weight: 2 }];
    await run(nodes, edges, { thresholdMultiplier: 0.5 });
  };

  return (
    <div>
      <button onClick={handleAnalyze} disabled={isRunning}>
        Analyze
      </button>
      {error && <p>{error}</p>}
      {result && <p>Found {result.attractors.length} attractors</p>}
    </div>
  );
}
*/

// --- Directly call analysis function ---
/*
import { performWeightedAnalysis } from '@/lib/analysis';

const nodes = [{ id: 'A', label: 'Gene A' }, { id: 'B', label: 'Gene B' }];
const edges = [{ source: 'A', target: 'B', weight: 2 }];

const result = performWeightedAnalysis(nodes, edges, {
  thresholdMultiplier: 0.5,
  tieBehavior: 'zero-as-zero',
});

result.attractors.forEach((att) => {
  console.log(`Attractor: ${att.type}, Period: ${att.period}, Basin: ${att.basinShare * 100}%`);
});
*/

// --- Convert edges to matrix ---
/*
import { edgesToMatrix, matrixToEdges } from '@/lib/analysis';

const wm = edgesToMatrix(
  ['A', 'B', 'C'],
  [
    { source: 'A', target: 'B', weight: 2 },
    { source: 'B', target: 'C', weight: 1 },
  ]
);

// Use for export/serialization
const edges = matrixToEdges(wm);
*/

// ============================================================================
// OPTIONS REFERENCE
// ============================================================================

/*
interface WeightedAnalysisOptions {
  // Maximum states to explore (default: 2^20)
  stateCap?: number;

  // Maximum steps per trajectory (default: 2^20)
  stepCap?: number;

  // Behavior when weighted sum equals threshold
  // - 'zero-as-zero': set to 0 (default)
  // - 'zero-as-one': set to 1
  // - 'hold': keep previous state
  tieBehavior?: 'zero-as-zero' | 'zero-as-one' | 'hold';

  // Per-node bias (constant offset, default: 0 for all)
  biases?: Record<string, number>;

  // Threshold multiplier: threshold = inDegree * multiplier (default: 0.5)
  // - 0.5: nodes fire at half their in-degree
  // - 1.0: nodes require full in-degree to fire
  thresholdMultiplier?: number;
}
*/

// ============================================================================
// RESULT STRUCTURE REFERENCE
// ============================================================================

/*
interface DeterministicAnalysisResult {
  // Node IDs in analysis order
  nodeOrder: string[];

  // Map of node ID → label for display
  nodeLabels: Record<string, string>;

  // Attractors found
  attractors: Array<{
    id: number;                    // Unique ID
    type: 'fixed-point' | 'limit-cycle';
    period: number;                // Cycle length (1 for fixed points)
    states: Array<{
      binary: string;              // Binary state (e.g., "1010")
      values: Record<string, 0|1>; // State values by node ID
    }>;
    basinSize: number;             // Absolute count of states
    basinShare: number;            // Fraction (0–1)
  }>;

  exploredStateCount: number;     // States explored
  totalStateSpace: number;        // Total possible states (2^N)
  truncated: boolean;             // Analysis was capped
  warnings: string[];             // Warning messages
  unresolvedStates: number;       // Always 0 for weighted
}
*/

export {};
