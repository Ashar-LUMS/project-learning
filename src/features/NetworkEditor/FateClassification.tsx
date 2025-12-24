import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tag, X } from 'lucide-react';
import type { CellFate } from '@/types/network';

interface FateClassificationDialogProps {
  attractorId: number;
  currentFate?: CellFate;
  availableMarkers: string[];
  onSave: (fate: CellFate) => void;
  onRemove?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function FateClassificationDialog({
  attractorId: _attractorId,
  currentFate,
  availableMarkers,
  onSave,
  onRemove,
  open,
  onOpenChange,
}: FateClassificationDialogProps) {
  const [name, setName] = useState(currentFate?.name || '');
  const [color, setColor] = useState(currentFate?.color || PRESET_COLORS[0]);
  const [description, setDescription] = useState(currentFate?.description || '');
  const [selectedMarkers, setSelectedMarkers] = useState<string[]>(currentFate?.markers || []);
  const [markerInput, setMarkerInput] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;

    const fate: CellFate = {
      name: name.trim(),
      color,
      markers: selectedMarkers.length > 0 ? selectedMarkers : undefined,
      description: description.trim() || undefined,
    };

    onSave(fate);
    onOpenChange(false);
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
      onOpenChange(false);
    }
  };

  const addMarker = (marker: string) => {
    const trimmed = marker.trim();
    if (trimmed && !selectedMarkers.includes(trimmed)) {
      setSelectedMarkers([...selectedMarkers, trimmed]);
      setMarkerInput('');
    }
  };

  const removeMarker = (marker: string) => {
    setSelectedMarkers(selectedMarkers.filter(m => m !== marker));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Classify Cell Fate</DialogTitle>
          <DialogDescription>
            Label this attractor as a specific cell fate or phenotype.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fate Name */}
          <div className="space-y-2">
            <Label htmlFor="fate-name">Fate Name *</Label>
            <Input
              id="fate-name"
              placeholder="e.g., Stem Cell, Neuron, Apoptotic"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className={`w-8 h-8 rounded-md border-2 transition-all ${
                    color === presetColor ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                  aria-label={`Select color ${presetColor}`}
                />
              ))}
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-8 p-1 cursor-pointer"
              />
            </div>
          </div>

          {/* Markers */}
          <div className="space-y-2">
            <Label htmlFor="markers">Marker Nodes (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="markers"
                placeholder="Type node name"
                value={markerInput}
                onChange={(e) => setMarkerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addMarker(markerInput);
                  }
                }}
                list="marker-suggestions"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addMarker(markerInput)}
                disabled={!markerInput.trim()}
              >
                Add
              </Button>
            </div>
            <datalist id="marker-suggestions">
              {availableMarkers.map((marker) => (
                <option key={marker} value={marker} />
              ))}
            </datalist>
            {selectedMarkers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedMarkers.map((marker) => (
                  <Badge key={marker} variant="secondary" className="gap-1">
                    {marker}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeMarker(marker)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Biological characteristics, expression patterns, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {currentFate && onRemove && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              className="mr-auto"
            >
              Remove Label
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!name.trim()}>
            Save Fate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AttractorFateBadgeProps {
  fate: CellFate;
  onEdit?: () => void;
}

export function AttractorFateBadge({ fate, onEdit }: AttractorFateBadgeProps) {
  return (
    <Badge
      className="gap-1 cursor-pointer hover:opacity-80 transition-opacity"
      style={{
        backgroundColor: fate.color,
        color: '#fff',
        borderColor: fate.color,
      }}
      onClick={onEdit}
    >
      <Tag className="w-3 h-3" />
      {fate.name}
    </Badge>
  );
}
