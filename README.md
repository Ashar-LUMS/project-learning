<div align="center">

# 🧬 TISON V2

### **Therapeutic Intervention Simulator for Oncological Networks**

*A comprehensive platform for Boolean network analysis in systems biology, with applications in cancer research and cell fate prediction*

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

---

**[📖 Documentation](#-documentation)** · **[🚀 Getting Started](#-getting-started)** · **[✨ Features](#-features)** · **[📊 Analysis Engines](#-analysis-engines)**

</div>

---

## 📋 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Analysis Engines](#-analysis-engines)
- [Data Model](#-data-model)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)
- [Citation](#-citation)

---

## 🎯 About

**TISON V2** is a web-based platform developed as part of a Master's thesis research project. It enables researchers and clinicians to:

- 🔬 **Model gene regulatory networks** using Boolean logic and weighted interactions
- 📈 **Analyze network dynamics** to identify stable states (attractors) and cell fate transitions
- 💊 **Simulate therapeutic interventions** such as gene knock-ins and knock-outs
- 🧪 **Integrate multi-omics data** including RNA-Seq and exome sequencing
- 🎯 **Compute patient-specific drug scores** for personalized medicine applications

Understanding the dynamics of gene regulatory networks is crucial for predicting cellular behavior and designing effective therapeutic strategies in cancer treatment.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🖥️ Network Editor
- Visual graph construction with **Cytoscape.js**
- Drag-and-drop node/edge creation
- Real-time weight and bias editing
- Rule-based and weight-based modes

</td>
<td width="50%">

### 📊 Analysis Modes
- **Rule-Based**: Boolean logic (AND, OR, NOT, XOR)
- **Weighted**: Matrix-based with tie-breaking
- **Probabilistic**: Markovian dynamics with noise

</td>
</tr>
<tr>
<td width="50%">

### 🎨 Visualization
- Interactive attractor graphs
- 3D energy landscapes with Plotly.js
- Sammon mapping projections
- Cell fate classification badges

</td>
<td width="50%">

### 💉 Therapeutics
- Knock-In/Knock-Out simulations
- Outward regulation modeling
- Therapy combination analysis
- Treatment response prediction

</td>
</tr>
<tr>
<td width="50%">

### 🧬 Sequencing Integration
- RNA-Seq FASTQ processing
- Exome sequencing analysis
- Variant calling support
- Gene expression normalization

</td>
<td width="50%">

### 📁 Data Management
- Multi-format import/export (CSV, SIF, SBML-qual)
- Network merging with conflict resolution
- Pre-built case study library
- GDC cancer data personalization

</td>
</tr>
<tr>
<td colspan="2">

### 🧠 AI Integration (AutoNetCan)
- **Direct Integration**: Seamless connection with [AutoNetCan (autonetcan.lums.edu.pk)](https://autonetcan.lums.edu.pk/)
- **Automated Network Generation**: Rapidly construct context-specific gene regulatory networks using AI
- **Rule Inference**: AI-powered extraction and inference of Boolean rules from extensive literature sources
- **Enhanced Modeling Workflow**: Streamlined process for building, validating, and analyzing complex oncological networks

</td>
</tr>
</table>

### 🎛️ Navigation Tabs

| Tab | Description |
|:---:|:---|
| 📂 **Projects** | Browse and manage analysis projects |
| 🧬 **RNA-Seq** | Upload and process RNA-Seq data |
| 🔬 **Exome-Seq** | Tumor exome sequencing pipeline |
| 🤖 **Network Inference** | AI-powered rule inference |
| ✏️ **Network Construction** | Visual network building |
| ⚡ **AutoNetCan** | Automated network generation |
| 📈 **Analysis** | Run analyses and view results |
| 💊 **Therapeutics** | Model drug interventions |

---

## ️ Tech Stack

<div align="center">

| Category | Technologies |
|:--------:|:-------------|
| **Frontend** | React 19 · TypeScript · Vite 7 |
| **Styling** | Tailwind CSS 4 · shadcn/ui · Framer Motion |
| **Visualization** | Cytoscape.js · Plotly.js · React Force Graph |
| **Backend** | Supabase (Auth + PostgreSQL) |
| **Forms** | React Hook Form · Zod |
| **Testing** | Vitest |

</div>

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **Supabase** account (for backend services)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/tison-v2.git
cd tison-v2

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

Configure your `.env.local`:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_RNASEQ_API_URL=your-rnaseq-service-url  # Optional
```

### Development

```bash
# Start development server with HMR
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

---

## 📊 Analysis Engines

TISON V2 provides three distinct analysis modes for different modeling scenarios:

### 1️⃣ Rule-Based Analysis

```
A = B && !C
D = (A || E) && F
```

- Boolean expressions with **AND, OR, NOT, XOR** operators
- Synchronous state updates using shunting-yard parser
- Full state space exploration for attractor identification

### 2️⃣ Weighted Analysis

- Matrix-based weighted adjacency representation
- **Tie-breaking strategies**: `zero-as-zero`, `zero-as-one`, `hold`
- Per-node bias support for activation thresholds
- Configurable threshold multipliers

### 3️⃣ Probabilistic Analysis

- **Markovian dynamics** with stochastic transitions
- Noise parameter (µ): controls transition randomness (default: 0.25)
- Self-degradation (c): models natural decay (default: 0.1)
- Stationary distribution computation
- Scalable analysis of complex oncological networks

📚 For detailed API documentation, see [Analysis Module README](src/lib/analysis/README.md)

---

## 📦 Data Model

### Network Structure

Networks are persisted in Supabase with the following JSONB schema:

```typescript
interface NetworkData {
  nodes: Array<{
    id: string;
    label?: string;
    properties?: {
      bias?: number;
      position?: { x: number; y: number };
    };
  }>;
  edges: Array<{
    source: string;
    target: string;
    weight?: number;
    interaction?: string;
  }>;
  rules?: Array<{
    name: string;
    enabled?: boolean;
    action?: string;
  }>;
  metadata?: {
    type?: 'Weight Based' | 'Rule Based';
    tieBehavior?: 'zero-as-zero' | 'zero-as-one' | 'hold';
    thresholdMultiplier?: number;
    cellFates?: Record<string, CellFate>;
    importFormat?: 'CSV' | 'TXT' | 'SIF' | 'SBML-qual';
  };
}
```

### Supported Formats

| Format | Extension | Use Case |
|:-------|:---------:|:---------|
| **CSV** | `.csv` | Weight-based networks with positions |
| **TXT** | `.txt` | Boolean rule expressions |
| **SIF** | `.sif` | Cytoscape Simple Interaction Format |
| **SBML-qual** | `.sbml` | Systems Biology Markup Language |

### Database Schema

<details>
<summary><b>📋 View Table Schemas</b></summary>

#### `projects`
| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | uuid | Primary key |
| `name` | text | Project name |
| `assignees` | uuid[] | Assigned user IDs |
| `created_at` | timestamptz | Creation timestamp |
| `created_by` | uuid | Creator user ID |
| `networks` | uuid[] | Ordered network IDs |

#### `networks`
| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | uuid | Primary key |
| `name` | text | Network name |
| `network_data` | jsonb | Network structure |
| `created_at` | timestamptz | Creation timestamp |

#### `samples`
| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | bigint | Primary key |
| `name` | text | Sample name |
| `network` | jsonb | Network data |

</details>

---

## 📖 Documentation

- 📘 **[Analysis Module](src/lib/analysis/README.md)** — Detailed API for analysis engines
- 📙 **[Copilot Instructions](.github/copilot-instructions.md)** — Development conventions and architecture
- 📗 **[Cell Fate Feature](CELL_FATE_FEATURE.md)** — Cell fate classification system

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. 📖 Review the conventions in [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
2. 🔀 Use the `@` path alias for imports (`@/hooks/...`, `@/lib/...`)
3. 🔗 Keep Cytoscape edge IDs deterministic (`edge:${source}:${target}`)
4. ✅ Run `npm run build` and `npm run test` before committing
5. 📦 Preserve `{ nodes, edges, rules?, metadata? }` structure
6. 🎨 Use `lucide-react` for icons
7. 📅 Use `src/lib/format.ts` for date formatting

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[Cytoscape.js](https://js.cytoscape.org/)** — Graph visualization library
- **[Plotly.js](https://plotly.com/javascript/)** — Interactive 3D visualization
- **[shadcn/ui](https://ui.shadcn.com/)** — Beautiful UI components
- **[Supabase](https://supabase.com/)** — Backend as a service
- **Research Advisors** — For guidance and support throughout this thesis

---

## 📚 Citation

If you use TISON V2 in your research, please cite:

```bibtex
@mastersthesis{tison2026,
  author  = {Your Name},
  title   = {TISON V2: A Therapeutic Intervention Simulator for Oncological Networks},
  school  = {Your University},
  year    = {2026},
  type    = {Master's Thesis}
}
```

---

<div align="center">

**Built with ❤️ for cancer research**

*Master's Thesis Project — 2026*

[⬆ Back to Top](#-tison-v2)

</div>
