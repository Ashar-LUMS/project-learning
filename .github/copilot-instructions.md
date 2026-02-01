## Purpose
Guidance for AI coding agents contributing to this Vite + React + TypeScript workspace. Priorities: the Network Editor, Supabase-backed persistence, and deterministic analyses (rule-based, weighted, and probabilistic).

## Architecture Overview
- UI stack: React 19 + Vite 7 + Tailwind 4 with shadcn-inspired primitives under `src/components/ui/*`.
- Routing: React Router defined in `src/routes.tsx`. Auth pages live at the root, the `/app/*` shell is `src/layouts/AppLayout.tsx`, and admin-only routes sit under `/app/admin/*` guarded by `RequireAdmin`.
- Network tooling: `src/features/NetworkEditor/*` contains the shared layout (`layout.tsx`), the standalone editor (`NetworkEditorPage.tsx`), and the project-centric view (`ProjectVisualizationPage.tsx`). Both pages wire into the same sidebar contract and reuse `AttractorGraph.tsx` for attractor visualization.
- Visualization: `src/features/NetworkEditor/NetworkGraph.tsx` wraps Cytoscape. The instance is created once and reconciled in place so edits diff against the live graph. Edges always render with ids of the form `edge:${source}:${target}` to keep updates deterministic.
- Admin & ancillary features: feature folders under `src/features/*` (auth, admin, services, profile, etc.) mostly consume Supabase directly or via small hooks.

## UI/UX Patterns
- **Tab Navigation:** Only `enabledTabs` are rendered; `_futureTabs` kept for future use.
- **Analysis Buttons:** Grouped with visual hierarchy; primary actions vs utilities.
- **Error Messages:** Use `Alert` with `variant="destructive"` and actionable suggestions.
- **Date Formatting:** Use `src/lib/format.ts` utilities.
- **Icons:** Use lucide-react; avoid custom SVGs.

