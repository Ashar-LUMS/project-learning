# Analysis Module

This folder contains deterministic network analysis engines for computing dynamics, attractors, and basins of attraction.

## Structure

- **`types.ts`** – Shared TypeScript interfaces for both analysis engines.
- **`matrixUtils.ts`** – Utilities for converting between edge lists and weighted adjacency matrices.
- **`weightedDeterministicAnalysis.ts`** – Weight-based deterministic analysis engine.
- **`__tests__/`** – Vitest unit tests for utilities and analysis functions.
- **`index.ts`** – Barrel export for easy imports.

## Weighted Deterministic Analysis

### Overview

The weighted analysis computes the synchronous dynamics of a network where each node's next state depends on:

1. **Incoming weights** from active (value=1) predecessors.
2. **Bias** (optional constant offset).
3. **Threshold** comparison (computed as in-degree × `thresholdMultiplier`).
4. **Tie-breaking behavior** when the weighted sum equals the threshold.

### Usage

#### Basic Example

```typescript
import { performWeightedAnalysis } from '@/lib/analysis';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis';

const nodes: AnalysisNode[] = [
  { id: 'A', label: 'Gene A' },
  { id: 'B', label: 'Gene B' },
  { id: 'C', label: 'Gene C' },
];

const edges: AnalysisEdge[] = [
  { source: 'A', target: 'B', weight: 2 },
  { source: 'B', target: 'C', weight: 1 },
  { source: 'C', target: 'A', weight: 0.5 },
];

const result = performWeightedAnalysis(nodes, edges, {
  thresholdMultiplier: 0.5,
  tieBehavior: 'zero-as-zero',
});

console.log(`Found ${result.attractors.length} attractors`);
result.attractors.forEach((att, i) => {
  console.log(`Attractor ${i}:`, att.type, `Period: ${att.period}`);
});
```

#### With Biases

```typescript
const result = performWeightedAnalysis(nodes, edges, {
  biases: {
    A: 0.5,  // Positive bias: encourages A to be ON
    B: -0.5, // Negative bias: discourages B
    C: 0,
  },
  thresholdMultiplier: 0.5,
});
```

#### With Custom Thresholds and Tie-Breaking

```typescript
const result = performWeightedAnalysis(nodes, edges, {
  thresholdMultiplier: 1.0, // Stricter: sum must exceed full in-degree
  tieBehavior: 'hold',      // On tie, keep previous state
  stateCap: 1000,           // Explore up to 1000 states
  stepCap: 5000,            // Follow each path up to 5000 steps
});
```

### Options

All options are optional and have sensible defaults.

```typescript
interface WeightedAnalysisOptions {
  /** Maximum states to explore (default: 2^17 ≈ 131K) */
  stateCap?: number;
  
  /** Maximum steps per trajectory (default: 2^17) */
  stepCap?: number;
  
  /** Behavior when weighted sum equals threshold */
  tieBehavior?: 'zero-as-zero' | 'zero-as-one' | 'hold';
  
  /** Per-node bias/offset added to weighted sum */
  biases?: Record<string, number>;
  
  /** Multiplier for threshold: threshold = inDegree × multiplier */
  thresholdMultiplier?: number;
}
```

### Tie-Breaking Behavior

- **`'zero-as-zero'` (default)** – On tie, set next state to 0.
- **`'zero-as-one'`** – On tie, set next state to 1.
- **`'hold'`** – On tie, keep the current state (useful for bistability).

### Result Structure

```typescript
interface DeterministicAnalysisResult {
  /** List of node IDs in analysis order */
  nodeOrder: string[];
  
  /** Map of node ID → label for display */
  nodeLabels: Record<string, string>;
  
  /** Attractors found (fixed points and limit cycles) */
  attractors: Array<{
    id: number;
    type: 'fixed-point' | 'limit-cycle';
    period: number;
    states: Array<{ binary: string; values: Record<string, 0 | 1> }>;
    basinSize: number;        // Absolute count of states
    basinShare: number;       // Fraction of state space (0–1)
  }>;
  
  /** Number of states explored */
  exploredStateCount: number;
  
  /** Total possible states in state space */
  totalStateSpace: number;
  
  /** true if analysis was truncated due to stateCap */
  truncated: boolean;
  
  /** Warning messages (e.g., if truncated) */
  warnings: string[];
  
  /** In weighted analysis, always 0 (all states resolve) */
  unresolvedStates: number;
}
```

### React Hook

Use the `useWeightedAnalysis` hook in React components:

```typescript
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';

export function AnalysisPanel() {
  const { run, result, isRunning, error } = useWeightedAnalysis();

  const handleRun = async () => {
    await run(nodes, edges, {
      thresholdMultiplier: 0.5,
      tieBehavior: 'zero-as-zero',
    });
  };

  return (
    <div>
      <button onClick={handleRun} disabled={isRunning}>
        {isRunning ? 'Analyzing...' : 'Run Analysis'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && (
        <p>Found {result.attractors.length} attractors</p>
      )}
    </div>
  );
}
```

## Matrix Utilities

### Converting Edges to Matrix

```typescript
import { edgesToMatrix, matrixToEdges } from '@/lib/analysis';

const weightMatrix = edgesToMatrix(
  ['A', 'B', 'C'],
  [
    { source: 'A', target: 'B', weight: 2 },
    { source: 'B', target: 'C', weight: 1 },
  ]
);

console.log(weightMatrix.matrix);
// [
//   [0, 0, 0],  // A receives nothing
//   [2, 0, 0],  // B receives 2 from A
//   [0, 1, 0],  // C receives 1 from B
// ]
```

### Converting Matrix Back to Edges

```typescript
const edges = matrixToEdges(weightMatrix);
// [
//   { source: 'A', target: 'B', weight: 2 },
//   { source: 'B', target: 'C', weight: 1 },
// ]
```

## Testing

Run tests with:

```bash
npm run test
```

Tests cover:
- Matrix conversion (edges ↔ matrix).
- Threshold computation.
- Fixed-point and limit-cycle detection.
- Bias handling.
- Tie-breaking behaviors.
- State cap truncation.

## Performance Considerations

- **State space explosion:** A network with N nodes has 2^N possible states. Analysis becomes slow for N > 20.
- **State cap and step cap:** Use these to limit exploration for large networks.
- **Truncation warnings:** Always check `result.truncated` to know if analysis was incomplete.

## Comparison with Rule-Based Analysis

| Feature | Weighted | Rule-Based |
|---------|----------|-----------|
| Input | Weight matrix, biases | Boolean rules (AND/OR/XOR/etc.) |
| Threshold | Computed from in-degree | User-defined per rule |
| Speed | Faster (matrix ops) | Slower (rule parsing) |
| Precision | Continuous weights | Boolean logic |
| Tie-breaking | Configurable | N/A |

## Future Enhancements

- Approximate/approximate analysis for larger networks (Monte Carlo sampling).
- Incremental analysis (compute delta from previous run).
- Visualization helpers for attractor basins.
- Export to other formats (GraphML, Cytoscape.js).
