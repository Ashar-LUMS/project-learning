# Weighted Deterministic Analysis Algorithm

## Overview

The weighted deterministic analysis computes the state-space dynamics of a biological network (or general multi-variable system) where each node updates based on weighted inputs from predecessors.

## Mathematical Foundation

### State Representation

A state is a binary vector $s = (s_1, s_2, \ldots, s_N)$ where $s_i \in \{0, 1\}$ for each node $i$.

Total state space size: $2^N$ (for $N$ nodes).

### Weight Matrix

Given edges with weights, construct an $N \times N$ adjacency matrix $W$ where:
- $W_{ij}$ = weight of edge from node $i$ to node $j$.
- $W_{ij} = 0$ if no edge exists.

**Indexing convention:** Row index = target node, Column index = source node.

Example:
```
Edges: A →[w=2]→ B,  B →[w=1]→ C

Weight matrix (rows = targets, cols = sources):
    A  B  C
A  [0  0  0]
B  [2  0  0]
C  [0  1  0]
```

### Update Rule

For each node $j$, compute the next state $s'_j$ at time $t+1$ from state $s^{(t)}$ at time $t$:

$$\text{input}_j = b_j + \sum_{i=1}^{N} W_{ji} \cdot s_i^{(t)}$$

where:
- $b_j$ = bias term (default 0).
- $W_{ji}$ = weight of edge from node $i$ to node $j$.
- $s_i^{(t)}$ = state of node $i$ at time $t$ (0 or 1).

**Threshold comparison:**
$$\text{threshold}_j = \text{in-degree}_j \times \alpha$$

where:
- $\text{in-degree}_j = \sum_i |W_{ji}|$ (sum of absolute incoming weights).
- $\alpha$ = `thresholdMultiplier` (default 0.5).

**Next state rule:**

$$s'_j = \begin{cases}
1 & \text{if } \text{input}_j > \text{threshold}_j \\
0 & \text{if } \text{input}_j < \text{threshold}_j \\
f_{\text{tie}}(s_j^{(t)}) & \text{if } \text{input}_j = \text{threshold}_j
\end{cases}$$

where $f_{\text{tie}}$ is the tie-breaking function:
- `'zero-as-zero'`: $f_{\text{tie}}(x) = 0$
- `'zero-as-one'`: $f_{\text{tie}}(x) = 1$
- `'hold'`: $f_{\text{tie}}(x) = x$ (preserve current state)

### Attractors

An **attractor** is a set of states that, once entered, cannot be left under the update rule.

**Fixed point:** A single state $s^*$ where $F(s^*) = s^*$ (state doesn't change).

**Limit cycle:** A sequence of $p > 1$ distinct states $s^{(1)}, s^{(2)}, \ldots, s^{(p)}$ such that:
$$F(s^{(i)}) = s^{(i+1)} \quad \text{and} \quad F(s^{(p)}) = s^{(1)}$$

The period $p$ is the cycle length.

### Basin of Attraction

The **basin of attraction** for an attractor is the set of all states that eventually converge to that attractor.

The **basin size** is the number of states in the basin.

The **basin share** is the fraction: $\text{basin size} / 2^N$.

## Algorithm

### State Space Exploration

For each initial state $s$ in $\{0, 1\}^N$ (up to `stateCap`):

1. Start trajectory from $s$.
2. Iteratively apply the update rule: $s \to F(s)$ (up to `stepCap` steps).
3. Track the path: $s \to s' \to s'' \to \cdots$
4. Detect cycle:
   - If we revisit a state, we've found the attractor (either a fixed point or cycle).
   - Mark all states in the path as belonging to that attractor.
5. If a state was already marked (from a previous exploration), assign it to the same attractor.

### Complexity

- **Time:** $O(2^N \times \text{stepCap})$ in the worst case (exponential in $N$).
- **Space:** $O(2^N)$ to store state-to-attractor mapping.

**Practical limit:** $N \leq 20$ (CapacityError ~ 1 million states).

## Comparison: Weighted vs. Rule-Based

| Aspect | Weighted | Rule-Based |
|--------|----------|-----------|
| Input | Continuous weights, biases | Boolean logic rules (AND, OR, XOR, etc.) |
| Threshold | Auto-computed from in-degree | Embedded in rule logic |
| Update | Sum-compare | Evaluate boolean expression |
| Computational cost | Lower (matrix ops) | Higher (rule parsing + evaluation) |
| Biological relevance | High (continuous interactions) | High (discrete regulatory logic) |
| Interpretability | Weights have quantitative meaning | Rules are directly interpretable |

## Example Walkthrough

**Network:**
- Nodes: A, B
- Edge: A →[w=2]→ B
- Bias: none
- Threshold multiplier: 0.5
- Tie behavior: zero-as-zero

**State space:** 4 states: 00, 01, 10, 11 (binary: AA, AB)

**Update function:**

For node A (no inputs):
- input_A = 0 (no incoming edges)
- threshold_A = 0 × 0.5 = 0
- input_A (0) = threshold_A (0) → tie → zero-as-zero → 0

For node B:
- If A = 0: input_B = 0 × 2 = 0, threshold_B = 2 × 0.5 = 1, 0 < 1 → 0
- If A = 1: input_B = 1 × 2 = 2, threshold_B = 1, 2 > 1 → 1

**Trajectory table:**
| State | A | B | → A' | → B' | Next |
|-------|---|---|------|------|------|
| 00    | 0 | 0 | 0    | 0    | 00   | ← Fixed point
| 01    | 0 | 1 | 0    | 0    | 00   |
| 10    | 1 | 0 | 0    | 1    | 01   |
| 11    | 1 | 1 | 0    | 1    | 01   |

**Results:**
- 1 attractor: fixed point at state 00
- Basin sizes: state 00 (size 1), state 01 (size 1)
- Other states converge to the fixed point

## References

- Thomas, R. (1973). "Boolean formalization of genetic control circuits." J Theor Biol.
- Kauffman, S. A. (1969). "Metabolic stability and epigenesis in randomly constructed genetic nets." J Theor Biol.
- Bérenguier, D., Chaouiya, C., Monteiro, P. T., Naldi, A., & Thieffry, D. (2013). "Dynamical modeling and analysis of Boolean regulatory networks." In Handbook of Systems Biology.
