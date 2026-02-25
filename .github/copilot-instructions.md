## Purpose
Guidance for AI coding agents contributing to this Vite + React + TypeScript workspace. Priorities: the Network Editor, Supabase-backed persistence, and deterministic analyses (rule-based, weighted, and probabilistic).

## Architecture Overview
- UI stack: React 19 + Vite 7 + Tailwind 4 with shadcn-inspired primitives under `src/components/ui/*`.
- Routing: React Router (hash router) defined in `src/routes.tsx`. Auth pages live at the root, the `/app/*` shell is `src/layouts/AppLayout.tsx`, and admin-only routes sit under `/app/admin/*` guarded by `RequireAdmin`.
- Network tooling: `src/features/NetworkEditor/*` contains the shared layout (`layout.tsx`), the standalone editor (`NetworkEditorPage.tsx`), and the project-centric view (`ProjectVisualizationPage.tsx`). Both pages wire into the same sidebar contract and reuse `AttractorGraph.tsx` for attractor visualization.
- Visualization: `src/features/NetworkEditor/NetworkGraph.tsx` wraps Cytoscape (with edgehandles). The instance is created once and reconciled in place so edits diff against the live graph. Edges always render with ids of the form `edge:${source}:${target}` to keep updates deterministic.
- Admin & ancillary features: feature folders under `src/features/*` (auth, admin, services, profile, etc.) mostly consume Supabase directly or via small hooks.
- Configuration: `src/config/constants.ts` holds analysis caps, API settings, UI constants, feature flags, and error messages.

## UI/UX Patterns
- **Tab Navigation:** Only `enabledTabs` are rendered; `_futureTabs` kept for future use. Tab types defined in `layout.tsx`.
- **Analysis Buttons:** Grouped with visual hierarchy; primary actions vs utilities.
- **Error Messages:** Use `Alert` with `variant="destructive"` and actionable suggestions.
- **Toast Notifications:** Use `useToast` hook from `@/components/ui/toast`.
- **Date Formatting:** Use `src/lib/format.ts` utilities (formatDate, formatDateLong, formatRelativeTime, formatTimestamp).
- **Icons:** Use lucide-react; avoid custom SVGs.
- **Dialogs:** Use shadcn Dialog components with DialogContent, DialogHeader, DialogTitle, DialogFooter.
- **Forms:** Use React Hook Form + Zod validation where applicable.

