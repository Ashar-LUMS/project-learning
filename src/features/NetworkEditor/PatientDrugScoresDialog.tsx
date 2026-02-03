import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PatientDrugScoresDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientDrugScoresDialog({ open, onOpenChange }: PatientDrugScoresDialogProps) {
  
  const [cancerType, setCancerType] = useState<string>('');
  const [normalizationCohort, setNormalizationCohort] = useState<string>('');
  const [drugStatus, setDrugStatus] = useState({
    approved: false,
    clinicalTrials: false,
    experimental: false,
  });
  const [interactionType, setInteractionType] = useState({
    directTarget: false,
    biomarker: false,
    pathwayMember: false,
    geneDependency: false,
  });
  const [rnaSeqFile, setRnaSeqFile] = useState<File | null>(null);
  const [mutationFile, setMutationFile] = useState<File | null>(null);
  const [copyNumberFile, setCopyNumberFile] = useState<File | null>(null);

  const handleCalculate = () => {
    // TODO: Implement drug score calculation
    toast.info('Feature Coming Soon', {
      description: 'Drug score calculation will be implemented soon.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold">Patient-Specific Drug Scores</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Information Section */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-50">Patient Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cancer-type" className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
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
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="normalization-cohort" className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
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
                  <option value="custom">Custom Cohort</option>
                </select>
              </div>
            </div>
          </div>

          {/* Drug Filters Section */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-50">Drug Filters</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Drug Status */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Drug Status</Label>
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="approved"
                      checked={drugStatus.approved}
                      onChange={(e) => setDrugStatus({ ...drugStatus, approved: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    />
                    <label htmlFor="approved" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      Approved
                    </label>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="clinical-trials"
                      checked={drugStatus.clinicalTrials}
                      onChange={(e) => setDrugStatus({ ...drugStatus, clinicalTrials: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    />
                    <label htmlFor="clinical-trials" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      Clinical Trials
                    </label>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="experimental"
                      checked={drugStatus.experimental}
                      onChange={(e) => setDrugStatus({ ...drugStatus, experimental: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    />
                    <label htmlFor="experimental" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      Experimental
                    </label>
                  </div>
                </div>
              </div>

              {/* Interaction Type */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Interaction Type</Label>
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="direct-target"
                      checked={interactionType.directTarget}
                      onChange={(e) => setInteractionType({ ...interactionType, directTarget: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    />
                    <label htmlFor="direct-target" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      Direct Target
                    </label>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="biomarker"
                      checked={interactionType.biomarker}
                      onChange={(e) => setInteractionType({ ...interactionType, biomarker: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    />
                    <label htmlFor="biomarker" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      Biomarker
                    </label>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="pathway-member"
                      checked={interactionType.pathwayMember}
                      onChange={(e) => setInteractionType({ ...interactionType, pathwayMember: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    />
                    <label htmlFor="pathway-member" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      Pathway Member
                    </label>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="gene-dependency"
                      checked={interactionType.geneDependency}
                      onChange={(e) => setInteractionType({ ...interactionType, geneDependency: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    />
                    <label htmlFor="gene-dependency" className="text-sm cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      Gene-Dependency
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-50">Upload Genomic Data</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                <Label htmlFor="rna-seq-file" className="text-sm font-medium min-w-fit">
                  RNA-seq Expression (.tsv):
                </Label>
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

              <div className="flex items-center gap-3 p-3 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                <Label htmlFor="mutation-file" className="text-sm font-medium min-w-fit">
                  Somatic Mutation (.maf):
                </Label>
                <input
                  type="file"
                  id="mutation-file"
                  accept=".maf"
                  onChange={(e) => setMutationFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
                {!mutationFile && <span className="text-xs text-slate-500 dark:text-slate-400">No file chosen</span>}
                {mutationFile && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{mutationFile.name}</span>}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                <Label htmlFor="copy-number-file" className="text-sm font-medium min-w-fit">
                  Copy Number Alteration (.tsv):
                </Label>
                <input
                  type="file"
                  id="copy-number-file"
                  accept=".tsv"
                  onChange={(e) => setCopyNumberFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
                {!copyNumberFile && <span className="text-xs text-slate-500 dark:text-slate-400">No file chosen</span>}
                {copyNumberFile && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{copyNumberFile.name}</span>}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="px-6"
          >
            Close
          </Button>
          <Button 
            onClick={handleCalculate}
            className="px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Calculate Scores
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