## Data Model & Supabase
- Supabase client (`src/supabaseClient.ts`) expects `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and runs with `sessionStorage` in dev (no URL session detection).
- Tables (assumed):
  - `projects`: includes `networks uuid[]` that orders linked network ids.
  - `networks`: `network_data jsonb` shaped roughly like `{ nodes: [], edges: [], rules?: [], metadata?: {} }`.
- Fetch pattern: read the project’s `networks` array first, then `.in('id', ids)` from `networks`, finally reorder to match the original array (see `useProjectNetworks`).
- Weighted metadata: `network_data.metadata` may hold `tieBehavior`, `thresholdMultiplier`, import flags, etc. Per-node biases are usually stored under `node.properties.bias`.

## Network Editor Patterns
- Layout contract: `NetworkEditorLayout` owns navigation + sidebars. Pages pass `inferenceActions` (`run`, `runWeighted`, `runProbabilistic`, `download`, flags) so the layout can render “Perform DA” buttons without touching globals.
- Hooks glue:
  - `useProjectNetworks` keeps project networks ordered, exposes `selectNetwork`, and surfaces creation helpers via `setNetworks`.
  - `useNetworkData` fetches a single network row and logs diagnostic info if `network_data` is missing.
  - `useDeterministicAnalysis` parses editor text or stored rules, runs `performDeterministicAnalysis`, and exposes download + clear helpers.
  - `useWeightedAnalysis` wraps `performWeightedAnalysis` (from `src/lib/analysis`) with async state.
  - `useProbabilisticAnalysis` drives `performProbabilisticAnalysis` to collect PA parameters and surface results on the inference tab.
- Graph editing (`NetworkGraph.tsx`):
  - Maintains local node/edge drafts, reconciles Cytoscape elements, and offers weight/rule editing modes.
  - `getLiveWeightedConfig()` exposes unsaved nodes, edges, biases, and tie behavior so weighted analysis can prefer the live graph before falling back to persisted data.
  - Saves dedupe edges by source→target, preserves edge ids, and writes `{ nodes, edges, rules, metadata }` back to Supabase. “Save As New” also links the new id into the current project.
  - Rule editing uses `RuleBasedGraph.tsx`; applying a rule set toggles styling but preserves the weight-based layout for later.
- Project view (`ProjectVisualizationPage.tsx`): reuses the layout, supports network creation/import, optional rule inference via `lib/openRouter`, and routes weighted runs through the same normalization helper as the editor page.

## Analysis Engines
- **Rule-based:** `src/lib/deterministicAnalysis.ts` (shunting-yard parser, 18 node cap)
- **Weighted:** `src/lib/analysis/weightedDeterministicAnalysis.ts` (matrix-based, configurable tie behavior)
- **Probabilistic:** `src/lib/analysis/probabilisticAnalysis.ts` (Markovian dynamics)
- **Utilities:** `src/lib/analysis/matrixUtils.ts` for edge↔matrix conversion
- **Tests:** `src/lib/__tests__` and `src/lib/analysis/__tests__`
- See [src/lib/analysis/README.md](../src/lib/analysis/README.md) for API details.

## Conventions
- Path alias `@` resolves to `src` (see `vite.config.ts`). Prefer `@/hooks/...`, `@/lib/...`, etc.
- UI logic stays inside `src/features/*`; shared analysis/utilities stay under `src/lib/*`.
- Persisted network payloads must keep the `{ nodes, edges, rules?, metadata? }` structure so import/export flows remain compatible.
- Keep Cytoscape edge ids deterministic (`edge:${source}:${target}`) when adding/removing edges anywhere in the codebase.

## Extension Points & Examples
- New inference modes should return `DeterministicAnalysisResult`, plug into `NetworkEditorPage` (or project view), and surface controls via `inferenceActions`.
- Weighted inputs: prefer the helpers in `src/lib/analysis` (e.g., `edgesToMatrix`) when converting graph data to matrices.
- Import flows: `ProjectVisualizationPage` shows how to accept JSON + optional rule files, infer rules through `lib/openRouter`, and persist networks + project links without reloading.
- When wiring new Supabase mutations, mirror the ordering/uniqueness guarantees in `useProjectNetworks` so lists stay stable across edits.

## Gotchas
- Analysis caps: both engines respect `stateCap`/`stepCap` defaults from `ANALYSIS_CONFIG` (currently 2^20). Large networks surface warnings and may truncate exploration.
- Rule parser: identifiers are case-insensitive but resolved against known node ids/labels; ensure node ids exist before running deterministic analysis.
- Weighted analysis expects weights aligned to the node order and biases keyed by node id. Missing entries default to zero.
- Cytoscape init happens once; when adding new effects ensure they guard against re-initializing the instance or breaking the reconcile diff.
- Saving graphs dedupes edges; if you rely on multi-edge semantics you must encode them differently (e.g., via metadata).

## Key Files
- `src/features/NetworkEditor/layout.tsx` – navigation + sidebar contract; uses `enabledTabs` for active tabs.
- `src/features/NetworkEditor/NetworkEditorPage.tsx` – main editor hub, inference wiring, keyboard shortcuts.
- `src/features/NetworkEditor/ProjectVisualizationPage.tsx` – project-scoped editor/import workflow.
- `src/features/NetworkEditor/NetworkGraph.tsx` – Cytoscape orchestration, save flows, rule integration.
- `src/features/NetworkEditor/AttractorGraph.tsx` – interactive attractor visualization with tooltips and zoom.
- `src/hooks/useProjectNetworks.ts`, `src/hooks/useNetworkData.ts`, `src/hooks/useDeterministicAnalysis.ts`, `src/hooks/useWeightedAnalysis.ts`, `src/hooks/useProbabilisticAnalysis.ts` – primary data/analysis hooks.
- `src/lib/deterministicAnalysis.ts`, `src/lib/analysis/index.ts`, `src/lib/analysis/probabilisticAnalysis.ts` – rule-based, weighted, and probabilistic analysis entry points.
- `src/lib/format.ts` – shared date/time formatting utilities (formatDate, formatDateLong, formatRelativeTime, formatTimestamp).

If anything here seems off or incomplete (e.g., Supabase schemas, expected JSON shapes), ask the human for confirmation or sample payloads and align the implementation accordingly.

## Database Schema
- `projects` table:
  - id: uuid (primary key)
  - name: text
  - assignees: uuid[] (default '{}')
  - created_at: timestamptz (default now())
  - created_by: uuid (default auth.uid())
  - creator_email: text
  - networks: uuid[] (ordered list of network IDs)
- `networks` table:
  - id: uuid (primary key)
  - name: text
  - network_data: jsonb (shape: { nodes: [], edges: [], rules?: [], metadata?: {} })
  - created_at: timestamptz (default now())
