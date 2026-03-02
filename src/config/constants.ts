/**
 * Application-wide constants
 */

// API Configuration
export const API_CONFIG = {
  SUPABASE_TIMEOUT: 30000, // 30 seconds
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Analysis Configuration
export const ANALYSIS_CONFIG = {
  // Keep deterministic analyses bounded to prevent UI lockups on large networks.
  // These caps define the *default* number of initial states sampled and the
  // maximum steps per trajectory.
  DEFAULT_STATE_CAP: 100_000,
  DEFAULT_STEP_CAP: 10_000,
  MAX_NODES_DETERMINISTIC: 20,
  MAX_NODES_PROBABILISTIC: 200,
  PROBABILISTIC_DEFAULT_NOISE: 0.25,
  PROBABILISTIC_DEFAULT_DEGRADATION: 0.1,
  PROBABILISTIC_DEFAULT_ITERATIONS: 500,
  PROBABILISTIC_DEFAULT_TOLERANCE: 1e-4,
} as const;

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION: 3000, // 3 seconds
  MAX_RECENT_NETWORKS: 10,
  DEBOUNCE_DELAY: 300, // milliseconds
} as const;

// Feature Flags
export const FEATURES = {
  ENABLE_RULE_BASED_ANALYSIS: true, // Rule-based deterministic analysis
  ENABLE_PROBABILISTIC_ANALYSIS: true,
  ENABLE_WEIGHTED_ANALYSIS: true,
  ENABLE_NETWORK_IMPORT: true,
  ENABLE_RULE_INFERENCE: true,
} as const;

/**
 * Compute adaptive state/step caps that keep total work within a browser-safe budget.
 *
 * For small networks the full state space is enumerated.
 * For large networks both caps are scaled down so that
 *   stateCap × stepCap × costPerStep  ≤  COMPUTATION_BUDGET.
 */
export function computeAdaptiveCaps(
  nodeCount: number,
  edgeOrComplexityCount: number,
  requestedStateCap: number = ANALYSIS_CONFIG.DEFAULT_STATE_CAP,
  requestedStepCap: number = ANALYSIS_CONFIG.DEFAULT_STEP_CAP,
): { stateCap: number; stepCap: number } {
  // ~200 M operations → typically finishes in 1-3 s on modern hardware.
  const BUDGET = 200_000_000;
  const MIN_SAMPLES = 500;
  const MIN_STEPS = 200;

  // Networks with ≤ this many nodes are always fully enumerated (no sampling).
  const FULL_ENUM_NODE_LIMIT = 16;

  const costPerStep = Math.max(nodeCount, edgeOrComplexityCount, 1);
  const totalStateSpace = nodeCount <= 30 ? 2 ** nodeCount : Number.POSITIVE_INFINITY;

  // Always enumerate fully when the network is small enough (≤ 16 nodes → 65 536 states).
  if (nodeCount <= FULL_ENUM_NODE_LIMIT && Number.isFinite(totalStateSpace)) {
    return { stateCap: totalStateSpace, stepCap: requestedStepCap };
  }

  // If full enumeration fits in budget, enumerate everything.
  if (
    Number.isFinite(totalStateSpace) &&
    totalStateSpace <= requestedStateCap &&
    totalStateSpace * requestedStepCap * costPerStep <= BUDGET
  ) {
    return { stateCap: totalStateSpace, stepCap: requestedStepCap };
  }

  // Otherwise distribute the budget evenly across samples and steps.
  const sqrtBudget = Math.sqrt(BUDGET / costPerStep);
  const effectiveStateCap = Math.min(
    requestedStateCap,
    Math.max(MIN_SAMPLES, Math.floor(sqrtBudget)),
  );
  const effectiveStepCap = Math.min(
    requestedStepCap,
    Math.max(MIN_STEPS, Math.floor(sqrtBudget)),
  );

  return { stateCap: effectiveStateCap, stepCap: effectiveStepCap };
}

// Error Messages
export const ERROR_MESSAGES = {
  NO_NETWORK_SELECTED: 'No network selected. Please select a network first.',
  NO_NODES_FOUND: 'No nodes found in network. Please add nodes first.',
  SAVE_FAILED: 'Failed to save network',
  LOAD_FAILED: 'Failed to load network',
  ANALYSIS_FAILED: 'Analysis failed',
  INVALID_PARAMETERS: 'Invalid analysis parameters',
  NETWORK_TOO_LARGE: 'Network is too large for this analysis mode',
} as const;
