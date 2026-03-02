/**
 * Rule-based deterministic analysis for Boolean networks.
 * 
 * Parses Boolean rules and performs synchronous state-space exploration
 * to find attractors (fixed points and limit cycles).
 * 
 * Rule syntax:
 * - TARGET = EXPRESSION
 * - Operators: && (AND), || (OR), ! (NOT), parentheses
 * - Also supports: AND, OR, XOR, NAND, NOR
 * - Example: Mcm1 = (Clb12 || Clb56) && !Mcm1
 */

import type { DeterministicAnalysisResult, StateSnapshot } from './analysis/types';
import { ANALYSIS_CONFIG } from '@/config/constants';

interface RuleParsed {
  target: string;
  expression: string;
  tokens: Token[];
}

type TokenType = 'IDENTIFIER' | 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'NOT' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize a boolean expression
 * @param expr - The expression to tokenize
 * @param knownLabels - Optional set of known node labels (supports labels with spaces)
 */
function tokenize(expr: string, knownLabels?: Set<string>): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const trimmed = expr.trim();
  
  // Sort known labels by length (longest first) to match greedily
  const sortedLabels = knownLabels 
    ? Array.from(knownLabels).sort((a, b) => b.length - a.length)
    : [];

  while (i < trimmed.length) {
    // Skip whitespace
    if (/\s/.test(trimmed[i])) {
      i++;
      continue;
    }

    // Check for two-character operators first
    const twoChar = trimmed.substring(i, i + 2);
    if (twoChar === '&&') {
      tokens.push({ type: 'AND', value: '&&' });
      i += 2;
      continue;
    }
    if (twoChar === '||') {
      tokens.push({ type: 'OR', value: '||' });
      i += 2;
      continue;
    }

    // Single character operators and parentheses
    if (trimmed[i] === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (trimmed[i] === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }
    if (trimmed[i] === '!') {
      tokens.push({ type: 'NOT', value: '!' });
      i++;
      continue;
    }
    
    // Try to match known labels (for labels with spaces)
    let matchedLabel = false;
    for (const label of sortedLabels) {
      // Check if label matches at current position (case-insensitive for operators check)
      const slice = trimmed.substring(i, i + label.length);
      if (slice === label) {
        // Make sure it's not a partial match (next char should be operator/paren/end)
        const nextChar = trimmed[i + label.length];
        if (!nextChar || !/[a-zA-Z0-9_]/.test(nextChar)) {
          tokens.push({ type: 'IDENTIFIER', value: label });
          i += label.length;
          matchedLabel = true;
          break;
        }
      }
    }
    if (matchedLabel) continue;

    // Multi-character operators and identifiers
    let word = '';
    while (i < trimmed.length && /[a-zA-Z0-9_]/.test(trimmed[i])) {
      word += trimmed[i];
      i++;
    }

    if (word) {
      const upper = word.toUpperCase();
      if (upper === 'AND') tokens.push({ type: 'AND', value: upper });
      else if (upper === 'OR') tokens.push({ type: 'OR', value: upper });
      else if (upper === 'XOR') tokens.push({ type: 'XOR', value: upper });
      else if (upper === 'NAND') tokens.push({ type: 'NAND', value: upper });
      else if (upper === 'NOR') tokens.push({ type: 'NOR', value: upper });
      else tokens.push({ type: 'IDENTIFIER', value: word });
      continue;
    }

    // Unknown character
    throw new Error(`Unexpected character '${trimmed[i]}' at position ${i}`);
  }

  return tokens;
}

/**
 * Parse a single rule: TARGET = EXPRESSION
 * Supports labels with spaces (e.g., "Node 1 = Node 2 AND Node 3")
 * @param rule - The rule string to parse
 * @param knownLabels - Optional set of known node labels for parsing expressions with spaces
 */
function parseRule(rule: string, knownLabels?: Set<string>): RuleParsed {
  const eqIndex = rule.indexOf('=');
  if (eqIndex <= 0) {
    throw new Error(`Invalid rule syntax: "${rule}". Expected format: TARGET = EXPRESSION`);
  }

  const target = rule.substring(0, eqIndex).trim();
  const expression = rule.substring(eqIndex + 1).trim();
  
  if (!target || !expression) {
    throw new Error(`Invalid rule syntax: "${rule}". Expected format: TARGET = EXPRESSION`);
  }
  
  const tokens = tokenize(expression, knownLabels);

  return { target, expression, tokens };
}

