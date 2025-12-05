/**
 * Example integration of weighted deterministic analysis into NetworkEditorPage.
 *
 * This example shows how to:
 * 1. Use the useWeightedAnalysis hook
 * 2. Wire it into a sidebar button
 * 3. Display results in a modal or results panel
 *
 * Add this to `src/features/NetworkEditor/NetworkEditorPage.tsx` or a new tab.
 */

// Example code (not a complete file – for reference only):

/*
import { useWeightedAnalysis } from '@/hooks/useWeightedAnalysis';
import { Button } from '@/components/ui/button';

export function WeightedAnalysisTab() {
  const { run, result, isRunning, error } = useWeightedAnalysis();
  const [thresholdMultiplier, setThresholdMultiplier] = useState(0.5);
  const [tieBehavior, setTieBehavior] = useState<'zero-as-zero' | 'zero-as-one' | 'hold'>('zero-as-zero');

  const handleRun = async () => {
    // Collect nodes and edges from network state
    const nodes = networkState.nodes.map(n => ({
      id: n.id,
      label: n.label || n.id,
    }));

    const edges = networkState.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: parseFloat(e.data?.weight || '1') || 1,
    }));

    await run(nodes, edges, {
      thresholdMultiplier,
      tieBehavior,
      stateCap: 2 ** 17,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label>Threshold Multiplier</label>
        <input
          type="number"
          value={thresholdMultiplier}
          onChange={(e) => setThresholdMultiplier(parseFloat(e.target.value))}
          step="0.1"
          min="0"
          max="2"
        />
      </div>

      <div>
        <label>Tie Behavior</label>
        <select value={tieBehavior} onChange={(e) => setTieBehavior(e.target.value as any)}>
          <option value="zero-as-zero">Zero-as-Zero</option>
          <option value="zero-as-one">Zero-as-One</option>
          <option value="hold">Hold</option>
        </select>
      </div>

      <Button onClick={handleRun} disabled={isRunning}>
        {isRunning ? 'Analyzing...' : 'Run Weighted Analysis'}
      </Button>

      {error && <div className="text-red-600">{error}</div>}

      {result && (
        <div className="space-y-2">
          <h3>Results</h3>
          <p>Found {result.attractors.length} attractors</p>
          {result.truncated && (
            <p className="text-yellow-600">Warning: Analysis truncated</p>
          )}
          <div>
            <h4>Attractors</h4>
            {result.attractors.map((att, i) => (
              <div key={i} className="border p-2 mb-2">
                <p>Attractor {i}: {att.type} (period: {att.period})</p>
                <p>Basin size: {att.basinSize} ({(att.basinShare * 100).toFixed(1)}%)</p>
                {att.states.map((state, j) => (
                  <p key={j} className="text-sm font-mono">{state.binary}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
*/
