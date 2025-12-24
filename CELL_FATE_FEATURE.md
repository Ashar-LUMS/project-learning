# Cell Fate Classification Feature

## Overview
Manual attractor classification system for labeling attractors with biological cell fate identities. Enables researchers to annotate attractors with meaningful biological context.

## Implementation Summary

### Components Created

#### 1. FateClassificationDialog
**Location**: `src/features/NetworkEditor/FateClassification.tsx`

Full-featured modal dialog for classifying attractors:
- **Name input**: Required text field for fate label
- **Color picker**: 8 preset colors + custom hex input
- **Marker selection**: Autocomplete chip input for gene/node markers
- **Description**: Optional textarea for additional notes
- **Actions**: Save and Remove buttons

**Preset Colors**:
- Red (#ef4444), Amber (#f59e0b), Emerald (#10b981), Blue (#3b82f6)
- Violet (#8b5cf6), Pink (#ec4899), Cyan (#06b6d4), Lime (#84cc16)

#### 2. AttractorFateBadge
**Location**: `src/features/NetworkEditor/FateClassification.tsx`

Display component showing fate classification:
- Styled badge with custom color from fate
- Displays fate name with tag icon
- Clickable to edit (via onEdit prop)

### Data Model

#### CellFate Interface
**Location**: `src/types/network.ts`

```typescript
export interface CellFate {
  name: string;           // Required: Fate label (e.g., "Stem Cell")
  color: string;          // Required: Hex color code
  markers?: string[];     // Optional: Gene/node markers
  confidence?: number;    // Optional: Classification confidence (0-1)
  description?: string;   // Optional: Additional notes
}
```

#### Storage
**Location**: `network_data.metadata.cellFates`

Cell fates stored in Supabase as:
```typescript
NetworkData.metadata.cellFates: Record<string, CellFate>
```

Key = attractor ID (stringified), Value = CellFate object

### Integration

#### ProjectVisualizationPage Updates

**State Management**:
- `fateDialogOpen`: Controls dialog visibility
- `selectedAttractorId`: Tracks which attractor is being classified
- `cellFates`: Derived from `selectedNetwork.data.metadata.cellFates`

**Handlers**:
- `handleOpenFateDialog(attractorId)`: Opens dialog for specific attractor
- `handleSaveFate(fate)`: Saves fate to Supabase and updates local state
- `handleRemoveFate()`: Removes classification from attractor

**UI Integration**:
Attractor cards now display:
1. **AttractorFateBadge** (if classified) - shows fate label with color
2. **Classify/Edit button** - opens dialog
3. Both integrated into rule-based and weighted analysis result cards

### User Workflow

1. **Run Analysis**: User performs weighted or rule-based deterministic analysis
2. **View Attractors**: Results display attractor cards with period, basin size, states
3. **Classify**:
   - Click "Classify" button on unclassified attractor
   - Fill in fate name (required)
   - Select color from presets or enter custom hex
   - Optionally add markers and description
   - Click Save
4. **Display**: Fate badge appears on attractor card
5. **Edit**: Click badge or "Edit" button to modify classification
6. **Remove**: Click Remove button in dialog to delete classification

### Persistence

- **Save location**: `networks` table → `network_data` JSONB column → `metadata.cellFates`
- **Format**: `{ "0": { name: "...", color: "...", ... }, "1": { ... } }`
- **Updates**: Optimistic UI update + Supabase mutation
- **Refresh**: Updates local networks array to trigger re-render

### Technical Details

**Available Markers**:
Populated from current network's node labels:
```typescript
availableMarkers={selectedNetwork?.data?.nodes?.map(n => n.label || String(n.id)) || []}
```

**Attractor Identification**:
Attractors keyed by their index (0, 1, 2, ...) from analysis results

**Type Safety**:
- Full TypeScript coverage
- CellFate interface enforces structure
- NetworkData.metadata properly typed

## Future Enhancements (Not Implemented)

### Phase 2: Auto-Classification
- ML-based classification using marker patterns
- Confidence scoring
- Bulk classification tools

### Phase 3: Advanced Features
- Import/export fate libraries
- Fate transition analysis
- Multi-network fate consistency checks
- Visualization enhancements (fate-colored attractors)

## Files Modified

1. `src/types/network.ts` - Added CellFate interface
2. `src/features/NetworkEditor/FateClassification.tsx` - New component (231 lines)
3. `src/features/NetworkEditor/ProjectVisualizationPage.tsx` - Integration + handlers
4. `src/features/NetworkEditor/layout.tsx` - Minor cleanup

## Build Status
✅ TypeScript compilation successful
✅ Production build: 629 KB gzipped
✅ No errors or warnings