/**
 * Evaluate a boolean expression using shunting-yard algorithm
 */
function evaluateExpression(tokens: Token[], state: Record<string, 0 | 1>): 0 | 1 {
  if (tokens.length === 0) return 0;

  const outputQueue: (0 | 1)[] = [];
  const operatorStack: Token[] = [];

  const precedence: Record<TokenType, number> = {
    'NOT': 4,
    'AND': 3,
    'NAND': 3,
    'OR': 2,
    'NOR': 2,
    'XOR': 2,
    'LPAREN': 0,
    'RPAREN': 0,
    'IDENTIFIER': 0,
  };

  const applyOperator = (op: Token) => {
    if (op.type === 'NOT') {
      const a = outputQueue.pop();
      if (a === undefined) throw new Error('NOT operator requires one operand');
      outputQueue.push(a === 1 ? 0 : 1);
    } else {
      const b = outputQueue.pop();
      const a = outputQueue.pop();
      if (a === undefined || b === undefined) {
        throw new Error(`Binary operator ${op.type} requires two operands`);
      }
      
      let result: 0 | 1;
      switch (op.type) {
        case 'AND': result = (a === 1 && b === 1) ? 1 : 0; break;
        case 'OR': result = (a === 1 || b === 1) ? 1 : 0; break;
        case 'XOR': result = (a !== b) ? 1 : 0; break;
        case 'NAND': result = (a === 1 && b === 1) ? 0 : 1; break;
        case 'NOR': result = (a === 1 || b === 1) ? 0 : 1; break;
        default: throw new Error(`Unknown operator: ${op.type}`);
      }
      outputQueue.push(result);
    }
  };

  for (const token of tokens) {
    if (token.type === 'IDENTIFIER') {
      const value = state[token.value];
      if (value === undefined) {
        throw new Error(`Identifier "${token.value}" not found in state. Available: ${Object.keys(state).join(', ')}`);
      }
      outputQueue.push(value);
    } else if (token.type === 'LPAREN') {
      operatorStack.push(token);
    } else if (token.type === 'RPAREN') {
      while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type !== 'LPAREN') {
        applyOperator(operatorStack.pop()!);
      }
      if (operatorStack.length === 0) {
        throw new Error('Mismatched parentheses');
      }
      operatorStack.pop(); // Remove LPAREN
    } else {
      // Operator
      while (
        operatorStack.length > 0 &&
        precedence[operatorStack[operatorStack.length - 1].type] >= precedence[token.type]
      ) {
        applyOperator(operatorStack.pop()!);
      }
      operatorStack.push(token);
    }
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop()!;
    if (op.type === 'LPAREN' || op.type === 'RPAREN') {
      throw new Error('Mismatched parentheses');
    }
    applyOperator(op);
  }

  if (outputQueue.length !== 1) {
    throw new Error('Invalid expression: too many operands');
  }

  return outputQueue[0];
}

/**
 * Perform rule-based deterministic analysis
 */
