import { useState, useCallback } from 'react';
import { performDeterministicAnalysis } from '@/lib/deterministicAnalysis';
import type { DeterministicAnalysisResult } from '@/lib/analysis/types';

export function useDeterministicAnalysis() {
  const [result, setResult] = useState<DeterministicAnalysisResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (
    rules: string[],
    options?: { stateCap?: number; stepCap?: number }
  ) => {
    setIsRunning(true);
    setError(null);
    
    try {
      // Run in setTimeout to avoid blocking UI
      const analysisResult = await new Promise<DeterministicAnalysisResult>((resolve, reject) => {
        setTimeout(() => {
          try {
            const result = performDeterministicAnalysis(rules, options);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        }, 0);
      });
      
      setResult(analysisResult);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setResult(null);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsRunning(false);
  }, []);

  const downloadResults = useCallback(() => {
    if (!result) return;

    const data = {
      analysis: 'rule-based-deterministic',
      timestamp: new Date().toISOString(),
      nodeOrder: result.nodeOrder,
      attractors: result.attractors.map(att => ({
        id: att.id,
        type: att.type,
        period: att.period,
        basinSize: att.basinSize,
        basinShare: att.basinShare,
        states: att.states,
      })),
      exploredStateCount: result.exploredStateCount,
      totalStateSpace: result.totalStateSpace,
      truncated: result.truncated,
      warnings: result.warnings,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rule-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  return {
    result,
    isRunning,
    error,
    run,
    reset,
    downloadResults,
  } as const;
}
