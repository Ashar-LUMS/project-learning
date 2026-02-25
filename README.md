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
- **3D Landscapes** – Plotly.js-powered attractor and probabilistic energy landscapes with Sammon mapping
- **Cell Fate Classification** – Manual attractor annotation with custom labels, colors, and gene markers
- **Therapeutics Panel** – Knock-In/Knock-Out interventions for modeling treatments
- **Network Merging** – Combine multiple networks with configurable conflict resolution strategies
- **Case Studies** – Load pre-built biological network examples from the samples database
- **Network Personalization** – Personalize networks using GDC cancer data
- **Patient Drug Scores** – Calculate patient-specific drug scores from multi-omics data
- **Multi-Format Import/Export** – Support for CSV, TXT, SIF, and SBML-qual formats

### Sequencing Analysis
- **RNA-Seq Integration** – Upload FASTQ files for gene expression analysis linked to networks
- **Exome-Seq Integration** – Analyze tumor exome sequencing data with variant calling support

### Navigation Tabs
| Tab | Description |
|-----|-------------|
| Projects | Browse and manage analysis projects |
| RNA-Seq Analysis | RNA-Seq data upload and processing |
| Exome-Seq Analysis | Exome sequencing analysis pipeline |
| Network Inference | AI-powered rule inference from network topology |
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
- **Merge Network Dialog** – Visual interface for merging networks with conflict preview

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7
- **Styling:** Tailwind CSS 4, shadcn/ui components
- **Graph Visualization:** Cytoscape.js (with edgehandles)
- **3D Visualization:** Plotly.js, React Force Graph
- **Backend:** Supabase (Auth + PostgreSQL)
- **Forms:** React Hook Form + Zod validation
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
├── config/
│   ├── constants.ts                # Application-wide constants & feature flags
│   └── adminSettings.ts            # Admin panel configuration
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
│   │   ├── MergeNetworkDialog.tsx      # Network merging with conflict resolution
│   │   ├── CaseStudyDialog.tsx         # Load pre-built network examples
│   │   ├── NetworkPersonalizationDialog.tsx  # GDC data personalization
│   │   ├── PatientDrugScoresDialog.tsx       # Patient-specific drug scoring
│   │   ├── RulesPage.tsx               # Boolean rule editor
│   │   └── tabs/
│   │       ├── ProjectTab.tsx          # Project browser
│   │       ├── SeqAnalysisTab.tsx      # RNA-Seq upload & results
│   │       ├── ExomeSeqTab.tsx         # Exome sequencing analysis
│   │       └── SeqAnalysisTabs.tsx     # Sequencing tabs wrapper
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
│   ├── useNetworkData.ts            # Single network data fetching
│   └── useCaseStudies.ts            # Case study samples fetching
├── lib/
│   ├── analysis/                     # Analysis engines
│   │   ├── index.ts                  # Barrel exports
│   │   ├── weightedDeterministicAnalysis.ts
│   │   ├── probabilisticAnalysis.ts
│   │   ├── matrixUtils.ts
│   │   ├── types.ts
│   │   └── README.md                 # Analysis module documentation
│   ├── deterministicAnalysis.ts      # Rule-based engine
│   ├── applyTherapies.ts             # Therapy modification utilities
│   ├── networkIO.ts                  # Import/export helpers (CSV, TXT, SIF, SBML-qual)
│   ├── rnaseqApi.ts                  # RNA-Seq microservice client
│   ├── openRouter.ts                 # LLM rule inference
│   ├── download.ts                   # File download utilities
│   ├── stateEncoding.ts              # State encoding utilities
│   ├── sessionLock.ts                # Session management
│   └── format.ts                     # Date/time formatting utilities
├── layouts/
│   └── AppLayout.tsx                 # Main app shell with routing
├── types/
│   ├── network.ts                    # Network, CellFate, TherapeuticIntervention types
│   ├── cytoscape-edgehandle.d.ts     # Cytoscape edgehandles types
│   ├── plotly.d.ts                   # Plotly types
│   └── global.d.ts                   # Global type declarations
└── config/
    └── constants.ts                  # Analysis caps, API config, feature flags
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
- 20-node cap for full state space exploration (configurable via `ANALYSIS_CONFIG`)