export function performDeterministicAnalysis(
  rules: string[],
  options: {
    stateCap?: number;
    stepCap?: number;
  } = {}
): DeterministicAnalysisResult {
  const stateCap = options.stateCap ?? ANALYSIS_CONFIG.DEFAULT_STATE_CAP;
  const stepCap = options.stepCap ?? ANALYSIS_CONFIG.DEFAULT_STEP_CAP;

  const warnings: string[] = [];
  
  // First pass: collect all targets (left-hand sides of rules) as known labels
  // This allows us to parse expressions that contain labels with spaces
  const knownLabels = new Set<string>();
  const validRuleStrings: string[] = [];
  
  for (const rule of rules) {
    const trimmed = rule.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const target = trimmed.substring(0, eqIndex).trim();
      if (target) {
        knownLabels.add(target);
        validRuleStrings.push(trimmed);
      }
    }
  }

  // Second pass: parse rules with known labels for tokenizing expressions
  const parsedRules: RuleParsed[] = [];
  
  for (const rule of validRuleStrings) {
    try {
      parsedRules.push(parseRule(rule, knownLabels));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      warnings.push(`Rule parse error: ${message}`);
    }
  }

  if (parsedRules.length === 0) {
    throw new Error('No valid rules found. Please provide at least one rule in the format: TARGET = EXPRESSION');
  }

  // Extract all unique node identifiers (targets + any identifiers from expressions)
  const nodeIds = new Set<string>(knownLabels);
  for (const rule of parsedRules) {
    for (const token of rule.tokens) {
      if (token.type === 'IDENTIFIER') {
        nodeIds.add(token.value);
      }
    }
  }

  const nodeOrder = Array.from(nodeIds).sort();
  const nodeLabels = Object.fromEntries(nodeOrder.map(id => [id, id]));

  // Check node count
  if (nodeOrder.length > 20) {
    warnings.push(`Network has ${nodeOrder.length} nodes. Analysis may be slow for networks with > 20 nodes.`);
  }

  const totalStateSpace = 2 ** nodeOrder.length;
  const maxStates = Math.min(stateCap, totalStateSpace);
  const truncated = maxStates < totalStateSpace;

  if (truncated) {
    warnings.push(`State space truncated: exploring first ${maxStates.toLocaleString()} of ${totalStateSpace.toLocaleString()} possible states.`);
  }

  // Generate state indices to explore (sequential enumeration up to cap)
  const stateIndices: number[] = Array.from({ length: maxStates }, (_, i) => i);

  // Build rule map
  const ruleMap = new Map<string, RuleParsed>();
  for (const rule of parsedRules) {
    ruleMap.set(rule.target, rule);
  }

  // Helper: encode state to binary string
  const encodeState = (state: Record<string, 0 | 1>): string => {
    return nodeOrder.map(id => state[id] ?? 0).join('');
  };

  // Helper: decode binary string to state
  const decodeState = (binary: string): Record<string, 0 | 1> => {
    const state: Record<string, 0 | 1> = {};
    for (let i = 0; i < nodeOrder.length; i++) {
      state[nodeOrder[i]] = (binary[i] === '1' ? 1 : 0) as 0 | 1;
    }
    return state;
  };

  // Helper: compute next state
  const computeNextState = (current: Record<string, 0 | 1>): Record<string, 0 | 1> => {
    const next: Record<string, 0 | 1> = { ...current };
    
    for (const nodeId of nodeOrder) {
      const rule = ruleMap.get(nodeId);
      if (rule) {
        try {
          next[nodeId] = evaluateExpression(rule.tokens, current);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          throw new Error(`Error evaluating rule for ${nodeId}: ${message}`);
        }
      }
      // If no rule, node retains its value
    }
    
    return next;
  };

  // State space exploration
  const stateToAttractorId = new Map<string, number>();
  const attractorData: Array<{
    id: number;
    states: StateSnapshot[];
    basin: Set<string>;
  }> = [];
  let nextAttractorId = 0;

  let exploredCount = 0;

  for (const stateNum of stateIndices) {
    const binary = stateNum.toString(2).padStart(nodeOrder.length, '0');
    
    if (stateToAttractorId.has(binary)) continue;

    // Follow trajectory
    const path: string[] = [binary];
    const visited = new Set<string>([binary]);
    let current = decodeState(binary);

    for (let step = 0; step < stepCap; step++) {
      const next = computeNextState(current);
      const nextBinary = encodeState(next);

      if (stateToAttractorId.has(nextBinary)) {
        // Reached known attractor
        const attractorId = stateToAttractorId.get(nextBinary)!;
        for (const s of path) {
          stateToAttractorId.set(s, attractorId);
          attractorData[attractorId].basin.add(s);
        }
        break;
      }

      if (visited.has(nextBinary)) {
        // Found new attractor (cycle or fixed point)
        const cycleStartIndex = path.indexOf(nextBinary);
        const attractorStates = path.slice(cycleStartIndex);
        
        const attractor = {
          id: nextAttractorId,
          states: attractorStates.map(bin => ({
            binary: bin,
            values: decodeState(bin),
          })),
          basin: new Set<string>(path),
        };
        attractorData.push(attractor);

        for (const s of path) {
          stateToAttractorId.set(s, nextAttractorId);
        }

        nextAttractorId++;
        break;
      }

      path.push(nextBinary);
      visited.add(nextBinary);
      current = next;
    }

    exploredCount++;
  }

  // Format results
  const attractors = attractorData.map(att => ({
    id: att.id,
    type: (att.states.length === 1 ? 'fixed-point' : 'limit-cycle') as 'fixed-point' | 'limit-cycle',
    period: att.states.length,
    states: att.states,
    basinSize: att.basin.size,
    basinShare: att.basin.size / totalStateSpace,
  }));

  return {
    nodeOrder,
    nodeLabels,
    attractors,
    exploredStateCount: exploredCount,
    totalStateSpace,
    truncated,
    warnings,
    unresolvedStates: Math.max(0, maxStates - stateToAttractorId.size),
  };
}
