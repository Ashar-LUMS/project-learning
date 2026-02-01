# TISON V2 – Boolean Network Analysis Platform

A React + TypeScript + Vite application for analyzing Boolean networks in systems biology, with a focus on cancer research and cell fate dynamics.

## Features

### Core Capabilities
- **Network Editor** – Visual graph construction with Cytoscape.js, supporting weighted edges and node biases
- **Deterministic Analysis** – Rule-based Boolean network analysis with shunting-yard parser
- **Weighted Analysis** – Matrix-based analysis with configurable tie-breaking and threshold multipliers
- **Probabilistic Analysis** – Markovian dynamics with noise (µ) and self-degradation (c) parameters
- **Attractor Visualization** – Interactive graphs showing fixed points and limit cycles
- **3D Landscapes** – Plotly.js-powered attractor and energy landscapes

### UI/UX Features
- **Organized Analysis Interface** – Grouped buttons with visual hierarchy and descriptive tooltips
- **Progress Indicators** – Animated feedback during long-running analyses
- **Keyboard Shortcuts** – Ctrl+Enter (Weighted), Ctrl+Shift+Enter (Probabilistic)
- **Actionable Error Messages** – Detailed suggestions for resolving analysis errors
- **Streamlined Navigation** – Only active tabs shown; future features hidden

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7
- **Styling:** Tailwind CSS 4, shadcn/ui components
- **Graph Visualization:** Cytoscape.js
- **3D Visualization:** Plotly.js
- **Backend:** Supabase (Auth + PostgreSQL)
- **Testing:** Vitest

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
```

### Development

```bash
# Start dev server with HMR
npm run dev

# Run tests
npm run test

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
├── components/ui/     # shadcn/ui primitives (Button, Dialog, Card, etc.)
├── features/
│   ├── NetworkEditor/ # Main network analysis workspace
│   │   ├── layout.tsx             # Tab navigation & sidebar
│   │   ├── NetworkEditorPage.tsx  # Analysis hub
│   │   ├── NetworkGraph.tsx       # Cytoscape editor
│   │   ├── AttractorGraph.tsx     # Attractor visualization
│   │   └── TherapeuticsPanel.tsx  # Intervention tools
│   ├── admin/         # Admin panel & user management
│   ├── auth/          # Login, signup, password reset
│   └── home/          # Project listing & management
├── hooks/             # React hooks for data & analysis
├── lib/
│   ├── analysis/      # Weighted & probabilistic engines
│   ├── deterministicAnalysis.ts  # Rule-based engine
│   └── format.ts      # Date/time formatting utilities
└── layouts/           # App shell & routing
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run Weighted Analysis |
| `Ctrl+Shift+Enter` | Open Probabilistic Analysis dialog |

## Analysis Engines

Three analysis modes are available:
- **Rule-Based** – Boolean expressions (AND, OR, NOT, XOR) with synchronous updates
- **Weighted** – Matrix-based with configurable tie-breaking and biases
- **Probabilistic** – Markovian dynamics with noise and self-degradation

For API details, see [src/lib/analysis/README.md](src/lib/analysis/README.md)

## Contributing

1. Follow the conventions in `.github/copilot-instructions.md`
2. Use the `@` path alias for imports
3. Keep Cytoscape edge IDs deterministic (`edge:${source}:${target}`)
4. Run `npm run build` and `npm run test` before committing

## License

[Your License Here]