### Weighted Analysis
- Matrix-based with weighted adjacency representation
- Configurable tie-breaking (`zero-as-zero`, `zero-as-one`, `hold`)
- Per-node bias support
- Threshold multiplier for activation sensitivity

### Probabilistic Analysis
- Markovian dynamics with configurable parameters
- Noise parameter (µ) for stochastic transitions (default: 0.25)
- Self-degradation parameter (c) for decay modeling (default: 0.1)
- Stationary distribution computation with configurable iterations and tolerance
- Up to 200 nodes supported

### Analysis Configuration
Defined in `src/config/constants.ts`:
- `DEFAULT_STATE_CAP`: 2^20 (~1.05M states)
- `MAX_NODES_DETERMINISTIC`: 20 nodes
- `MAX_NODES_PROBABILISTIC`: 200 nodes

For API details, see [src/lib/analysis/README.md](src/lib/analysis/README.md)

## Data Model

Networks are stored in Supabase with the following structure:

```typescript
// networks table → network_data JSONB column
{
  nodes: Array<{ id: string; label?: string; properties?: { bias?: number; position?: { x: number; y: number } } }>,
  edges: Array<{ source: string; target: string; weight?: number; interaction?: string }>,
  rules?: Array<{ name: string; enabled?: boolean; action?: string }>,
  metadata?: {
    type?: 'Weight Based' | 'Rule Based',
    tieBehavior?: 'zero-as-zero' | 'zero-as-one' | 'hold',
    thresholdMultiplier?: number,
    cellFates?: Record<string, CellFate>,
    importFormat?: 'CSV' | 'TXT' | 'SIF' | 'SBML-qual',
    importedAt?: string,
  }
}

// CellFate interface
interface CellFate {
  name: string;           // Required: Fate label (e.g., "Stem Cell")
  color: string;          // Required: Hex color code
  markers?: string[];     // Optional: Gene/node markers
  confidence?: number;    // Optional: Classification confidence (0-1)
  description?: string;   // Optional: Additional notes
}

// TherapeuticIntervention interface
interface TherapeuticIntervention {
  id: string;
  type: 'knock-in' | 'knock-out';
  nodeName: string;
  nodeRule: string | null;
  fixedValue: 0 | 1 | null;
  outwardRegulations: Array<{
    targetNode: string;
    operator: '&&' | '||';
    addition: string;
    originalRule?: string;
  }>;
  timestamp: number;
}
```

### Supported Import/Export Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| CSV (Weight-based) | `.csv` | Custom format with nodes, edges, positions, and network type marker |
| TXT (Rule-based) | `.txt` | Boolean expression rules (`NodeA = NodeB && !NodeC`) |
| SIF (Cytoscape) | `.sif` | Simple Interaction Format with activates/inhibits |
| SBML-qual | `.sbml`, `.xml` | Systems Biology Markup Language for qualitative models |

## Contributing

1. Follow the conventions in `.github/copilot-instructions.md`
2. Use the `@` path alias for imports (e.g., `@/hooks/...`, `@/lib/...`)
3. Keep Cytoscape edge IDs deterministic (`edge:${source}:${target}`)
4. Run `npm run build` and `npm run test` before committing
5. Preserve `{ nodes, edges, rules?, metadata? }` structure for network data
6. Use lucide-react for icons; avoid custom SVGs
7. Use `src/lib/format.ts` utilities for date formatting

## Database Schema

### Tables

**projects**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Project name |
| assignees | uuid[] | Assigned user IDs |
| created_at | timestamptz | Creation timestamp |
| created_by | uuid | Creator user ID |
| creator_email | text | Creator email |
| networks | uuid[] | Ordered list of network IDs |

**networks**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Network name |
| network_data | jsonb | Network structure (nodes, edges, rules, metadata) |
| created_at | timestamptz | Creation timestamp |

**samples** (Case Studies)
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| created_at | timestamptz | Creation timestamp |
| name | text | Sample name |
| network | jsonb | NetworkData structure |

## License

[Your License Here]