## Data Model & Supabase
- Supabase client (`src/supabaseClient.ts`) expects `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and runs with `sessionStorage` in dev (no URL session detection).
- Tables:
  - `projects`: includes `networks uuid[]` that orders linked network ids, `assignees uuid[]` for assigned users.
  - `networks`: `network_data jsonb` shaped like `{ nodes: [], edges: [], rules?: [], metadata?: {} }`.
  - `samples`: Case study networks with `network jsonb` column for pre-built examples.
- Fetch pattern: read the project's `networks` array first, then `.in('id', ids)` from `networks`, finally reorder to match the original array (see `useProjectNetworks`).
- Weighted metadata: `network_data.metadata` may hold `tieBehavior`, `thresholdMultiplier`, `type` ('Weight Based' | 'Rule Based'), `importFormat`, `importedAt`, `cellFates`, etc.
- Per-node biases are stored under `node.properties.bias`.
- Node positions stored under `node.properties.position` as `{ x: number, y: number }`.
- Cell fates stored under `metadata.cellFates` as `Record<string, CellFate>` keyed by attractor ID.

## Network Editor Patterns
- Layout contract: `NetworkEditorLayout` owns navigation + sidebars. Pages pass `inferenceActions` (`run`, `runWeighted`, `runProbabilistic`, `download`, flags) so the layout can render “Perform DA” buttons without touching globals.
- Hooks glue:
  - `useProjectNetworks` keeps project networks ordered, exposes `selectNetwork`, and surfaces creation helpers via `setNetworks`.
  - `useNetworkData` fetches a single network row and logs diagnostic info if `network_data` is missing.
  - `useDeterministicAnalysis` parses editor text or stored rules, runs `performDeterministicAnalysis`, and exposes download + clear helpers.
  - `useWeightedAnalysis` wraps `performWeightedAnalysis` (from `src/lib/analysis`) with async state.
  - `useProbabilisticAnalysis` drives `performProbabilisticAnalysis` to collect PA parameters and surface results on the inference tab.
  - `useCaseStudies` fetches pre-built network examples from the `samples` table.
- Graph editing (`NetworkGraph.tsx`):
  - Maintains local node/edge drafts, reconciles Cytoscape elements, and offers weight/rule editing modes.
  - `getLiveWeightedConfig()` exposes unsaved nodes, edges, biases, and tie behavior so weighted analysis can prefer the live graph before falling back to persisted data.
  - Saves dedupe edges by source→target, preserves edge ids, and writes `{ nodes, edges, rules, metadata }` back to Supabase. “Save As New” also links the new id into the current project.
  - Rule editing uses `RuleBasedGraph.tsx`; applying a rule set toggles styling but preserves the weight-based layout for later.
- Project view (`ProjectVisualizationPage.tsx`): reuses the layout, supports network creation/import, optional rule inference via `lib/openRouter`, and routes weighted runs through the same normalization helper as the editor page.

## Network Editor Dialogs
- **CaseStudyDialog** (`CaseStudyDialog.tsx`): Load pre-built network examples from the `samples` table. Uses `useCaseStudies` hook.
- **MergeNetworkDialog** (`MergeNetworkDialog.tsx`): Merge two networks with configurable conflict resolution strategies for nodes (keep-first/keep-second/rename), edges (keep-first/keep-second/sum/average/max weights), and rules. Uses `mergeNetworks()` from `lib/networkIO`.
- **FateClassificationDialog** (`FateClassification.tsx`): Annotate attractors with cell fate labels, colors, gene markers, and descriptions.
- **KnockInDialog/KnockOutDialog**: Wizard-style dialogs for creating therapeutic interventions.
- **NetworkPersonalizationDialog** (`NetworkPersonalizationDialog.tsx`): Personalize networks using GDC cancer data with cancer type, sample type, and normalization cohort selection.
- **PatientDrugScoresDialog** (`PatientDrugScoresDialog.tsx`): Calculate patient-specific drug scores from multi-omics data.

## Sequencing Analysis Tabs
- **SeqAnalysisTab** (`tabs/SeqAnalysisTab.tsx`): RNA-Seq analysis with FASTQ file upload, job submission, status polling, and results display. Uses `lib/rnaseqApi.ts`.
- **ExomeSeqTab** (`tabs/ExomeSeqTab.tsx`): Exome sequencing analysis for tumor samples with variant calling.
- **SeqAnalysisTabs** (`tabs/SeqAnalysisTabs.tsx`): Wrapper component for sequencing analysis tabs.

## Network Import/Export
- **Supported formats**: CSV (weight-based), TXT (rule-based), SIF (Cytoscape), SBML-qual (Systems Biology)
- **Import/Export functions** in `src/lib/networkIO.ts`:
  - `importNetwork(fileContent, fileName)` – auto-detects format from extension/content
  - `exportNetwork(data, name, format?)` – exports to specified or auto-detected format
  - `mergeNetworks(base, overlay, options)` – combines networks with conflict resolution
  - `getMergePreview(base, overlay, options)` – preview merge results before applying
- **Format constants**: `SUPPORTED_IMPORT_FORMATS` and `SUPPORTED_EXPORT_FORMATS` for UI dropdowns

## Analysis Engines
- **Rule-based:** `src/lib/deterministicAnalysis.ts` (shunting-yard parser, 20 node cap)
- **Weighted:** `src/lib/analysis/weightedDeterministicAnalysis.ts` (matrix-based, configurable tie behavior)
- **Probabilistic:** `src/lib/analysis/probabilisticAnalysis.ts` (Markovian dynamics, up to 200 nodes)
- **Utilities:** `src/lib/analysis/matrixUtils.ts` for edge↔matrix conversion
- **Therapies:** `src/lib/applyTherapies.ts` for applying therapeutic interventions to networks
- **Tests:** `src/lib/__tests__` and `src/lib/analysis/__tests__`
- **Configuration:** `src/config/constants.ts` contains `ANALYSIS_CONFIG` with caps and defaults
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
- `src/features/NetworkEditor/AttractorLandscape.tsx` – 3D attractor landscape visualization with Plotly.
- `src/features/NetworkEditor/ProbabilisticLandscape.tsx` – probability/energy landscape plots.
- `src/features/NetworkEditor/TherapeuticsPanel.tsx` – therapeutic intervention management.
- `src/features/NetworkEditor/FateClassification.tsx` – cell fate classification dialog.
- `src/features/NetworkEditor/MergeNetworkDialog.tsx` – network merging with conflict resolution.
- `src/features/NetworkEditor/CaseStudyDialog.tsx` – load pre-built network examples.
- `src/features/NetworkEditor/tabs/SeqAnalysisTab.tsx` – RNA-Seq analysis tab.
- `src/features/NetworkEditor/tabs/ExomeSeqTab.tsx` – Exome sequencing tab.
- `src/hooks/useProjectNetworks.ts`, `src/hooks/useNetworkData.ts`, `src/hooks/useDeterministicAnalysis.ts`, `src/hooks/useWeightedAnalysis.ts`, `src/hooks/useProbabilisticAnalysis.ts`, `src/hooks/useCaseStudies.ts` – primary data/analysis hooks.
- `src/lib/deterministicAnalysis.ts`, `src/lib/analysis/index.ts`, `src/lib/analysis/probabilisticAnalysis.ts` – rule-based, weighted, and probabilistic analysis entry points.
- `src/lib/networkIO.ts` – network import/export and merge utilities.
- `src/lib/applyTherapies.ts` – therapy application utilities.
- `src/lib/rnaseqApi.ts` – RNA-Seq microservice client.
- `src/lib/format.ts` – shared date/time formatting utilities (formatDate, formatDateLong, formatRelativeTime, formatTimestamp).
- `src/config/constants.ts` – application-wide constants, analysis caps, and feature flags.

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
- `samples` table (Case Studies):
  - id: bigint (primary key)
  - created_at: timestamptz (default now())
  - name: text
  - network: jsonb (NetworkData structure)

## Type Definitions
Key types defined in `src/types/network.ts`:
- `NetworkNode`: { id, label?, type?, weight?, properties? }
- `NetworkEdge`: { source, target, interaction?, weight?, properties? }
- `Rule`: { name, enabled?, priority?, target?, condition?, action? }
- `CellFate`: { name, color, markers?, confidence?, description? }
- `TherapeuticIntervention`: { id, type, nodeName, nodeRule, fixedValue, outwardRegulations, timestamp }
- `NetworkData`: { nodes, edges, rules?, metadata? }
