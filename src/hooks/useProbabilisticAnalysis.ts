import { useCallback, useState } from 'react';
import type {
  AnalysisNode,
  AnalysisEdge,
  ProbabilisticAnalysisOptions,
  ProbabilisticAnalysisResult,
} from '@/lib/analysis/types';
import { performProbabilisticAnalysis } from '@/lib/analysis/probabilisticAnalysis';

type UseProbabilisticAnalysisState = {
  result: ProbabilisticAnalysisResult | null;
  isRunning: boolean;
  error: string | null;
};

type UseProbabilisticAnalysisReturn = UseProbabilisticAnalysisState & {
  run: (nodes: AnalysisNode[], edges: AnalysisEdge[], options: ProbabilisticAnalysisOptions) => Promise<void>;
  reset: () => void;
};

export function useProbabilisticAnalysis(): UseProbabilisticAnalysisReturn {
  const [result, setResult] = useState<ProbabilisticAnalysisResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (nodes: AnalysisNode[], edges: AnalysisEdge[], options: ProbabilisticAnalysisOptions) => {
      setIsRunning(true);
      setError(null);
      try {
        const analysisResult = await new Promise<ProbabilisticAnalysisResult>((resolve, reject) => {
          setTimeout(() => {
            try {
              const computed = performProbabilisticAnalysis(nodes, edges, options);
              resolve(computed);
            } catch (err) {
              reject(err);
            }
          }, 0);
        });
        setResult(analysisResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error during probabilistic analysis.';
        setError(message);
        setResult(null);
        console.error('[useProbabilisticAnalysis] run error', err);
      } finally {
        setIsRunning(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsRunning(false);
  }, []);

  return { result, isRunning, error, run, reset };
}
