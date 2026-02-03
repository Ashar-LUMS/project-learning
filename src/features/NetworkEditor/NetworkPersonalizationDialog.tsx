import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface NetworkPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NetworkPersonalizationDialog({ open, onOpenChange }: NetworkPersonalizationDialogProps) {
  
  const [cancerType, setCancerType] = useState<string>('');
  const [sampleType, setSampleType] = useState<'normal' | 'cancer'>('cancer');
  const [normalizationCohort, setNormalizationCohort] = useState<string>('');
  const [rnaSeqFile, setRnaSeqFile] = useState<File | null>(null);

  const handleApplyPersonalization = () => {
    if (!cancerType) {
      toast.error('Please select a cancer type', {
        description: 'Choose a cancer type to proceed',
      });
      return;
    }

    if (!normalizationCohort) {
      toast.error('Please select a normalization cohort', {
        description: 'Choose a normalization cohort project to proceed',
      });
      return;
    }

    toast.info('Network Personalization', {
      description: `Personalizing network with ${cancerType} ${sampleType} samples using ${normalizationCohort}${rnaSeqFile ? ` and ${rnaSeqFile.name}` : ''}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold">Personalize Network using GDC Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cancer Type Selection */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <Label htmlFor="cancer-type" className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Cancer Type
            </Label>
            <select
              id="cancer-type"
              value={cancerType}
              onChange={(e) => setCancerType(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select cancer type...</option>
              <option value="breast">Breast Cancer</option>
              <option value="lung">Lung Cancer</option>
              <option value="colon">Colorectal Cancer</option>
              <option value="prostate">Prostate Cancer</option>
              <option value="melanoma">Melanoma</option>
              <option value="leukemia">Leukemia</option>
              <option value="lymphoma">Lymphoma</option>
              <option value="glioblastoma">Glioblastoma</option>
              <option value="ovarian">Ovarian Cancer</option>
              <option value="pancreatic">Pancreatic Cancer</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Sample Type Selection */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <Label className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Sample Type</Label>
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2.5">
                <input
                  type="radio"
                  id="sample-normal"
                  name="sample-type"
                  value="normal"
                  checked={sampleType === 'normal'}
                  onChange={(e) => setSampleType(e.target.value as any)}
                  className="h-4 w-4 rounded-full border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
                <label htmlFor="sample-normal" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  Normal
                </label>
              </div>
              <div className="flex items-center space-x-2.5">
                <input
                  type="radio"
                  id="sample-cancer"
                  name="sample-type"
                  value="cancer"
                  checked={sampleType === 'cancer'}
                  onChange={(e) => setSampleType(e.target.value as any)}
                  className="h-4 w-4 rounded-full border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
                <label htmlFor="sample-cancer" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  Cancer
                </label>
              </div>
            </div>
          </div>


          {/* Normalization Cohort Selection */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <Label htmlFor="normalization-cohort" className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Normalization Cohort Project
            </Label>
            <select
              id="normalization-cohort"
              value={normalizationCohort}
              onChange={(e) => setNormalizationCohort(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select cohort project...</option>
              <option value="tcga">TCGA (The Cancer Genome Atlas)</option>
              <option value="icgc">ICGC (International Cancer Genome Consortium)</option>
              <option value="gtex">GTEx (Genotype-Tissue Expression)</option>
              <option value="ccle">CCLE (Cancer Cell Line Encyclopedia)</option>
              <option value="gdc">GDC (Genomic Data Commons)</option>
              <option value="custom">Custom Cohort</option>
            </select>
          </div>


          {/* RNA-seq Expression File Upload */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <Label htmlFor="rna-seq-file" className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Upload RNA-seq Expression File
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
              <input
                type="file"
                id="rna-seq-file"
                accept=".tsv"
                onChange={(e) => setRnaSeqFile(e.target.files?.[0] || null)}
                className="text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {!rnaSeqFile && <span className="text-xs text-slate-500 dark:text-slate-400">No file chosen</span>}
              {rnaSeqFile && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{rnaSeqFile.name}</span>}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Only .tsv files are supported</p>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="px-6"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleApplyPersonalization}
            className="px-6 text-white"
          >
            Apply Personalization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
