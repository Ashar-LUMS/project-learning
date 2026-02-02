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
      type: 'Weight based',
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
      type: rules.length > 0 ? 'Rule based' : 'Weight based',
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
 * Section 1: node_id, bias (nodes with bias values)
 * Section 2: source, weight, target (edges with weights)
 * Section 3: "Weight Based" label
 */
export function exportWeightedNetworkToCSV(data: NetworkData): string {
  const lines: string[] = [];
  
  // Section 1: Nodes with bias values
  const nodes = data.nodes || [];
  for (const node of nodes) {
    const bias = node.properties?.bias ?? 0;
    lines.push(`${node.id},${bias}`);
  }
  
  // Empty separator
  lines.push(',,');
  
  // Section 2: Edges (source, weight/intensity, target)
  const edges = data.edges || [];
  for (const edge of edges) {
    const weight = edge.weight ?? 1;
    lines.push(`${edge.source},${weight},${edge.target}`);
  }
  
  // Empty separator
  lines.push(',,');
  
  // Section 3: Network type label
  lines.push('Weight Based');
  
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
 * Expects the format from exportWeightedNetworkToCSV:
 * Section 1: node_id, basal_value
 * Section 2: source, weight, target
 * Section 3: "Weight Based" label
 */
export function parseWeightedNetworkCSV(csvContent: string): NetworkData {
  const lines = csvContent.split(/\r?\n/).map(l => l.trim());
  
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
  
  for (const line of nodeLines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 2 && parts[0]) {
      const id = parts[0];
      const bias = parseFloat(parts[1]) || 0;
      nodes.push({
        id,
        label: id,
        properties: { bias }
      });
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
  
  // Check for network type label in remaining lines
  const remainingLines = lines.slice(section2End + 1).filter(l => l && !l.match(/^,+$/));
  const isWeightBased = remainingLines.some(l => l.toLowerCase().includes('weight'));
  
  return {
    nodes,
    edges,
    metadata: {
      type: isWeightBased ? 'weight based' : 'weight based', // Default to weight-based for CSV
      importedAt: new Date().toISOString()
    }
  };
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
  
  for (const line of lines) {
    // Match: nodename=(expression) or nodename = (expression)
    const match = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (match) {
      const target = match[1].toLowerCase();
      const expression = match[2];
      
      nodeSet.add(target);
      
      // Store the rule
      rules.push({
        name: line,
        enabled: true
      });
      
      // Extract all identifiers from the expression (excluding operators)
      const identifiers = expression.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
      const operators = new Set(['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT', 'and', 'or', 'xor', 'nand', 'nor', 'not']);
      
      for (const id of identifiers) {
        const normalized = id.toLowerCase();
        if (!operators.has(id.toUpperCase()) && normalized !== target) {
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
      type: 'Rule based',
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
  
  // Auto-detect based on network type
  const isRuleBased = data.metadata?.type === 'Rule based' || 
                       data.metadata?.createdFrom === 'rules' ||
                       (Array.isArray(data.rules) && data.rules.length > 0 && 
                        (!data.edges || data.edges.length === 0 || data.metadata?.type === 'Rule based'));
  
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
  { extension: 'csv', label: 'CSV (Weight-based)', description: 'Custom weight-based network format' },
  { extension: 'txt', label: 'TXT (Rule-based)', description: 'Boolean expression rules' },
  { extension: 'sif', label: 'SIF (Cytoscape)', description: 'Simple Interaction Format' },
  { extension: 'sbml', label: 'SBML-qual', description: 'Systems Biology Markup Language (qualitative)' },
  { extension: 'xml', label: 'XML (SBML-qual)', description: 'SBML-qual in XML format' },
] as const;

export const SUPPORTED_EXPORT_FORMATS = [
  { id: 'csv' as ExportFormat, label: 'CSV (Weight-based)', description: 'Custom weight-based network format', extension: '.csv' },
  { id: 'txt' as ExportFormat, label: 'TXT (Rule-based)', description: 'Boolean expression rules', extension: '.txt' },
  { id: 'sif' as ExportFormat, label: 'SIF (Cytoscape)', description: 'Simple Interaction Format - compatible with Cytoscape', extension: '.sif' },
  { id: 'sbml-qual' as ExportFormat, label: 'SBML-qual', description: 'BioModels compatible - Systems Biology standard', extension: '.sbml' },
] as const;
