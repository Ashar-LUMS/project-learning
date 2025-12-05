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
  /** Maximum number of initial states to explore exhaustively (defaults to 2^17). */
  stateCap?: number;
  /** Hard ceiling for per-path traversal steps (defaults to 2^17). */
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
