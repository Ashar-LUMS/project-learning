/**
 * Hook for running weighted deterministic analysis on a network.
 *
 * Similar to useDeterministicAnalysis but for weight-based dynamics.
 */

import { useCallback, useState } from 'react';
import type { AnalysisNode, AnalysisEdge, DeterministicAnalysisResult, WeightedAnalysisOptions } from '@/lib/analysis/types';
import { performWeightedAnalysis } from '@/lib/analysis/weightedDeterministicAnalysis';

interface UseWeightedAnalysisState {
  result: DeterministicAnalysisResult | null;
  isRunning: boolean;
  error: string | null;
}

interface UseWeightedAnalysisReturn extends UseWeightedAnalysisState {
  run: (nodes: AnalysisNode[], edges: AnalysisEdge[], options?: WeightedAnalysisOptions) => Promise<void>;
  reset: () => void;
}

/**
 * Hook to run weighted deterministic analysis.
 */
export function useWeightedAnalysis(): UseWeightedAnalysisReturn {
  const [result, setResult] = useState<DeterministicAnalysisResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (nodes: AnalysisNode[], edges: AnalysisEdge[], options?: WeightedAnalysisOptions) => {
      setIsRunning(true);
      setError(null);

      try {
        // Run in a setTimeout to yield to the event loop.
        // IMPORTANT: reject on error (throwing here would not reject the Promise).
        const analysisResult = await new Promise<DeterministicAnalysisResult>((resolve, reject) => {
          setTimeout(() => {
            try {
              const res = performWeightedAnalysis(nodes, edges, options);
              resolve(res);
            } catch (err) {
              reject(err);
            }
          }, 0);
        });

        setResult(analysisResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error during weighted analysis';
        setError(message);
        console.error('Weighted analysis error:', err);
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsRunning(false);
  }, []);

  return {
    result,
    isRunning,
    error,
    run,
    reset,
  };
}
