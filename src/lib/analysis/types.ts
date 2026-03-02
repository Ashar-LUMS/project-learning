/**
 * Shared types for deterministic network analysis (both rule-based and weight-based).
 */

export interface AnalysisNode {
  id: string;
  label?: string | null;
  properties?: Record<string, any>;
}

export interface AnalysisEdge {
  source: string;
  target: string;
  weight?: number;
  interaction?: string;
}

export interface StateSnapshot {
  binary: string;
  values: Record<string, 0 | 1>;
}

export type AttractorType = "fixed-point" | "limit-cycle";

export interface DeterministicAttractor {
  id: number;
  type: AttractorType;
  period: number;
  states: StateSnapshot[];
  basinSize: number;
  basinShare: number;
}

export interface DeterministicAnalysisResult {
  nodeOrder: string[];
  nodeLabels: Record<string, string>;
  attractors: DeterministicAttractor[];
  exploredStateCount: number;
  totalStateSpace: number;
  truncated: boolean;
  warnings: string[];
  unresolvedStates: number;
}

export interface DeterministicAnalysisOptions {
  /** Maximum number of initial states to explore (defaults to `ANALYSIS_CONFIG.DEFAULT_STATE_CAP`, currently 100,000). */
  stateCap?: number;
  /** Hard ceiling for per-path traversal steps (defaults to `ANALYSIS_CONFIG.DEFAULT_STEP_CAP`, currently 10,000). */
  stepCap?: number;
}

export interface WeightedAnalysisOptions extends DeterministicAnalysisOptions {
  /** Tie behavior when sum equals threshold ("zero-as-zero" | "zero-as-one" | "hold") */
  tieBehavior?: "zero-as-zero" | "zero-as-one" | "hold";
  /** Global bias per node (default 0) */
  biases?: Record<string, number>;
  /** Default threshold multiplier for all nodes (default 0.5, i.e., sum > 0.5 * degree) */
  thresholdMultiplier?: number;
}

export interface WeightMatrix {
  nodes: string[];
  matrix: number[][];
  biases: Record<string, number>;
  thresholdMultiplier: number;
  tieBehavior: "zero-as-zero" | "zero-as-one" | "hold";
}

export interface ProbabilisticAnalysisOptions {
  /** Noise parameter (mu) controlling sigmoid steepness. */
  noise?: number;
  /** Self-degradation constant (c) steering decay toward the inactive state. */
  selfDegradation?: number;
  /** Optional per-node basal activity offsets added to the weighted net input. */
  basalActivity?: Record<string, number>;
  /** Optional per-node biases (alias for basal activity). */
  biases?: Record<string, number>;
  /** Maximum number of kinetic update iterations before giving up (default 500). */
  maxIterations?: number;
  /** Convergence threshold on successive probability updates (default 1e-4). */
  tolerance?: number;
  /** Global initial probability (0..1) applied when per-node overrides are absent (default 0.5). */
  initialProbability?: number;
  /** Optional per-node overrides for initial probabilities. */
  initialProbabilities?: Record<string, number>;
}

export interface ProbabilisticAnalysisResult {
  nodeOrder: string[];
  probabilities: Record<string, number>;
  potentialEnergies: Record<string, number>;
  iterations: number;
  converged: boolean;
  warnings: string[];
}
