/**
 * Network Import/Export Utilities
 * 
 * Supported formats:
 * - CSV: Weight-based networks (custom format)
 * - TXT: Rule-based networks (Boolean expressions)
 * - SIF: Simple Interaction Format (Cytoscape standard)
 * - SBML-qual: Systems Biology Markup Language - Qualitative Models
 */

import type { NetworkNode, NetworkEdge, Rule, NetworkData } from '@/types/network';

// ============================================================================
// TYPES
// ============================================================================

export interface WeightedNetworkCSV {
  nodes: Array<{ id: string; basalValue: number }>;
  edges: Array<{ source: string; weight: number; target: string }>;
}

export interface ParsedRuleBasedNetwork {
  rules: string[];
  nodes: Set<string>;
  edges: Array<{ source: string; target: string; weight?: number }>;
}

/** SIF interaction types mapped to weights */
export type SIFInteractionType = 
  | 'activates' | 'activation' | 'stimulates' | 'induces' | 'promotes' | 'upregulates' | 'positive'
  | 'inhibits' | 'inhibition' | 'represses' | 'suppresses' | 'downregulates' | 'negative'
  | 'interacts' | 'binds' | 'associates' | 'unknown';

// ============================================================================
// SIF (Simple Interaction Format) EXPORT
// ============================================================================

/**
 * Export a network to SIF format.
 * Format: SOURCE\tINTERACTION_TYPE\tTARGET
 * 
 * Standard Cytoscape format used by many biological databases.
 * Interaction types are inferred from edge weights:
 * - Positive weight -> "activates"
 * - Negative weight -> "inhibits"
 * - Zero/undefined -> "interacts"
 */
export function exportNetworkToSIF(data: NetworkData): string {
  const lines: string[] = [];
  const edges = data.edges || [];
  
  for (const edge of edges) {
    const weight = edge.weight ?? 1;
    let interactionType: string;
    
    if (weight > 0) {
      interactionType = 'activates';
    } else if (weight < 0) {
      interactionType = 'inhibits';
    } else {
      interactionType = 'interacts';
    }
    
    lines.push(`${edge.source}\t${interactionType}\t${edge.target}`);
  }
  
  // Add isolated nodes (nodes with no edges)
  const nodesInEdges = new Set<string>();
  edges.forEach(e => {
    nodesInEdges.add(e.source);
    nodesInEdges.add(e.target);
  });
  
  const nodes = data.nodes || [];
  for (const node of nodes) {
    if (!nodesInEdges.has(node.id)) {
      // Isolated node - just add node ID on its own line
      lines.push(node.id);
    }
  }
  
  return lines.join('\n');
}

// ============================================================================
// SIF (Simple Interaction Format) IMPORT
// ============================================================================

/**
 * Parse a network from SIF format.
 * Format: SOURCE\tINTERACTION_TYPE\tTARGET (tab or space separated)
 * 
 * Interaction types are converted to edge weights:
 * - activates/stimulates/etc -> weight = 1
 * - inhibits/represses/etc -> weight = -1
 * - other -> weight = 1 (default positive)
 */
export function parseSIFNetwork(sifContent: string): NetworkData {
  const lines = sifContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const nodeSet = new Set<string>();
  const edges: NetworkEdge[] = [];
  
  const positiveInteractions = new Set([
    'activates', 'activation', 'stimulates', 'induces', 'promotes', 
    'upregulates', 'positive', 'pp', 'pd', 'controls-expression-of',
    'controls-state-change-of', 'controls-phosphorylation-of'
  ]);
  
  const negativeInteractions = new Set([
    'inhibits', 'inhibition', 'represses', 'suppresses', 
    'downregulates', 'negative', 'blocks'
  ]);
  
  for (const line of lines) {
    // Skip comments
    if (line.startsWith('#') || line.startsWith('//')) continue;
    
    // Split by tab or multiple spaces
    const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(Boolean);
    
    // If only one space, try splitting by single space
    if (parts.length === 1) {
      const spaceParts = line.split(/\s+/).map(p => p.trim()).filter(Boolean);
      if (spaceParts.length >= 3) {
        parts.length = 0;
        parts.push(...spaceParts);
      }
    }
    
    if (parts.length === 1) {
      // Isolated node
      nodeSet.add(parts[0]);
    } else if (parts.length >= 3) {
      // SOURCE INTERACTION TARGET [TARGET2 TARGET3 ...]
      const source = parts[0];
      const interaction = parts[1].toLowerCase();
      
      nodeSet.add(source);
      
      // SIF allows multiple targets: A activates B C D
      for (let i = 2; i < parts.length; i++) {
        const target = parts[i];
        nodeSet.add(target);
        
        let weight = 1;
        if (negativeInteractions.has(interaction)) {
          weight = -1;
        } else if (!positiveInteractions.has(interaction)) {
          // Unknown interaction type, default to positive
          weight = 1;
        }
        
        edges.push({
          source,
          target,
          weight,
          interaction: parts[1] // Preserve original interaction type
        });
      }
    } else if (parts.length === 2) {
      // SOURCE TARGET (no interaction type, assume positive)
      const [source, target] = parts;
      nodeSet.add(source);
      nodeSet.add(target);
      edges.push({ source, target, weight: 1 });
    }
  }
  
  // Build node array with grid positions
  const nodeArray = Array.from(nodeSet);
  const nodes: NetworkNode[] = nodeArray.map((id, i) => ({
    id,
    label: id,
    properties: {
      position: {
        x: 100 + (i % 6) * 150,
        y: 100 + Math.floor(i / 6) * 150
      }
    }
  }));
  
  return {
    nodes,
    edges,
    metadata: {
      type: 'Weight Based',
      importFormat: 'SIF',
      importedAt: new Date().toISOString()
    }
  };
}

