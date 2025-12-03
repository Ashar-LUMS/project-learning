/*
  Deterministic rule-based network analysis utilities.
  Accepts a set of boolean update rules and enumerates synchronous dynamics
  to detect attractors (fixed points and limit cycles).
*/

export interface AnalysisNode {
  id: string;
  label?: string | null;
}

export interface AnalysisNetwork {
  nodes: AnalysisNode[];
  rules: string[];
}

export interface DeterministicAnalysisOptions {
  /** Maximum number of initial states to explore exhaustively (defaults to 2^17). */
  stateCap?: number;
  /** Hard ceiling for per-path traversal steps (defaults to 2^17). */
  stepCap?: number;
}

import { decodeState, encodeState, formatState } from './stateEncoding';

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

type OperatorSymbol = "NOT" | "AND" | "OR" | "XOR" | "NAND" | "NOR";

type OperatorDef = {
  precedence: number;
  associativity: "left" | "right";
  arity: 1 | 2;
  apply: (operands: number[]) => 0 | 1;
};

const OPERATOR_DEFS: Record<OperatorSymbol, OperatorDef> = {
  NOT: {
    precedence: 3,
    associativity: "right",
    arity: 1,
    apply: ([value]) => (value ? 0 : 1),
  },
  AND: {
    precedence: 2,
    associativity: "left",
    arity: 2,
    apply: ([left, right]) => ((left && right) ? 1 : 0),
  },
  OR: {
    precedence: 1,
    associativity: "left",
    arity: 2,
    apply: ([left, right]) => ((left || right) ? 1 : 0),
  },
  XOR: {
    precedence: 2,
    associativity: "left",
    arity: 2,
    apply: ([left, right]) => ((left ^ right) ? 1 : 0),
  },
  NAND: {
    precedence: 2,
    associativity: "left",
    arity: 2,
    apply: ([left, right]) => ((left && right) ? 0 : 1),
  },
  NOR: {
    precedence: 2,
    associativity: "left",
    arity: 2,
    apply: ([left, right]) => ((left || right) ? 0 : 1),
  },
};

type IdentifierToken = { kind: "identifier"; index: number };
type ConstantToken = { kind: "constant"; value: 0 | 1 };
type OperatorToken = { kind: "operator"; symbol: OperatorSymbol; def: OperatorDef };
type ParenToken = { kind: "paren"; value: "(" | ")" };

type Token = IdentifierToken | ConstantToken | OperatorToken | ParenToken;

const DEFAULT_STATE_CAP = 131072;
const DEFAULT_STEP_CAP = 131072;
const MAX_SUPPORTED_NODES = 20;


const constantToken = (value: 0 | 1): ConstantToken => ({ kind: "constant", value });

const operatorToken = (symbol: OperatorSymbol): OperatorToken => ({
  kind: "operator",
  symbol,
  def: OPERATOR_DEFS[symbol],
});

const isAlphaNumeric = (char: string): boolean => /[A-Za-z0-9_]/.test(char);

const createNodeResolver = (nodes: AnalysisNode[]): Map<string, string> => {
  const resolver = new Map<string, string>();
  for (const node of nodes) {
    const idKey = node.id.trim().toLowerCase();
    if (idKey) resolver.set(idKey, node.id);
    const label = node.label?.trim();
    if (label) resolver.set(label.toLowerCase(), node.id);
  }
  return resolver;
};

const tokenizeExpression = (
  expression: string,
  resolver: Map<string, string>,
  indexLookup: Map<string, number>,
): Token[] => {
  const result: Token[] = [];
  const length = expression.length;
  let position = 0;

  while (position < length) {
    const char = expression[position];

    if (char === " ") {
      position += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      result.push({ kind: "paren", value: char });
      position += 1;
      continue;
    }

    if (char === "!" || char === "¬") {
      result.push(operatorToken("NOT"));
      position += 1;
      continue;
    }

    if ((char === "&" || char === "∧") && position + 1 < length && expression[position + 1] === "&") {
      result.push(operatorToken("AND"));
      position += 2;
      continue;
    }

    if ((char === "|" || char === "∨") && position + 1 < length && expression[position + 1] === "|") {
      result.push(operatorToken("OR"));
      position += 2;
      continue;
    }

    if (isAlphaNumeric(char)) {
      let end = position + 1;
      while (end < length && isAlphaNumeric(expression[end])) end += 1;
      const raw = expression.slice(position, end);
      const upper = raw.toUpperCase();
      position = end;

      if ((upper === "TRUE") || (upper === "T") || (upper === "1")) {
        result.push(constantToken(1));
        continue;
      }

      if ((upper === "FALSE") || (upper === "F") || (upper === "0")) {
        result.push(constantToken(0));
        continue;
      }

      if ((upper in OPERATOR_DEFS) && Object.prototype.hasOwnProperty.call(OPERATOR_DEFS, upper)) {
        result.push(operatorToken(upper as OperatorSymbol));
        continue;
      }

      const resolvedId = resolver.get(raw.toLowerCase());
      if (!resolvedId) {
        throw new Error(`Unknown identifier in rule expression: ${raw}`);
      }
      const index = indexLookup.get(resolvedId);
      if (index === undefined) {
        throw new Error(`Identifier does not correspond to a known node: ${raw}`);
      }
      result.push({ kind: "identifier", index });
      continue;
    }

    if (char === "+") {
      result.push(operatorToken("OR"));
      position += 1;
      continue;
    }

    if (char === "*") {
      result.push(operatorToken("AND"));
      position += 1;
      continue;
    }

    throw new Error(`Unexpected token in rule expression: ${char}`);
  }

  return result;
};

