/**
 * Network Import/Export Utilities
 * Standardized CSV format for weight-based networks and TXT format for rule-based networks.
 */

import type { NetworkNode, NetworkEdge, Rule, NetworkData } from '@/types/network';

// ============================================================================
// TYPES
// ============================================================================

export interface WeightedNetworkCSV {
  nodes: Array<{ id: string; initialValue: number }>;
  edges: Array<{ source: string; weight: number; target: string }>;
  positions: Array<{ id: string; value: number; x: number; y: number; color: string; model: string }>;
}

export interface ParsedRuleBasedNetwork {
  rules: string[];
  nodes: Set<string>;
  edges: Array<{ source: string; target: string; weight?: number }>;
}

// ============================================================================
// WEIGHT-BASED NETWORK EXPORT (CSV)
// ============================================================================

/**
 * Export a weight-based network to CSV format.
 * Format:
 * Section 1: node_id, initial_value
 * Section 2: source, weight, target (edges)
 * Section 3: node_id, value, x, y, color, model (positions)
 * Section 4: "Weight Based" label
 */
export function exportWeightedNetworkToCSV(data: NetworkData): string {
  const lines: string[] = [];
  
  // Section 1: Nodes with initial values
  const nodes = data.nodes || [];
  for (const node of nodes) {
    const initialValue = node.properties?.initialValue ?? node.weight ?? 0;
    lines.push(`${node.id},${initialValue}`);
  }
  
  // Empty separator
  lines.push(',,');
  
  // Section 2: Edges (source, weight, target)
  const edges = data.edges || [];
  for (const edge of edges) {
    const weight = edge.weight ?? 1;
    lines.push(`${edge.source},${weight},${edge.target}`);
  }
  
  // Empty separator
  lines.push(',,');
  
  // Section 3: Node positions (id, value, x, y, color, model)
  for (const node of nodes) {
    const x = node.properties?.position?.x ?? node.properties?.x ?? 100;
    const y = node.properties?.position?.y ?? node.properties?.y ?? 100;
    const color = node.properties?.color ?? 'white';
    const model = node.properties?.model ?? 'devs.SimpleMoleculeModel';
    const value = node.properties?.initialValue ?? node.weight ?? 0;
    lines.push(`${node.id},${value},${x},${y},${color},${model}`);
  }
  
  // Empty separator
  lines.push(',,');
  
  // Section 4: Network type label
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
 * Expects the format from exportWeightedNetworkToCSV.
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
  const section3Start = section2End + 1;
  const section3End = sectionBreaks[2] ?? lines.length;
  
  // Section 1: Nodes (id, initialValue)
  const nodeLines = lines.slice(0, section1End).filter(l => l && !l.match(/^,+$/));
  const nodes: NetworkNode[] = [];
  const nodeMap = new Map<string, { initialValue: number }>();
  
  for (const line of nodeLines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 2 && parts[0]) {
      const id = parts[0];
      const initialValue = parseFloat(parts[1]) || 0;
      nodeMap.set(id, { initialValue });
      nodes.push({
        id,
        label: id,
        weight: initialValue,
        properties: { initialValue }
      });
    }
  }
  
  // Section 2: Edges (source, weight, target)
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
  
  // Section 3: Positions (id, value, x, y, color, model)
  const positionLines = lines.slice(section3Start, section3End).filter(l => l && !l.match(/^,+$/));
  
  for (const line of positionLines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 4 && parts[0]) {
      const id = parts[0];
      const node = nodes.find(n => n.id === id);
      if (node) {
        node.properties = {
          ...node.properties,
          x: parseFloat(parts[2]) || 100,
          y: parseFloat(parts[3]) || 100,
          position: {
            x: parseFloat(parts[2]) || 100,
            y: parseFloat(parts[3]) || 100
          },
          color: parts[4] || 'white',
          model: parts[5] || 'devs.SimpleMoleculeModel'
        };
      }
    }
  }
  
  // Check for network type label
  const lastNonEmpty = lines.filter(l => l && !l.match(/^,+$/)).pop();
  const isWeightBased = lastNonEmpty?.toLowerCase().includes('weight');
  
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

/**
 * Export a network based on its type.
 * Returns { content, filename, mimeType }
 */
export function exportNetwork(
  data: NetworkData,
  networkName: string = 'network'
): { content: string; filename: string; mimeType: string } {
  const isRuleBased = data.metadata?.type === 'Rule based' || 
                       data.metadata?.createdFrom === 'rules' ||
                       (Array.isArray(data.rules) && data.rules.length > 0 && 
                        (!data.edges || data.edges.length === 0 || data.metadata?.type === 'Rule based'));
  
  if (isRuleBased && data.rules && data.rules.length > 0) {
    const content = exportRuleBasedNetworkToTXT(data);
    const safeName = networkName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      content,
      filename: `${safeName}_rules.txt`,
      mimeType: 'text/plain'
    };
  } else {
    const content = exportWeightedNetworkToCSV(data);
    const safeName = networkName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      content,
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
 * Supports .csv (weight-based) and .txt (rule-based) formats.
 */
export function importNetwork(fileContent: string, fileName: string): NetworkData {
  const extension = fileName.toLowerCase().split('.').pop();
  
  if (extension === 'csv') {
    return parseWeightedNetworkCSV(fileContent);
  } else if (extension === 'txt') {
    return parseRuleBasedNetworkTXT(fileContent);
  } else {
    // Try to detect format from content
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim());
    
    // Check if it looks like rule-based (has = with expressions)
    const looksLikeRules = lines.some(l => /^[a-zA-Z][a-zA-Z0-9_]*\s*=\s*[\(\!a-zA-Z]/.test(l));
    
    if (looksLikeRules) {
      return parseRuleBasedNetworkTXT(fileContent);
    } else {
      return parseWeightedNetworkCSV(fileContent);
    }
  }
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
 * Export and download a network file.
 */
export function exportAndDownloadNetwork(data: NetworkData, networkName: string = 'network'): void {
  const { content, filename, mimeType } = exportNetwork(data, networkName);
  downloadFile(content, filename, mimeType);
}