// ============================================================================
// SBML-qual EXPORT
// ============================================================================

/**
 * Export a network to SBML-qual format.
 * SBML-qual is the standard for qualitative/Boolean models in systems biology.
 * 
 * This is a simplified SBML-qual that captures:
 * - Qualitative species (nodes) with max level 1 (Boolean)
 * - Transitions (regulatory relationships)
 * - Function terms based on edge signs
 */
export function exportNetworkToSBMLqual(data: NetworkData, modelId: string = 'model1'): string {
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  // Note: rules from data.rules could be used for more precise function terms in future
  
  // Build edge map: target -> list of {source, sign}
  const regulators = new Map<string, Array<{source: string; sign: 'positive' | 'negative' | 'unknown'}>>();
  
  for (const edge of edges) {
    if (!regulators.has(edge.target)) {
      regulators.set(edge.target, []);
    }
    const sign = (edge.weight ?? 1) >= 0 ? 'positive' : 'negative';
    regulators.get(edge.target)!.push({ source: edge.source, sign });
  }
  
  // XML header
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sbml xmlns="http://www.sbml.org/sbml/level3/version1/core"
      xmlns:qual="http://www.sbml.org/sbml/level3/version1/qual/version1"
      level="3" version="1" qual:required="true">
  <model id="${escapeXml(modelId)}">
    <qual:listOfQualitativeSpecies>
`;
  
  // Add qualitative species (nodes)
  for (const node of nodes) {
    const compartment = node.properties?.compartment || 'default';
    const initialLevel = node.properties?.initialValue ?? 0;
    xml += `      <qual:qualitativeSpecies qual:id="${escapeXml(node.id)}" qual:compartment="${escapeXml(compartment)}" qual:constant="false" qual:maxLevel="1" qual:initialLevel="${initialLevel}"/>\n`;
  }
  
  xml += `    </qual:listOfQualitativeSpecies>
    <qual:listOfTransitions>
`;
  
  // Add transitions (one per regulated node)
  for (const node of nodes) {
    const nodeRegs = regulators.get(node.id) || [];
    const transitionId = `tr_${node.id}`;
    
    xml += `      <qual:transition qual:id="${escapeXml(transitionId)}">\n`;
    
    // Inputs (regulators)
    if (nodeRegs.length > 0) {
      xml += `        <qual:listOfInputs>\n`;
      for (let i = 0; i < nodeRegs.length; i++) {
        const reg = nodeRegs[i];
        xml += `          <qual:input qual:id="in_${escapeXml(node.id)}_${i}" qual:qualitativeSpecies="${escapeXml(reg.source)}" qual:sign="${reg.sign}" qual:transitionEffect="none"/>\n`;
      }
      xml += `        </qual:listOfInputs>\n`;
    }
    
    // Output (the regulated node)
    xml += `        <qual:listOfOutputs>
          <qual:output qual:id="out_${escapeXml(node.id)}" qual:qualitativeSpecies="${escapeXml(node.id)}" qual:transitionEffect="assignmentLevel"/>
        </qual:listOfOutputs>\n`;
    
    // Function terms (simplified: if any positive regulator is ON and no negative is ON -> 1)
    xml += `        <qual:listOfFunctionTerms>
          <qual:defaultTerm qual:resultLevel="0"/>
          <qual:functionTerm qual:resultLevel="1">
            <math xmlns="http://www.w3.org/1998/Math/MathML">
              <apply>
                <and/>
`;
    
    if (nodeRegs.length === 0) {
      // Self-sustaining or externally controlled
      xml += `                <cn type="integer">0</cn>\n`;
    } else {
      // For each positive regulator: require it to be 1
      // For each negative regulator: require it to be 0
      for (const reg of nodeRegs) {
        if (reg.sign === 'positive') {
          xml += `                <apply><eq/><ci>${escapeXml(reg.source)}</ci><cn type="integer">1</cn></apply>\n`;
        } else {
          xml += `                <apply><eq/><ci>${escapeXml(reg.source)}</ci><cn type="integer">0</cn></apply>\n`;
        }
      }
    }
    
    xml += `              </apply>
            </math>
          </qual:functionTerm>
        </qual:listOfFunctionTerms>
      </qual:transition>\n`;
  }
  
  xml += `    </qual:listOfTransitions>
  </model>
</sbml>`;
  
  return xml;
}

/** Escape special XML characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// SBML-qual IMPORT
// ============================================================================

/**
 * Parse a network from SBML-qual format.
 * Extracts qualitative species as nodes and transitions as edges.
 */
export function parseSBMLqualNetwork(xmlContent: string): NetworkData {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const rules: Rule[] = [];
  
  // Parse qualitative species
  const speciesRegex = /<qual:qualitativeSpecies[^>]*qual:id="([^"]+)"[^>]*>/g;
  const initialLevelRegex = /qual:initialLevel="(\d+)"/;
  const maxLevelRegex = /qual:maxLevel="(\d+)"/;
  
  let match;
  let nodeIndex = 0;
  while ((match = speciesRegex.exec(xmlContent)) !== null) {
    const fullMatch = match[0];
    const nodeId = match[1];
    
    const initialMatch = fullMatch.match(initialLevelRegex);
    const maxMatch = fullMatch.match(maxLevelRegex);
    
    const initialLevel = initialMatch ? parseInt(initialMatch[1]) : 0;
    const maxLevel = maxMatch ? parseInt(maxMatch[1]) : 1;
    
    nodes.push({
      id: nodeId,
      label: nodeId,
      properties: {
        initialValue: initialLevel,
        maxLevel: maxLevel,
        position: {
          x: 100 + (nodeIndex % 6) * 150,
          y: 100 + Math.floor(nodeIndex / 6) * 150
        }
      }
    });
    nodeIndex++;
  }
  
  // Parse transitions to extract edges
  const transitionRegex = /<qual:transition[^>]*>([\s\S]*?)<\/qual:transition>/g;
  const inputRegex = /<qual:input[^>]*qual:qualitativeSpecies="([^"]+)"[^>]*qual:sign="([^"]+)"[^>]*>/g;
  const outputRegex = /<qual:output[^>]*qual:qualitativeSpecies="([^"]+)"[^>]*/g;
  
  while ((match = transitionRegex.exec(xmlContent)) !== null) {
    const transitionContent = match[1];
    
    // Find output (target node)
    const outputMatch = outputRegex.exec(transitionContent);
    outputRegex.lastIndex = 0; // Reset for next transition
    
    if (!outputMatch) continue;
    const targetNode = outputMatch[1];
    
    // Find all inputs (source nodes)
    let inputMatch;
    const sources: Array<{id: string; sign: string}> = [];
    while ((inputMatch = inputRegex.exec(transitionContent)) !== null) {
      sources.push({ id: inputMatch[1], sign: inputMatch[2] });
    }
    inputRegex.lastIndex = 0; // Reset for next transition
    
    // Create edges
    for (const source of sources) {
      const weight = source.sign === 'negative' ? -1 : 1;
      edges.push({
        source: source.id,
        target: targetNode,
        weight,
        interaction: source.sign === 'negative' ? 'inhibits' : 'activates'
      });
    }
    
    // Try to build a rule from the transition
    if (sources.length > 0) {
      const positives = sources.filter(s => s.sign === 'positive').map(s => s.id);
      const negatives = sources.filter(s => s.sign === 'negative').map(s => `!${s.id}`);
      
      const parts = [...positives, ...negatives];
      if (parts.length > 0) {
        const expression = parts.join(' && ');
        rules.push({
          name: `${targetNode} = ${expression}`,
          enabled: true
        });
      }
    }
  }
  
  return {
    nodes,
    edges,
    rules: rules.length > 0 ? rules : undefined,
    metadata: {
      type: rules.length > 0 ? 'Rule Based' : 'Weight Based',
      importFormat: 'SBML-qual',
      importedAt: new Date().toISOString()
    }
  };
}

// ============================================================================
// WEIGHT-BASED NETWORK EXPORT (CSV)
// ============================================================================

/**
 * Export a weight-based network to CSV format.
 * Format:
 * Section 1: node_name, basal_value (nodes with basal values)
 * Section 2: source_name, weight, target_name (edges with weights)
 * Section 3: node_name, value, x, y, color, model (node positions)
 * Section 4: network type
 * Sections separated by ",,"
 */
export function exportWeightedNetworkToCSV(data: NetworkData): string {
  const lines: string[] = [];
  
  // Build node id -> label map for exporting with names instead of IDs
  const nodes = data.nodes || [];
  const nodeLabels = new Map<string, string>();
  for (const node of nodes) {
    const id = String(node.id);
    const label = String(node.label || node.id);
    nodeLabels.set(id, label);
  }
  
  // Section 1: Nodes with bias values (use label)
  for (const node of nodes) {
    const bias = node.properties?.bias ?? 0;
    const label = nodeLabels.get(String(node.id)) || String(node.id);
    lines.push(`${label},${bias}`);
  }
  
  // Empty separator
  lines.push(',,');
  
  // Section 2: Edges (source_label, weight/intensity, target_label)
  const edges = data.edges || [];
  for (const edge of edges) {
    const weight = edge.weight ?? 1;
    const sourceLabel = nodeLabels.get(String(edge.source)) || String(edge.source);
    const targetLabel = nodeLabels.get(String(edge.target)) || String(edge.target);
    lines.push(`${sourceLabel},${weight},${targetLabel}`);
  }
  
  // Empty separator
  lines.push(',,');
  
  // Section 3: Node positions (node_label, value, x, y, color, model)
  for (const node of nodes) {
    const bias = node.properties?.bias ?? 0;
    const label = nodeLabels.get(String(node.id)) || String(node.id);
    // Position can be stored as node.position or node.properties.position
    const pos = (node as any).position || node.properties?.position || { x: 0, y: 0 };
    const x = pos.x ?? 0;
    const y = pos.y ?? 0;
    const color = node.properties?.color ?? 'white';
    const model = node.properties?.model ?? 'devs.SimpleMoleculeModel';
    lines.push(`${label},${bias},${x},${y},${color},${model}`);
  }
  
  // Empty separator
  lines.push(',,');
  
  // Section 4: Network type (normalize casing for consistency)
  let networkType = data.metadata?.type || 'Weight Based';
  // Normalize legacy lowercase to consistent casing
  if (networkType.toLowerCase() === 'weight based') {
    networkType = 'Weight Based';
  } else if (networkType.toLowerCase() === 'rule based') {
    networkType = 'Rule Based';
  }
  lines.push(networkType);
  
  return lines.join('\n');
}

// ============================================================================
// RULE-BASED NETWORK EXPORT (TXT)
// ============================================================================

/**
 * Export a rule-based network to TXT format.
 * Format: nodename=(boolean expression)
 * One rule per line.
 */
export function exportRuleBasedNetworkToTXT(data: NetworkData): string {
  const rules = data.rules || [];
  const lines: string[] = [];
  
  for (const rule of rules) {
    if (typeof rule === 'string') {
      // Already in correct format
      lines.push(rule);
    } else if (rule.name) {
      // Rule object - extract the rule expression
      // If name contains '=' it's already a full rule expression
      if (rule.name.includes('=')) {
        lines.push(rule.name);
      } else {
        // Build rule from name and other properties if available
        const expr = rule.condition || rule.action || '';
        if (expr) {
          lines.push(`${rule.name}=${expr}`);
        } else {
          lines.push(rule.name);
        }
      }
    }
  }
  
  return lines.join('\n');
}

// ============================================================================
// WEIGHT-BASED NETWORK IMPORT (CSV)
// ============================================================================

/**
 * Parse a weight-based network from CSV format.
 * Supports both V2 and V1 formats:
 * 
 * V2 Format:
 *   Section 1: node_id, basal_value
 *   Section 2: source, weight, target
 * 
 * V1 Format:
 *   Section 1: node_id, basal_value
 *   Section 2: source, weight, target
 *   Section 3: node_id, bias, x, y, color, model (positions)
 *   Final line: "Weight Based" or "Weight based" marker
 */
export function parseWeightedNetworkCSV(csvContent: string): NetworkData {
  const lines = csvContent.split(/\r?\n/).map(l => l.trim());
  
  // Check for V1 format marker at the end
  const lastNonEmptyLine = [...lines].reverse().find(l => l && !l.match(/^,+$/));
  const isV1Format = lastNonEmptyLine?.toLowerCase() === 'weight based';
  
  // Find section boundaries (empty lines with commas or truly empty)
  const sectionBreaks: number[] = [];
  lines.forEach((line, idx) => {
    if (line === '' || line === ',,' || line.match(/^,+$/)) {
      sectionBreaks.push(idx);
    }
  });
  
  // Determine sections based on breaks
  const section1End = sectionBreaks[0] ?? lines.length;
  const section2Start = section1End + 1;
  const section2End = sectionBreaks[1] ?? lines.length;
  
  // Section 1: Nodes (id, bias)
  const nodeLines = lines.slice(0, section1End).filter(l => l && !l.match(/^,+$/));
  const nodes: NetworkNode[] = [];
  const nodeMap = new Map<string, NetworkNode>();
  
  for (const line of nodeLines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 2 && parts[0]) {
      const id = parts[0];
      const bias = parseFloat(parts[1]) || 0;
      const node: NetworkNode = {
        id,
        label: id,
        properties: { bias }
      };
      nodes.push(node);
      nodeMap.set(id, node);
    }
  }
  
  // Section 2: Edges (source, weight/intensity, target)
  const edgeLines = lines.slice(section2Start, section2End).filter(l => l && !l.match(/^,+$/));
  const edges: NetworkEdge[] = [];
  
  for (const line of edgeLines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 3 && parts[0] && parts[2]) {
      edges.push({
        source: parts[0],
        target: parts[2],
        weight: parseFloat(parts[1]) || 1
      });
    }
  }
  
  // V1 Format: Section 3 contains position data (node_id, bias, x, y, color, model)
  if (isV1Format && sectionBreaks.length >= 2) {
    const section3Start = sectionBreaks[1] + 1;
    const section3End = sectionBreaks[2] ?? lines.length;
    const positionLines = lines.slice(section3Start, section3End).filter(l => l && !l.match(/^,+$/) && l.toLowerCase() !== 'weight based');
    
    for (const line of positionLines) {
      const parts = line.split(',').map(p => p.trim());
      // V1 format: node_id, bias, x, y, color, model
      if (parts.length >= 4 && parts[0]) {
        const id = parts[0];
        const bias = parseFloat(parts[1]) || 0;
        const x = parseFloat(parts[2]) || 0;
        const y = parseFloat(parts[3]) || 0;
        const color = parts[4] || undefined;
        
        const existingNode = nodeMap.get(id);
        if (existingNode) {
          // Update existing node with position data
          existingNode.properties = {
            ...existingNode.properties,
            bias,
            position: { x, y },
            color
          };
        } else {
          // Create new node from position section (backup for nodes not in section 1)
          const node: NetworkNode = {
            id,
            label: id,
            properties: {
              bias,
              position: { x, y },
              color
            }
          };
          nodes.push(node);
          nodeMap.set(id, node);
        }
      }
    }
  }
  
  return {
    nodes,
    edges,
    metadata: {
      type: 'Weight Based',
      importedAt: new Date().toISOString(),
      importFormat: isV1Format ? 'V1 CSV' : 'V2 CSV'
    }
  };
}

/**
 * Parse a rule-based network from CSV format.
 * Rules are read from the first section only (up to the first empty row).
 * Each row may contain either:
 * - A full rule in a cell: TARGET = EXPRESSION
 * - Target in the first column and expression in the remaining columns
 * Lines below the first empty row are ignored.
 */
export function parseRuleBasedNetworkCSV(csvContent: string): NetworkData {
  const rawLines = csvContent.split(/\r?\n/);
  const rules: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed === ',,' || /^,+$/.test(trimmed)) {
      break;
    }

    const cells = rawLine.split(',').map(cell => cell.trim());
    const nonEmptyCells = cells.filter(cell => cell.length > 0);
    if (nonEmptyCells.length === 0) continue;

    const hasEquals = nonEmptyCells.some(cell => cell.includes('='));
    const looksLikeHeader = nonEmptyCells.every(cell => /^(rule|rules|target|node|source|expression|logic|boolean|formula)$/i.test(cell));
    if (looksLikeHeader && !hasEquals) continue;

    let ruleText: string | null = null;

    if (hasEquals) {
      const cellWithEquals = nonEmptyCells.find(cell => cell.includes('='));
      if (cellWithEquals) {
        ruleText = cellWithEquals;
      }
      if (ruleText && !/^[a-zA-Z0-9_]+\s*=/.test(ruleText) && nonEmptyCells.length >= 2) {
        const target = nonEmptyCells[0];
        const expr = nonEmptyCells.slice(1).join(',');
        if (target && expr) ruleText = `${target}=${expr}`;
      }
    } else if (nonEmptyCells.length >= 2) {
      const target = nonEmptyCells[0];
      const expr = nonEmptyCells.slice(1).join(',');
      if (target && expr) ruleText = `${target}=${expr}`;
    }

    if (ruleText) {
      rules.push(ruleText.trim());
    }
  }

  if (rules.length === 0) {
    return {
      nodes: [],
      edges: [],
      rules: [],
      metadata: {
        type: 'Rule Based',
        createdFrom: 'rules',
        importedAt: new Date().toISOString(),
        importFormat: 'CSV'
      }
    };
  }

  const parsed = parseRuleBasedNetworkTXT(rules.join('\n'));
  return {
    ...parsed,
    metadata: {
      ...(parsed.metadata || {}),
      type: 'Rule Based',
      createdFrom: 'rules',
      importedAt: new Date().toISOString(),
      importFormat: 'CSV'
    }
  };
}

function looksLikeRuleBasedCSV(csvContent: string): boolean {
  const rawLines = csvContent.split(/\r?\n/);
  const sampleLines: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed === ',,' || /^,+$/.test(trimmed)) {
      break;
    }
    if (trimmed.length > 0) sampleLines.push(rawLine);
    if (sampleLines.length >= 20) break;
  }

  if (sampleLines.length === 0) return false;

  return sampleLines.some(line => {
    const cells = line.split(',').map(cell => cell.trim()).filter(Boolean);
    return cells.some(cell => cell.includes('='));
  });
}

// ============================================================================
// RULE-BASED NETWORK IMPORT (TXT)
// ============================================================================

/**
 * Parse a rule-based network from TXT format.
 * Expects one rule per line: nodename=(boolean expression)
 */
export function parseRuleBasedNetworkTXT(txtContent: string): NetworkData {
  const lines = txtContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const nodeSet = new Set<string>();
  const edgeMap = new Map<string, Set<string>>(); // target -> sources
  const rules: Rule[] = [];
  
  // Reserved words that should not be treated as node identifiers
  const reservedWords = new Set([
    'AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT',
    'and', 'or', 'xor', 'nand', 'nor', 'not',
    'undefined', 'UNDEFINED', 'null', 'NULL', 'true', 'TRUE', 'false', 'FALSE'
  ]);
  
  for (const line of lines) {
    // Match: nodename=(expression) or nodename = (expression)
    const match = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (match) {
      const target = match[1].toLowerCase();
      const expression = match[2].trim();
      
      nodeSet.add(target);
      
      // Skip rules that are just "undefined" or similar (input nodes with no regulators)
      if (reservedWords.has(expression) || reservedWords.has(expression.toLowerCase())) {
        // Still store the rule for completeness, but don't extract edges
        rules.push({
          name: line,
          enabled: true
        });
        continue;
      }
      
      // Store the rule
      rules.push({
        name: line,
        enabled: true
      });
      
      // Extract all identifiers from the expression (excluding operators and reserved words)
      const identifiers = expression.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
      
      for (const id of identifiers) {
        const normalized = id.toLowerCase();
        // Skip reserved words but ALLOW self-loops (don't skip when normalized === target)
        if (!reservedWords.has(id) && !reservedWords.has(normalized)) {
          nodeSet.add(normalized);
          if (!edgeMap.has(target)) {
            edgeMap.set(target, new Set());
          }
          edgeMap.get(target)!.add(normalized);
        }
      }
    }
  }
  
  // Build nodes with grid positions
  const nodeArray = Array.from(nodeSet);
  const nodes: NetworkNode[] = nodeArray.map((id, i) => ({
    id,
    label: id,
    properties: {
      position: {
        x: 100 + (i % 5) * 150,
        y: 100 + Math.floor(i / 5) * 150
      }
    }
  }));
  
  // Build edges from the map
  const edges: NetworkEdge[] = [];
  for (const [target, sources] of edgeMap.entries()) {
    for (const source of sources) {
      edges.push({
        source,
        target,
        weight: 1
      });
    }
  }
  
  return {
    nodes,
    edges,
    rules,
    metadata: {
      type: 'Rule Based',
      createdFrom: 'rules',
      importedAt: new Date().toISOString()
    }
  };
}

// ============================================================================
// UNIFIED EXPORT FUNCTION
// ============================================================================

export type ExportFormat = 'csv' | 'txt' | 'sif' | 'sbml-qual';

/**
 * Export a network to a specific format.
 * Returns { content, filename, mimeType }
 * 
 * @param data Network data to export
 * @param networkName Name for the exported file
 * @param format Optional format override (csv, txt, sif, sbml-qual)
 */
export function exportNetwork(
  data: NetworkData,
  networkName: string = 'network',
  format?: ExportFormat
): { content: string; filename: string; mimeType: string } {
  const safeName = networkName.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // If format is specified, use it
  if (format) {
    switch (format) {
      case 'sif':
        return {
          content: exportNetworkToSIF(data),
          filename: `${safeName}.sif`,
          mimeType: 'text/plain'
        };
      case 'sbml-qual':
        return {
          content: exportNetworkToSBMLqual(data, safeName),
          filename: `${safeName}.sbml`,
          mimeType: 'application/xml'
        };
      case 'txt':
        return {
          content: exportRuleBasedNetworkToTXT(data),
          filename: `${safeName}_rules.txt`,
          mimeType: 'text/plain'
        };
      case 'csv':
      default:
        return {
          content: exportWeightedNetworkToCSV(data),
          filename: `${safeName}.csv`,
          mimeType: 'text/csv'
        };
    }
  }
  
  // Auto-detect based on network type (handle legacy lowercase casing)
  const metaType = data.metadata?.type?.toLowerCase();
  const isRuleBased = metaType === 'rule based' || 
                       data.metadata?.createdFrom === 'rules' ||
                       (Array.isArray(data.rules) && data.rules.length > 0 && 
                        (!data.edges || data.edges.length === 0 || metaType === 'rule based'));
  
  if (isRuleBased && data.rules && data.rules.length > 0) {
    return {
      content: exportRuleBasedNetworkToTXT(data),
      filename: `${safeName}_rules.txt`,
      mimeType: 'text/plain'
    };
  } else {
    return {
      content: exportWeightedNetworkToCSV(data),
      filename: `${safeName}.csv`,
      mimeType: 'text/csv'
    };
  }
}

// ============================================================================
// UNIFIED IMPORT FUNCTION
// ============================================================================

/**
 * Detect file type and parse accordingly.
 * Supports:
 * - .csv (weight-based, custom format)
 * - .txt (rule-based, Boolean expressions)
 * - .sif (Simple Interaction Format, Cytoscape standard)
 * - .sbml, .xml (SBML-qual format)
 */
export function importNetwork(fileContent: string, fileName: string): NetworkData {
  const extension = fileName.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'csv':
      if (looksLikeRuleBasedCSV(fileContent)) {
        return parseRuleBasedNetworkCSV(fileContent);
      }
      return parseWeightedNetworkCSV(fileContent);
    
    case 'txt':
      return parseRuleBasedNetworkTXT(fileContent);
    
    case 'sif':
      return parseSIFNetwork(fileContent);
    
    case 'sbml':
    case 'xml':
      // Check if it's SBML-qual
      if (fileContent.includes('qual:') || fileContent.includes('qualitativeSpecies')) {
        return parseSBMLqualNetwork(fileContent);
      }
      // Otherwise try to parse as generic XML (future enhancement)
      throw new Error('Unsupported XML format. Only SBML-qual is currently supported.');
    
    default:
      // Try to detect format from content
      return detectAndParseNetwork(fileContent);
  }
}

/**
 * Detect network format from content and parse accordingly.
 */
function detectAndParseNetwork(content: string): NetworkData {
  const trimmed = content.trim();
  
  // Check for XML/SBML-qual
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<sbml') || trimmed.includes('<qual:')) {
    return parseSBMLqualNetwork(content);
  }
  
  // Check for rule-based (has = with expressions)
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const looksLikeRules = lines.some(l => /^[a-zA-Z][a-zA-Z0-9_]*\s*=\s*[\(\!a-zA-Z]/.test(l));
  if (looksLikeRules) {
    return parseRuleBasedNetworkTXT(content);
  }

  // Check for rule-based CSV
  if (looksLikeRuleBasedCSV(content)) {
    return parseRuleBasedNetworkCSV(content);
  }
  
  // Check for SIF format (tab or space separated with interaction types)
  const sifInteractions = ['activates', 'inhibits', 'interacts', 'binds', 'pp', 'pd', 'activation', 'inhibition'];
  const looksLikeSIF = lines.some(l => {
    const lower = l.toLowerCase();
    return sifInteractions.some(int => lower.includes(int));
  });
  if (looksLikeSIF) {
    return parseSIFNetwork(content);
  }
  
  // Default to CSV
  return parseWeightedNetworkCSV(content);
}

// ============================================================================
// DOWNLOAD HELPER
// ============================================================================

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export and download a network file (auto-detect format).
 */
export function exportAndDownloadNetwork(data: NetworkData, networkName: string = 'network'): void {
  const { content, filename, mimeType } = exportNetwork(data, networkName);
  downloadFile(content, filename, mimeType);
}

/**
 * Export and download a network in a specific format.
 */
export function exportAndDownloadNetworkAs(
  data: NetworkData, 
  networkName: string, 
  format: ExportFormat
): void {
  const { content, filename, mimeType } = exportNetwork(data, networkName, format);
  downloadFile(content, filename, mimeType);
}

// ============================================================================
// FORMAT INFO (for UI dropdowns)
// ============================================================================

export const SUPPORTED_IMPORT_FORMATS = [
  { extension: 'csv', label: 'CSV (Weight-based)', description: 'Custom weight-based network format (supports V1 and V2)' },
  { extension: 'txt', label: 'TXT (Rule-based)', description: 'Boolean expression rules' },
  { extension: 'sif', label: 'SIF (Cytoscape)', description: 'Simple Interaction Format' },
  { extension: 'sbml', label: 'SBML-qual', description: 'Systems Biology Markup Language (qualitative)' },
  { extension: 'xml', label: 'XML (SBML-qual)', description: 'SBML-qual in XML format' },
] as const;

export const SUPPORTED_EXPORT_FORMATS = [
  { id: 'csv' as ExportFormat, label: 'CSV (Weight-based)', description: 'Custom weight-based format - compatible with V1', extension: '.csv' },
  { id: 'txt' as ExportFormat, label: 'TXT (Rule-based)', description: 'Boolean expression rules', extension: '.txt' },
  { id: 'sif' as ExportFormat, label: 'SIF (Cytoscape)', description: 'Simple Interaction Format - compatible with Cytoscape', extension: '.sif' },
  { id: 'sbml-qual' as ExportFormat, label: 'SBML-qual', description: 'BioModels compatible - Systems Biology standard', extension: '.sbml' },
] as const;

// ============================================================================
// NETWORK MERGE UTILITIES
// ============================================================================

export type NodeConflictStrategy = 'keep-first' | 'keep-second' | 'rename-second';
export type EdgeConflictStrategy = 'keep-first' | 'keep-second' | 'sum-weights' | 'average-weights' | 'max-weights';
export type RuleConflictStrategy = 'keep-first' | 'keep-second' | 'keep-both';

export interface MergeNetworkOptions {
  /** How to handle nodes with the same ID */
  nodeConflictStrategy?: NodeConflictStrategy;
  /** How to handle edges with the same source/target pair */
  edgeConflictStrategy?: EdgeConflictStrategy;
  /** How to handle rules with the same target */
  ruleConflictStrategy?: RuleConflictStrategy;
  /** Suffix to add to renamed nodes (when using rename-second) */
  renameSuffix?: string;
  /** Preserve metadata from which network: 'first', 'second', or 'merge' */
  metadataPreference?: 'first' | 'second' | 'merge';
}

/**
 * Merge two networks into a single network.
 * 
 * Handles node/edge/rule conflicts according to the specified strategies.
 * 
 * @param base - The base network (first network)
 * @param overlay - The network to merge into the base (second network)
 * @param options - Merge options for conflict resolution
 * @returns The merged network data
 */
export function mergeNetworks(
  base: NetworkData,
  overlay: NetworkData,
  options: MergeNetworkOptions = {}
): NetworkData {
  const {
    nodeConflictStrategy = 'keep-first',
    edgeConflictStrategy = 'keep-first',
    ruleConflictStrategy = 'keep-both',
    renameSuffix = '_2',
    metadataPreference = 'merge',
  } = options;

  // Track node ID mappings for rename strategy
  const nodeIdMap = new Map<string, string>(); // original overlay ID -> final ID

  // ===== MERGE NODES =====
  const baseNodeIds = new Set(base.nodes.map(n => n.id));
  const mergedNodes: NetworkNode[] = [...base.nodes];

  for (const overlayNode of overlay.nodes) {
    if (baseNodeIds.has(overlayNode.id)) {
      // Conflict: node with same ID exists
      switch (nodeConflictStrategy) {
        case 'keep-first':
          // Keep base node, skip overlay node (but track mapping)
          nodeIdMap.set(overlayNode.id, overlayNode.id);
          break;
        case 'keep-second':
          // Replace base node with overlay node
          const idx = mergedNodes.findIndex(n => n.id === overlayNode.id);
          if (idx !== -1) {
            mergedNodes[idx] = { ...overlayNode };
          }
          nodeIdMap.set(overlayNode.id, overlayNode.id);
          break;
        case 'rename-second':
          // Create a new unique ID for the overlay node
          let newId = overlayNode.id + renameSuffix;
          let counter = 2;
          while (baseNodeIds.has(newId) || mergedNodes.some(n => n.id === newId)) {
            newId = overlayNode.id + renameSuffix + counter;
            counter++;
          }
          mergedNodes.push({
            ...overlayNode,
            id: newId,
            label: overlayNode.label ? `${overlayNode.label}${renameSuffix}` : newId,
          });
          nodeIdMap.set(overlayNode.id, newId);
          break;
      }
    } else {
      // No conflict: add overlay node directly
      mergedNodes.push({ ...overlayNode });
      nodeIdMap.set(overlayNode.id, overlayNode.id);
    }
  }

  // ===== MERGE EDGES =====
  // Create a map of base edges by source:target key
  const edgeKey = (e: NetworkEdge) => `${e.source}:${e.target}`;
  const baseEdgeMap = new Map<string, NetworkEdge>();
  for (const edge of base.edges) {
    baseEdgeMap.set(edgeKey(edge), edge);
  }

  const mergedEdges: NetworkEdge[] = [...base.edges];

  for (const overlayEdge of overlay.edges) {
    // Apply node ID mapping for renamed nodes
    const mappedSource = nodeIdMap.get(overlayEdge.source) ?? overlayEdge.source;
    const mappedTarget = nodeIdMap.get(overlayEdge.target) ?? overlayEdge.target;
    const mappedEdge: NetworkEdge = {
      ...overlayEdge,
      source: mappedSource,
      target: mappedTarget,
    };
    const key = edgeKey(mappedEdge);

    if (baseEdgeMap.has(key)) {
      // Conflict: edge with same source:target exists
      const baseEdge = baseEdgeMap.get(key)!;
      const baseIdx = mergedEdges.findIndex(e => edgeKey(e) === key);

      switch (edgeConflictStrategy) {
        case 'keep-first':
          // Keep base edge, skip overlay edge
          break;
        case 'keep-second':
          // Replace base edge with overlay edge
          if (baseIdx !== -1) {
            mergedEdges[baseIdx] = { ...mappedEdge };
          }
          break;
        case 'sum-weights':
          // Sum the weights
          if (baseIdx !== -1) {
            mergedEdges[baseIdx] = {
              ...baseEdge,
              weight: (baseEdge.weight ?? 1) + (overlayEdge.weight ?? 1),
            };
          }
          break;
        case 'average-weights':
          // Average the weights
          if (baseIdx !== -1) {
            mergedEdges[baseIdx] = {
              ...baseEdge,
              weight: ((baseEdge.weight ?? 1) + (overlayEdge.weight ?? 1)) / 2,
            };
          }
          break;
        case 'max-weights':
          // Take the maximum weight
          if (baseIdx !== -1) {
            mergedEdges[baseIdx] = {
              ...baseEdge,
              weight: Math.max(baseEdge.weight ?? 1, overlayEdge.weight ?? 1),
            };
          }
          break;
      }
    } else {
      // No conflict: add overlay edge with mapped IDs
      mergedEdges.push(mappedEdge);
    }
  }

  // ===== MERGE RULES =====
  const mergedRules: Rule[] = [];
  const baseRulesByTarget = new Map<string, Rule>();
  
  // Helper to extract target from rule (handles labels with spaces)
  const extractRuleTarget = (ruleName: string | undefined): string => {
    if (!ruleName) return '';
    const eqIndex = ruleName.indexOf('=');
    return eqIndex > 0 ? ruleName.substring(0, eqIndex).trim() : ruleName;
  };
  
  if (base.rules) {
    for (const rule of base.rules) {
      // Extract target from rule name (format: "Target = expression")
      const target = extractRuleTarget(rule.name);
      baseRulesByTarget.set(target, rule);
      mergedRules.push({ ...rule });
    }
  }

  if (overlay.rules) {
    for (const overlayRule of overlay.rules) {
      const target = extractRuleTarget(overlayRule.name);
      // Map target to new ID if renamed
      const mappedTarget = nodeIdMap.get(target) ?? target;

      if (baseRulesByTarget.has(target) || (mappedTarget !== target && baseRulesByTarget.has(mappedTarget))) {
        // Conflict: rule for same target exists
        switch (ruleConflictStrategy) {
          case 'keep-first':
            // Keep base rule, skip overlay rule
            break;
          case 'keep-second':
            // Replace base rule with overlay rule
            const idx = mergedRules.findIndex(r => {
              const rTarget = extractRuleTarget(r.name);
              return rTarget === target || rTarget === mappedTarget;
            });
            if (idx !== -1) {
              mergedRules[idx] = {
                ...overlayRule,
                name: mappedTarget !== target 
                  ? overlayRule.name.replace(target, mappedTarget)
                  : overlayRule.name,
              };
            }
            break;
          case 'keep-both':
            // Add overlay rule (possibly with renamed target)
            mergedRules.push({
              ...overlayRule,
              name: mappedTarget !== target
                ? overlayRule.name.replace(target, mappedTarget)
                : overlayRule.name,
            });
            break;
        }
      } else {
        // No conflict: add overlay rule (with mapped target if renamed)
        mergedRules.push({
          ...overlayRule,
          name: mappedTarget !== target
            ? overlayRule.name.replace(target, mappedTarget)
            : overlayRule.name,
        });
      }
    }
  }

  // ===== MERGE METADATA =====
  let mergedMetadata: Record<string, any> = {};
  
  switch (metadataPreference) {
    case 'first':
      mergedMetadata = { ...base.metadata };
      break;
    case 'second':
      mergedMetadata = { ...overlay.metadata };
      break;
    case 'merge':
      mergedMetadata = {
        ...base.metadata,
        ...overlay.metadata,
        // Merge cell fates if both have them
        cellFates: {
          ...base.metadata?.cellFates,
          ...overlay.metadata?.cellFates,
        },
      };
      break;
  }

  // Add merge metadata
  mergedMetadata.mergedAt = new Date().toISOString();
  mergedMetadata.mergedFrom = [
    base.metadata?.name || 'network1',
    overlay.metadata?.name || 'network2',
  ];

  return {
    nodes: mergedNodes,
    edges: mergedEdges,
    rules: mergedRules.length > 0 ? mergedRules : undefined,
    metadata: mergedMetadata,
  };
}

/**
 * Get a preview of merge statistics without performing the actual merge.
 */
export function getMergePreview(
  base: NetworkData,
  overlay: NetworkData,
  options: MergeNetworkOptions = {}
): {
  baseStats: { nodes: number; edges: number; rules: number };
  overlayStats: { nodes: number; edges: number; rules: number };
  conflicts: { nodes: number; edges: number; rules: number };
  estimatedResult: { nodes: number; edges: number; rules: number };
} {
  const {
    nodeConflictStrategy = 'keep-first',
    ruleConflictStrategy = 'keep-both',
  } = options;

  const baseNodeIds = new Set(base.nodes.map(n => n.id));
  const overlayNodeIds = new Set(overlay.nodes.map(n => n.id));
  const nodeConflicts = [...overlayNodeIds].filter(id => baseNodeIds.has(id)).length;

  const edgeKey = (e: NetworkEdge) => `${e.source}:${e.target}`;
  const baseEdgeKeys = new Set(base.edges.map(edgeKey));
  const overlayEdgeKeys = new Set(overlay.edges.map(edgeKey));
  const edgeConflicts = [...overlayEdgeKeys].filter(key => baseEdgeKeys.has(key)).length;

  // Helper to extract target from rule (handles labels with spaces)
  const getRuleTarget = (r: Rule) => {
    if (!r.name) return '';
    const eqIndex = r.name.indexOf('=');
    return eqIndex > 0 ? r.name.substring(0, eqIndex).trim() : r.name;
  };
  const baseRuleTargets = new Set((base.rules || []).map(getRuleTarget));
  const overlayRuleTargets = new Set((overlay.rules || []).map(getRuleTarget));
  const ruleConflicts = [...overlayRuleTargets].filter(t => baseRuleTargets.has(t)).length;

  // Estimate result counts based on conflict strategies
  let estimatedNodes = base.nodes.length;
  if (nodeConflictStrategy === 'rename-second') {
    estimatedNodes += overlay.nodes.length;
  } else {
    estimatedNodes += overlay.nodes.length - nodeConflicts;
  }

  let estimatedEdges = base.edges.length;
  // For all edge strategies except keep-first (which adds no new edges on conflict)
  estimatedEdges += overlay.edges.length - edgeConflicts;

  let estimatedRules = (base.rules?.length || 0);
  if (ruleConflictStrategy === 'keep-both') {
    estimatedRules += (overlay.rules?.length || 0);
  } else {
    estimatedRules += (overlay.rules?.length || 0) - ruleConflicts;
  }

  return {
    baseStats: {
      nodes: base.nodes.length,
      edges: base.edges.length,
      rules: base.rules?.length || 0,
    },
    overlayStats: {
      nodes: overlay.nodes.length,
      edges: overlay.edges.length,
      rules: overlay.rules?.length || 0,
    },
    conflicts: {
      nodes: nodeConflicts,
      edges: edgeConflicts,
      rules: ruleConflicts,
    },
    estimatedResult: {
      nodes: estimatedNodes,
      edges: estimatedEdges,
      rules: estimatedRules,
    },
  };
}