const toRpn = (tokens: Token[]): Token[] => {
  const output: Token[] = [];
  const stack: Token[] = [];

  for (const token of tokens) {
    if (token.kind === "identifier" || token.kind === "constant") {
      output.push(token);
      continue;
    }

    if (token.kind === "operator") {
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.kind !== "operator") break;
        const shouldPop =
          (token.def.associativity === "left" && token.def.precedence <= top.def.precedence) ||
          (token.def.associativity === "right" && token.def.precedence < top.def.precedence);
        if (!shouldPop) break;
        output.push(stack.pop() as OperatorToken);
      }
      stack.push(token);
      continue;
    }

    if (token.kind === "paren" && token.value === "(") {
      stack.push(token);
      continue;
    }

    if (token.kind === "paren" && token.value === ")") {
      let found = false;
      while (stack.length > 0) {
        const top = stack.pop() as Token;
        if (top.kind === "paren" && top.value === "(") {
          found = true;
          break;
        }
        output.push(top);
      }
      if (!found) {
        throw new Error("Mismatched parentheses in rule expression.");
      }
      continue;
    }
  }

  while (stack.length > 0) {
    const top = stack.pop() as Token;
    if (top.kind === "paren") {
      throw new Error("Mismatched parentheses in rule expression.");
    }
    output.push(top);
  }

  return output;
};

const compileRule = (
  expression: string,
  resolver: Map<string, string>,
  indexLookup: Map<string, number>,
): ((state: Uint8Array) => 0 | 1) => {
  const tokens = tokenizeExpression(expression, resolver, indexLookup);
  const rpn = toRpn(tokens);

  if (!rpn.length) {
    return () => 0;
  }

  return (state: Uint8Array) => {
    const stack: number[] = [];
    for (const token of rpn) {
      if (token.kind === "identifier") {
        stack.push(state[token.index]);
        continue;
      }
      if (token.kind === "constant") {
        stack.push(token.value);
        continue;
      }
      if (token.kind === "operator") {
        const { arity, apply } = token.def;
        if (arity === 1) {
          if (stack.length < 1) throw new Error("Malformed expression: insufficient operands for unary operator.");
          const operand = stack.pop() as number;
          stack.push(apply([operand]));
        } else {
          if (stack.length < 2) throw new Error("Malformed expression: insufficient operands for binary operator.");
          const right = stack.pop() as number;
          const left = stack.pop() as number;
          stack.push(apply([left, right]));
        }
        continue;
      }
      throw new Error("Unexpected token kind during evaluation.");
    }
    if (stack.length !== 1) {
      throw new Error("Malformed expression: residual operands after evaluation.");
    }
    return stack[0] ? 1 : 0;
  };
};

// shared helpers imported from stateEncoding.ts

