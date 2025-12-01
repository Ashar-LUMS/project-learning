## Purpose
Guidance for AI coding agents contributing to this Vite + React + TypeScript app. Focus on the Network Editor, Supabase-backed data, and deterministic analysis (rule-based and weighted).

## Architecture Overview
- UI Stack: React 19 + Vite 7, Tailwind 4, shadcn-style UI in `src/components/ui/*`.
- Routing: React Router in `src/routes.tsx` under `/app/*`. Main shell is `src/layouts/AppLayout.tsx`.
- Feature focus: Network Editor in `src/features/NetworkEditor/*` with a shared sidebar `layout.tsx` and pages `NetworkEditorPage.tsx` and `ProjectVisualizationPage.tsx`.
- Visualization: Cytoscape (`src/features/NetworkEditor/NetworkGraph.tsx`) for network editing and `AttractorGraph.tsx` for attractor cycles.
- Analysis engines:
  - Rule-based: `src/lib/deterministicAnalysis.ts` (operators AND/OR/XOR/NAND/NOR/NOT, shunting-yard parser, synchronous updates).
  - Weighted: `src/lib/weightedDeterministicAnalysis.ts` (N×N weight matrix + optional biases, configurable tie behavior; returns the same result shape as rule-based).
- Hooks:
  - `useProjectNetworks`: loads/list-orders networks for a project and tracks selection.
  - `useDeterministicAnalysis`: runs rule-based analysis and encapsulates download behavior.

## Data Model & Supabase
- Client: `src/supabaseClient.ts` uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Dev uses sessionStorage, no URL-detection, so envs must be set.
- Tables referenced (project-side assumptions):
  - `projects`: has `networks uuid[]` linking to multiple networks.
  - `networks`: has `network_data jsonb` shaped like `{ nodes: [], edges: [], rules?: [] }`.
- Fetch pattern: Get project’s `networks[]`, then `.in('id', ids)` on `networks`, then re-order by project order (see `useProjectNetworks`).

## Network Editor Patterns
- Sidebar contract: `NetworkEditorLayout` exposes `inferenceActions` with:
  - `run` (rule-based), `runWeighted` (weighted), `download`, flags: `isRunning`, `isWeightedRunning`, `hasResult`.
  - Pages may pass one or both; layout renders “Perform DA” and “Perform Weighted DA” buttons conditionally.
- Unified results: Both analysis engines produce `DeterministicAnalysisResult`, enabling shared tables and `AttractorGraph` rendering.
- Graph editing flow (`NetworkGraph.tsx`):
  - Local add/delete nodes/edges in component state; "Save As New" inserts network row; "Update Current" writes `network_data` back.
  - Edgehandles plugin for drawing edges; selection panels on the right for node/edge properties (including weights).

## Conventions
- Path alias `@` → `src` (see `vite.config.ts`). Prefer absolute imports like `@/hooks/...`.
- Keep analysis logic in `src/lib/*` and UI in `src/features/*`.
- When adding inference sidebar actions, wire them via `inferenceActions` rather than window globals.
- Networks data shape is used widely; keep `{ nodes, edges, rules? }` stable when persisting to Supabase.

## Dev Workflows
- Install & run:
  - `npm run dev` → Vite dev server (HMR).
  - `npm run build` → typecheck (`tsc -b`) then `vite build`.
  - `npm run preview` → preview built app.
  - `npm run lint` → ESLint (flat config in `eslint.config.js`).
- Env setup: create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before launching.

## Extension Points & Examples
- Add a new inference mode: return `DeterministicAnalysisResult` and plug controls into `NetworkEditorPage.tsx`, then surface buttons via `inferenceActions`.
- Import flow example: `ProjectVisualizationPage.tsx` parses uploaded network JSON + optional rules; saves to `networks`, then appends ID into `projects.networks`.
- Weighted inputs: `NetworkEditorPage.tsx` parses CSV edges (`source,target,weight`) and optional biases; converts to matrix with `edgesToMatrix`.

## Gotchas
- Analysis caps: both engines cap state/step counts (defaults 2^17). Large networks may be truncated; UI surfaces warnings.
- Identifier resolution: rule-based parser maps labels/ids case-insensitively; ensure node ids in rules match or provide labels.
- Cytoscape lifecycle: `NetworkGraph` reinitializes on element count change; avoid expensive re-renders by batching edits.

## Key Files
- `src/features/NetworkEditor/layout.tsx` (sidebar + tabs contract)
- `src/features/NetworkEditor/NetworkEditorPage.tsx` (main editor + inference modes)
- `src/features/NetworkEditor/NetworkGraph.tsx` (Cytoscape editor)
- `src/hooks/useProjectNetworks.ts` / `src/hooks/useDeterministicAnalysis.ts`
- `src/lib/deterministicAnalysis.ts` / `src/lib/weightedDeterministicAnalysis.ts`

If anything here seems off or incomplete (e.g., table schemas, expected JSON shapes), tell the human to confirm or provide examples, and align the implementation accordingly.
