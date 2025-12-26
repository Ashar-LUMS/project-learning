import type { NetworkData, TherapeuticIntervention } from '@/types/network';

/**
 * Extracts node identifiers from a Boolean expression.
 * Handles operators: ! (NOT), && (AND), || (OR), parentheses, and 0/1 constants.
 * The direction of edges is: dependency → new node (regardless of negation).
 */
function extractNodesFromRule(rule: string): string[] {
  if (!rule) return [];
  
  // Remove parentheses, Boolean operators (!, &&, ||), and constants
  const cleaned = rule
    .replace(/\(|\)/g, ' ')           // Remove parentheses
    .replace(/&&/g, ' ')               // Remove AND operator
    .replace(/\|\|/g, ' ')             // Remove OR operator  
    .replace(/!/g, ' ')                // Remove NOT operator
    .replace(/\b[01]\b/g, ' ')         // Remove 0 and 1 constants
    .replace(/\bAND\b|\bOR\b|\bNOT\b/gi, ' ') // Remove text operators (fallback)
    .trim();
  
  // Split by whitespace and filter out empty strings
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);
  
  // Return unique node names (all dependencies point TO the new node)
  return [...new Set(tokens)];
}

/**
 * Applies therapeutic interventions to network data, producing a modified network.
 * This creates new nodes, edges, and rules based on knock-in/knock-out interventions.
 */
export function applyTherapiesToNetwork(
  originalData: NetworkData,
  therapies: TherapeuticIntervention[]
): NetworkData {
  if (!therapies || therapies.length === 0) {
    return originalData;
  }

  let modifiedNodes = [...originalData.nodes];
  let modifiedEdges = [...originalData.edges];
  let modifiedRules = originalData.rules ? [...originalData.rules] : [];

  for (const therapy of therapies) {
    if (therapy.type === 'knock-in') {
      // Add new node
      const nodeExists = modifiedNodes.some(n => n.id === therapy.nodeName || n.label === therapy.nodeName);
      if (!nodeExists) {
        modifiedNodes.push({
          id: therapy.nodeName,
          label: therapy.nodeName,
          properties: {
            addedByTherapy: true,
            therapyId: therapy.id
          }
        });
      }

      // Add inward regulation (rule for the new node)
      if (therapy.nodeRule !== null) {
        // Node has a Boolean rule
        const ruleExists = modifiedRules.some(r => r.name === therapy.nodeName);
        if (!ruleExists) {
          modifiedRules.push({
            name: therapy.nodeName,
            action: therapy.nodeRule,
            enabled: true
          });
        } else {
          // Update existing rule
          modifiedRules = modifiedRules.map(r =>
            r.name === therapy.nodeName
              ? { ...r, action: therapy.nodeRule! }
              : r
          );
        }

        // Extract dependencies from the rule and create inward edges
        const dependencies = extractNodesFromRule(therapy.nodeRule);
        for (const depNode of dependencies) {
          // Check if the dependency node exists in the network
          const depExists = modifiedNodes.some(n => n.id === depNode || n.label === depNode);
          if (depExists) {
            // Add edge from dependency to new node (if not already present)
            const edgeExists = modifiedEdges.some(
              e => e.source === depNode && e.target === therapy.nodeName
            );
            if (!edgeExists) {
              modifiedEdges.push({
                source: depNode,
                target: therapy.nodeName,
                properties: {
                  addedByTherapy: true,
                  therapyId: therapy.id,
                  type: 'inward-regulation'
                }
              });
            }
          }
        }
      } else if (therapy.fixedValue !== null) {
        // Node has a fixed value - represent as a constant rule
        const ruleExists = modifiedRules.some(r => r.name === therapy.nodeName);
        if (!ruleExists) {
          modifiedRules.push({
            name: therapy.nodeName,
            action: therapy.fixedValue.toString(),
            enabled: true
          });
        } else {
          modifiedRules = modifiedRules.map(r =>
            r.name === therapy.nodeName
              ? { ...r, action: therapy.fixedValue!.toString() }
              : r
          );
        }
      }

      // Add outward regulations (modify rules of existing nodes)
      for (const outward of therapy.outwardRegulations) {
        // Detect if this is an inhibitor (contains !) or amplifier
        const isInhibitor = outward.addition.includes('!');
        const edgeType = isInhibitor ? 'inhibitor' : 'amplifier';
        
        // Add edges from new node to target nodes
        const edgeExists = modifiedEdges.some(
          e => e.source === therapy.nodeName && e.target === outward.targetNode
        );
        if (!edgeExists) {
          modifiedEdges.push({
            source: therapy.nodeName,
            target: outward.targetNode,
            properties: {
              addedByTherapy: true,
              therapyId: therapy.id,
              type: 'outward-regulation',
              edgeType: edgeType
            }
          });
        }

        // Update target node's rule
        const existingRule = modifiedRules.find(r => r.name === outward.targetNode);
        let newRuleAction: string;

        if (existingRule && existingRule.action) {
          // Combine with existing rule
          newRuleAction = `(${existingRule.action}) ${outward.operator} (${outward.addition})`;
        } else {
          // No existing rule, just use the addition
          newRuleAction = outward.addition;
        }

        if (existingRule) {
          modifiedRules = modifiedRules.map(r =>
            r.name === outward.targetNode
              ? { ...r, action: newRuleAction }
              : r
          );
        } else {
          modifiedRules.push({
            name: outward.targetNode,
            action: newRuleAction,
            enabled: true
          });
        }
      }
    } else if (therapy.type === 'knock-out') {
      // TODO: Implement knock-out logic
      // For knock-out: remove node or set it to always-off (0)
    }
  }

  return {
    ...originalData,
    nodes: modifiedNodes,
    edges: modifiedEdges,
    rules: modifiedRules
  };
}