export const performDeterministicAnalysis = (
  network: AnalysisNetwork,
  options?: DeterministicAnalysisOptions,
): DeterministicAnalysisResult => {
  const warnings: string[] = [];

  if (!network) {
    throw new Error("Network payload is required for analysis.");
  }

  const nodes = Array.isArray(network.nodes) ? network.nodes : [];
  const rules = Array.isArray(network.rules) ? network.rules : [];

  if (!nodes.length) {
    return {
      nodeOrder: [],
      nodeLabels: {},
      attractors: [],
      exploredStateCount: 0,
      totalStateSpace: 0,
      truncated: false,
      warnings: ["No nodes supplied; analysis skipped."],
      unresolvedStates: 0,
    };
  }

  if (nodes.length > MAX_SUPPORTED_NODES) {
    throw new Error(`Deterministic analysis currently supports up to ${MAX_SUPPORTED_NODES} nodes.`);
  }

  const nodeOrder = nodes.map((node) => node.id);
  const nodeLabels: Record<string, string> = {};
  for (const node of nodes) {
    const cleanLabel = node.label?.trim();
    nodeLabels[node.id] = cleanLabel && cleanLabel.length ? cleanLabel : node.id;
  }

  const resolver = createNodeResolver(nodes);
  const indexLookup = new Map<string, number>();
  nodeOrder.forEach((id, index) => {
    indexLookup.set(id, index);
  });

  const updateFns: Array<(state: Uint8Array) => 0 | 1> = nodeOrder.map((_, index) => {
    return (state: Uint8Array): 0 | 1 => (state[index] ? 1 : 0);
  });

  // Build update functions per node.
  for (const rawRule of rules) {
    if (!rawRule || typeof rawRule !== "string") continue;
    const [lhsRaw, rhsRaw] = rawRule.split("=");
    if (!lhsRaw || !rhsRaw) {
      warnings.push(`Skipping malformed rule: ${rawRule}`);
      continue;
    }
    const targetKey = lhsRaw.trim().toLowerCase();
    const resolvedId = resolver.get(targetKey);
    if (!resolvedId) {
      warnings.push(`Rule target not found in node list: ${lhsRaw.trim()}`);
      continue;
    }
    const index = indexLookup.get(resolvedId);
    if (index === undefined) {
      warnings.push(`Rule target is not indexable: ${lhsRaw.trim()}`);
      continue;
    }
    try {
      const compiled = compileRule(rhsRaw.trim(), resolver, indexLookup);
      updateFns[index] = compiled;
    } catch (error) {
      warnings.push(`Failed to compile rule for ${lhsRaw.trim()}: ${(error as Error).message}`);
    }
  }

  const totalStateSpace = Math.pow(2, nodeOrder.length);
  const stateCap = options?.stateCap ?? DEFAULT_STATE_CAP;
  const stepCap = options?.stepCap ?? DEFAULT_STEP_CAP;
  const truncated = totalStateSpace > stateCap;
  if (truncated) {
    warnings.push(`State space (${totalStateSpace}) exceeds cap (${stateCap}); analysis covers a subset.`);
  }

  const visitedStates = new Set<number>();
  const stateToAttractor = new Map<number, number>();
  const attractorCycles: number[][] = [];
  const attractorBasins: number[] = [];
  let unresolvedStates = 0;

  const scratchCurrent = new Uint8Array(nodeOrder.length);
  const scratchNext = new Uint8Array(nodeOrder.length);

  const computeNextState = (value: number): number => {
    decodeState(value, scratchCurrent);
    for (let idx = 0; idx < nodeOrder.length; idx += 1) {
      scratchNext[idx] = updateFns[idx](scratchCurrent);
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
        const attractorId = stateToAttractor.get(current) as number;
        for (const state of path) {
          if (!stateToAttractor.has(state)) {
            stateToAttractor.set(state, attractorId);
            attractorBasins[attractorId] += 1;
          }
        }
        resolved = true;
        break;
      }

      if (indexByState.has(current)) {
        const cycleStart = indexByState.get(current) as number;
        const cycleStates = path.slice(cycleStart);
        const attractorId = attractorCycles.length;
        attractorCycles.push(cycleStates);
        attractorBasins.push(cycleStates.length);
        for (const state of cycleStates) {
          stateToAttractor.set(state, attractorId);
        }
        for (let i = 0; i < cycleStart; i += 1) {
          const state = path[i];
          stateToAttractor.set(state, attractorId);
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
        `Traversal step cap reached while analyzing state ${baseState.toString(2).padStart(nodeOrder.length, "0")}.`,
      );
    }
  }

  const exploredStateCount = visitedStates.size;

  const attractors: DeterministicAttractor[] = attractorCycles.map((cycleStates, id) => {
    const period = cycleStates.length;
    const type: AttractorType = period === 1 ? "fixed-point" : "limit-cycle";
    const states = cycleStates.map((state) => formatState(state, nodeOrder, nodeLabels));
    const basinSize = attractorBasins[id] ?? cycleStates.length;
    const basinShare = exploredStateCount > 0 ? basinSize / exploredStateCount : 0;
    return {
      id,
      type,
      period,
      states,
      basinSize,
      basinShare,
    };
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
  };
};
