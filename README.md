# TISON V2 – Boolean Network Analysis Platform

A React + TypeScript + Vite application for analyzing Boolean networks in systems biology, with a focus on cancer research and cell fate dynamics.

## Features

### Core Capabilities
- **Network Editor** – Visual graph construction with Cytoscape.js, supporting weighted edges and node biases
- **Three Analysis Modes:**
  - **Rule-Based** – Boolean network analysis with shunting-yard parser (AND, OR, NOT, XOR)
  - **Weighted** – Matrix-based analysis with configurable tie-breaking and threshold multipliers
  - **Probabilistic** – Markovian dynamics with noise (µ) and self-degradation (c) parameters
- **Attractor Visualization** – Interactive graphs showing fixed points and limit cycles
- **3D Landscapes** – Plotly.js-powered attractor landscapes with Sammon mapping
- **Cell Fate Classification** – Manual attractor annotation with custom labels, colors, and gene markers
- **Therapeutics Panel** – Knock-In/Knock-Out interventions for modeling treatments
- **RNA-Seq Integration** – Upload FASTQ files for gene expression analysis linked to networks

### Navigation Tabs
| Tab | Description |
|-----|-------------|
| Projects | Browse and manage analysis projects |
| Seq Analysis | RNA-Seq data upload and processing |
| Manual Network Construction | Visual network building with Cytoscape.js |
| AutoNetCan | Automated network construction tools |
| Network Analysis | Run analyses and view attractor results |
| Therapeutics | Model drug interventions and perturbations |

### UI/UX Features
- **Tab-Based Workflow** – Streamlined navigation with only active tabs shown
- **Progress Indicators** – Animated feedback during long-running analyses
- **Keyboard Shortcuts** – Quick access to common analysis operations
- **Actionable Error Messages** – Detailed suggestions for resolving analysis errors
- **Collapsible Sidebars** – Context-sensitive panels for each workflow stage

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS 4, shadcn/ui components
- **Graph Visualization:** Cytoscape.js
- **3D Visualization:** Plotly.js
- **Backend:** Supabase (Auth + PostgreSQL)
- **Testing:** Vitest
- **Animations:** Framer Motion

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd app-ashar

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your Supabase credentials:
# VITE_SUPABASE_URL=your-supabase-url
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_RNASEQ_API_URL=your-rnaseq-service-url (optional)
```

### Development

```bash
# Start dev server with HMR
npm run dev

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/ui/        # shadcn/ui primitives (Button, Dialog, Card, etc.)
├── features/
│   ├── NetworkEditor/    # Main network analysis workspace
│   │   ├── layout.tsx                  # Tab navigation & sidebar management
│   │   ├── NetworkEditorPage.tsx       # Standalone editor & analysis hub
│   │   ├── ProjectVisualizationPage.tsx # Project-scoped network workflows
│   │   ├── NetworkGraph.tsx            # Cytoscape editor with weight/rule modes
│   │   ├── AttractorGraph.tsx          # Interactive attractor visualization
│   │   ├── AttractorLandscape.tsx      # 3D attractor landscape with Plotly
│   │   ├── ProbabilisticLandscape.tsx  # Probability/energy landscape plots
│   │   ├── FateClassification.tsx      # Cell fate classification dialog
│   │   ├── TherapeuticsPanel.tsx       # Intervention tools (therapies, targets)
│   │   ├── KnockInDialog.tsx           # Gene knock-in wizard
│   │   ├── KnockOutDialog.tsx          # Gene knock-out wizard
│   │   ├── RulesPage.tsx               # Boolean rule editor
│   │   └── tabs/
│   │       ├── ProjectTab.tsx          # Project browser
│   │       └── SeqAnalysisTab.tsx      # RNA-Seq upload & results
│   ├── admin/            # Admin panel & user management
│   ├── auth/             # Login, signup, password reset
│   ├── home/             # Project listing & creation
│   ├── profile/          # User profile management
│   └── services/         # External services integration
├── hooks/
│   ├── useDeterministicAnalysis.ts  # Rule-based analysis hook
│   ├── useWeightedAnalysis.ts       # Weighted analysis hook
│   ├── useProbabilisticAnalysis.ts  # Probabilistic analysis hook
│   ├── useProjectNetworks.ts        # Project network management
│   └── useNetworkData.ts            # Single network data fetching
├── lib/
│   ├── analysis/                     # Analysis engines
│   │   ├── weightedDeterministicAnalysis.ts
│   │   ├── probabilisticAnalysis.ts
│   │   ├── matrixUtils.ts
│   │   └── types.ts
│   ├── deterministicAnalysis.ts      # Rule-based engine
│   ├── applyTherapies.ts             # Therapy modification utilities
│   ├── networkIO.ts                  # Import/export helpers
│   ├── rnaseqApi.ts                  # RNA-Seq microservice client
│   ├── openRouter.ts                 # LLM rule inference
│   └── format.ts                     # Date/time formatting utilities
├── layouts/
│   └── AppLayout.tsx                 # Main app shell with routing
└── types/
    └── network.ts                    # Network & cell fate type definitions
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run Weighted Analysis |
| `Ctrl+Shift+Enter` | Open Probabilistic Analysis dialog |

## Analysis Engines

Three analysis modes are available:

### Rule-Based Analysis
- Boolean expressions with AND, OR, NOT, XOR operators
- Synchronous state updates
- Shunting-yard expression parser
- 18-node cap for full state space exploration

### Weighted Analysis
- Matrix-based with weighted adjacency representation
- Configurable tie-breaking (`zero-as-zero`, `zero-as-one`, `hold`)
- Per-node bias support
- Threshold multiplier for activation sensitivity

### Probabilistic Analysis
- Markovian dynamics with configurable parameters
- Noise parameter (µ) for stochastic transitions
- Self-degradation parameter (c) for decay modeling
- Stationary distribution computation

For API details, see [src/lib/analysis/README.md](src/lib/analysis/README.md)

## Data Model

Networks are stored in Supabase with the following structure:

```typescript
// networks table → network_data JSONB column
{
  nodes: Array<{ id: string; label?: string; properties?: { bias?: number } }>,
  edges: Array<{ source: string; target: string; weight?: number }>,
  rules?: Record<string, string>,
  metadata?: {
    tieBehavior?: 'zero-as-zero' | 'zero-as-one' | 'hold',
    thresholdMultiplier?: number,
    cellFates?: Record<string, CellFate>,
  }
}
```

## Contributing

1. Follow the conventions in `.github/copilot-instructions.md`
2. Use the `@` path alias for imports
3. Keep Cytoscape edge IDs deterministic (`edge:${source}:${target}`)
4. Run `npm run build` and `npm run test` before committing
5. Preserve `{ nodes, edges, rules?, metadata? }` structure for network data

## License

[Your License Here]
