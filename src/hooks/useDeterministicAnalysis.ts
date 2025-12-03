import { useCallback, useMemo, useState } from 'react';
import { performDeterministicAnalysis } from '@/lib/deterministicAnalysis';
import type { DeterministicAnalysisResult, AnalysisNode } from '@/lib/deterministicAnalysis';
import type { NetworkData } from '@/types/network';

type Params = {
  selectedNetworkId?: string | null;
  selectedNetworkName?: string | null;
  networkData?: NetworkData | null;
  rulesText: string;
};

export function useDeterministicAnalysis({ selectedNetworkId, selectedNetworkName, networkData, rulesText }: Params) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DeterministicAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastRulesUsed, setLastRulesUsed] = useState<string[] | null>(null);

  const inferredNodes: AnalysisNode[] = useMemo(() => {
    const fromNetwork: AnalysisNode[] = Array.isArray(networkData?.nodes)
      ? (networkData!.nodes as any[])
          .filter(n => n && (n.id || n.name))
          .map(n => ({ id: String(n.id || n.name), label: (n as any).label || (n as any).name || (n as any).id }))
      : [];
    if (fromNetwork.length) return fromNetwork;
    const ids = new Set<string>();
    rulesText.split(/\n+/).forEach(line => {
      const [lhs, rhs] = line.split('=');
      if (lhs && rhs) {
        const id = lhs.trim();
        if (id) ids.add(id);
      }
    });
    return Array.from(ids).map(id => ({ id }));
  }, [networkData, rulesText]);

  const runWithRules = useCallback((rules: string[]) => {
    setAnalysisError(null);
    setIsAnalyzing(true);
    try {
      const cleaned = rules.map(l => l.trim()).filter(l => l && l.includes('='));
      if (!cleaned.length) throw new Error('Provide at least one rule in the form NODE = EXPRESSION');
      if (!inferredNodes.length) throw new Error('Could not infer any nodes. Add rules or select a network with nodes.');
      const result = performDeterministicAnalysis({ nodes: inferredNodes, rules: cleaned });
      setAnalysisResult(result);
      setLastRulesUsed(cleaned);
    } catch (e: any) {
      setAnalysisResult(null);
      setAnalysisError(e?.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [inferredNodes]);

  const runFromEditorRules = useCallback(() => {
    const rules = rulesText.split(/\n+/).map(l => l.trim()).filter(Boolean);
    runWithRules(rules);
  }, [rulesText, runWithRules]);

  const runDeterministic = useCallback(() => {
    const networkRules: string[] = Array.isArray(networkData?.rules)
      ? (networkData!.rules as any[])
          .map((r) => (typeof r === 'string' ? r : (r && typeof r === 'object' && 'action' in r && 'condition' in r ? `${(r as any).name || 'NODE'} = ${(r as any).condition}` : null)))
          .filter((l: any) => typeof l === 'string')
      : [];
    const textRules: string[] = rulesText.split(/\n+/).map(l => l.trim()).filter(l => l && l.includes('='));
    const rules = networkRules.length > 0 ? networkRules : textRules;
    if (networkRules.length > 0) {
      // mirror in editor is handled outside; this hook returns lastRulesUsed
    }
    runWithRules(rules);
  }, [networkData, rulesText, runWithRules]);

  const downloadResults = useCallback(() => {
    if (!analysisResult) return;
    try {
      const payload = {
        meta: {
          generatedAt: new Date().toISOString(),
          projectNetworkId: selectedNetworkId ?? null,
          projectNetworkName: selectedNetworkName ?? null,
          nodeCount: analysisResult.nodeOrder.length,
        },
        rules: lastRulesUsed ?? rulesText.split(/\n+/).map(l => l.trim()).filter(Boolean),
        result: analysisResult,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `deterministic_analysis_${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // swallow download error
    }
  }, [analysisResult, lastRulesUsed, rulesText, selectedNetworkId, selectedNetworkName]);

  const clear = useCallback(() => {
    setAnalysisResult(null);
    setAnalysisError(null);
  }, []);

  return {
    inferredNodes,
    isAnalyzing,
    analysisResult,
    analysisError,
    lastRulesUsed,
    runDeterministic,
    runFromEditorRules,
    downloadResults,
    clear,
  } as const;
}
