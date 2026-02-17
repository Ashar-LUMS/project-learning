"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  FileUp,
  Play,
  RefreshCw,
  Download,
  Dna,
  BarChart3,
} from "lucide-react";
import {
  submitRNASeqAnalysis,
  checkRNASeqStatus,
  getRNASeqResults,
  validateRNASeqFiles,
  formatFileSize,
  type RNASeqJobStatus,
  type RNASeqResults,
  type NormalizedGene,
  RNASeqApiError,
} from "@/lib/rnaseqApi";
import { downloadTextAsFile } from "@/lib/download";
import type { ProjectNetworkRecord } from '@/hooks/useProjectNetworks';
import type { NetworkNode } from "@/types/network";

interface SeqAnalysisTabProps {
  /** Network nodes to filter results by (only genes present in network are shown) */
  networkNodes?: NetworkNode[];
  /** Optional list of networks in the current project so user can pick one before analysis */
  networks?: ProjectNetworkRecord[];
  /** Callback to select a network in the project context */
  onNetworkSelect?: (id: string) => void;
  /** Current selected network id from project context */
  selectedNetworkId?: string | null;
  /** Optional project ID for context */
  projectId?: string | null;
  /** Optional network ID for context (legacy) */
  networkId?: string | null;
  /** Optional network name for display */
  networkName?: string | null;
}

interface FileInputState {
  file: File | null;
  error: string | null;
}

type AnalysisState = 
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'running'
  | 'completed'
  | 'failed';

const POLL_INTERVAL = 30000; // 30 seconds

export function SeqAnalysisTab({
  networkNodes = [],
  networks = [],
  onNetworkSelect: _onNetworkSelect,
  selectedNetworkId: propSelectedNetworkId,
  projectId: _projectId,
  networkId: _networkId,
  networkName,
}: SeqAnalysisTabProps) {
  // projectId, networkId, onNetworkSelect reserved for future use (network selection moved to sidebar)
  void _projectId;
  void _networkId;
  void _onNetworkSelect;
  const { showToast } = useToast();

  // Local selected network for the analysis tab. Prefers prop value when present.
  const [localSelectedNetworkId, setLocalSelectedNetworkId] = useState<string | null>(
    propSelectedNetworkId ?? _networkId ?? null
  );

  useEffect(() => {
    // Sync when parent selection changes
    setLocalSelectedNetworkId(propSelectedNetworkId ?? _networkId ?? null);
  }, [propSelectedNetworkId, _networkId]);

  // Resolve effective nodes to use for filtering: chosen network's nodes (if available) else provided `networkNodes` prop
  const effectiveNetworkNodes = useMemo<NetworkNode[]>(() => {
    if (localSelectedNetworkId && Array.isArray(networks) && networks.length > 0) {
      const found = networks.find(n => n.id === localSelectedNetworkId);
      if (found && found.data && Array.isArray(found.data.nodes)) return found.data.nodes;
    }
    return networkNodes || [];
  }, [localSelectedNetworkId, networks, networkNodes]);

  const localNetworkName = useMemo(() => {
    if (localSelectedNetworkId && Array.isArray(networks)) {
      return networks.find(n => n.id === localSelectedNetworkId)?.name ?? null;
    }
    return networkName ?? null;
  }, [localSelectedNetworkId, networks, networkName]);

  // Form state
  const [sampleName, setSampleName] = useState("");
  const [fastq1, setFastq1] = useState<FileInputState>({ file: null, error: null });
  const [fastq2, setFastq2] = useState<FileInputState>({ file: null, error: null });
  const [reference, setReference] = useState<FileInputState>({ file: null, error: null });
  const [annotation, setAnnotation] = useState<FileInputState>({ file: null, error: null });

  // Analysis state
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<RNASeqJobStatus | null>(null);
  const [results, setResults] = useState<RNASeqResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Polling ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Extract gene identifiers from network nodes for filtering results
  const networkGeneIds = useMemo(() => {
    const ids = new Set<string>();
    effectiveNetworkNodes.forEach(node => {
      // Add node id (usually the gene symbol or identifier)
      if (typeof node.id === 'string') ids.add(node.id.toLowerCase());
      // Add label if different from id
      if (node.label && typeof node.label === 'string' && node.label.toLowerCase() !== String(node.id).toLowerCase()) {
        ids.add(node.label.toLowerCase());
      }
    });
    return ids;
  }, [effectiveNetworkNodes]);

  // Filter results to only show genes present in the network
  const filteredResults = useMemo<NormalizedGene[]>(() => {
    if (!results?.genes || !Array.isArray(results.genes)) return [];
    // If no network nodes provided, return all genes
    if (networkGeneIds.size === 0) return results.genes;
    
    return results.genes.filter(gene => {
      // NormalizedGene always has gene_symbol and gene_id (may be empty strings)
      const symbol = gene.gene_symbol || '';
      const id = gene.gene_id || '';
      return (
        (symbol && networkGeneIds.has(symbol.toLowerCase())) ||
        (id && networkGeneIds.has(id.toLowerCase()))
      );
    });
  }, [results, networkGeneIds]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // File input handlers
  const handleFileChange = useCallback((
    setter: React.Dispatch<React.SetStateAction<FileInputState>>,
    acceptPattern: RegExp,
    errorMessage: string
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && !file.name.match(acceptPattern)) {
      setter({ file: null, error: errorMessage });
    } else {
      setter({ file, error: null });
    }
  }, []);

  const triggerFileInput = useCallback((id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.click();
  }, []);

  const handleFastq1Change = useCallback(
    handleFileChange(setFastq1, /\.(fastq|fq)\.gz$/i, "Must be a .fastq.gz or .fq.gz file"),
    [handleFileChange]
  );

  const handleFastq2Change = useCallback(
    handleFileChange(setFastq2, /\.(fastq|fq)\.gz$/i, "Must be a .fastq.gz or .fq.gz file"),
    [handleFileChange]
  );

  const handleReferenceChange = useCallback(
    handleFileChange(setReference, /\.(fa|fasta)\.gz$/i, "Must be a .fa.gz or .fasta.gz file"),
    [handleFileChange]
  );

  const handleAnnotationChange = useCallback(
    handleFileChange(setAnnotation, /\.(gff3|gtf)\.gz$/i, "Must be a .gff3.gz or .gtf.gz file"),
    [handleFileChange]
  );

  const downloadFastqSample = useCallback((r: 'R1'|'R2') => {
    const content = [
      '@SEQ_ID',
      'GATTTGGGGTTCAAAGCAGTATCGATCAAATAGTAA',
      '+',
      'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII',
    ].join('\n') + '\n';
    downloadTextAsFile(`sample_${r.toLowerCase()}.fastq.gz`, content);
  }, []);

  const downloadFastaSample = useCallback(() => {
    const content = ['>chr1', 'ACGTACGTACGTACGTACGTACGTACGT'].join('\n') + '\n';
    downloadTextAsFile('sample_reference.fa.gz', content);
  }, []);

  const downloadGff3Sample = useCallback(() => {
    const content = [
      '##gff-version 3',
      'chr1\tsource\tgene\t1000\t2000\t.\t+\t.\tID=gene1;Name=GENE1',
    ].join('\n') + '\n';
    downloadTextAsFile('sample_annotation.gff3.gz', content);
  }, []);

  // Validate all files
  const validateForm = useCallback(() => {
    const validation = validateRNASeqFiles({
      fastq1: fastq1.file,
      fastq2: fastq2.file,
      reference: reference.file,
      annotation: annotation.file,
    });
    return validation;
  }, [fastq1.file, fastq2.file, reference.file, annotation.file]);

  // Poll for job status
  const pollStatus = useCallback(async (id: string) => {
    try {
      const status = await checkRNASeqStatus(id);
      setJobStatus(status);

      if (status.state === 'completed') {
        // Stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        // Fetch results
        const jobResults = await getRNASeqResults(id);
        setResults(jobResults);
        setAnalysisState('completed');
        showToast({
          title: "Analysis Complete",
          description: `Found ${jobResults.gene_count} genes with ${jobResults.total_counts.toLocaleString()} total counts.`,
        });
      } else if (status.state === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setError(status.error_message || 'Analysis failed');
        setAnalysisState('failed');
        showToast({
          title: "Analysis Failed",
          description: status.error_message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error polling status:', err);
      // Don't stop polling on transient errors
    }
  }, [showToast]);

  // Submit analysis
  const handleSubmit = useCallback(async () => {
    const validation = validateForm();
    if (!validation.valid) {
      setError(validation.errors.join('. '));
      return;
    }

    setError(null);
    setAnalysisState('uploading');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      if (sampleName.trim()) {
        formData.append('sample_name', sampleName.trim());
      }
      formData.append('fastq_1', fastq1.file!);
      formData.append('fastq_2', fastq2.file!);
      formData.append('reference', reference.file!);
      formData.append('annotation', annotation.file!);

      // Simulate upload progress (since FormData doesn't provide progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await submitRNASeqAnalysis(formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      setJobId(response.job_id);
      setAnalysisState('running');
      setJobStatus({
        job_id: response.job_id,
        state: 'pending',
        progress_percent: 0,
        current_stage: 'Initializing...',
      });

      showToast({
        title: "Analysis Started",
        description: `Job ${response.job_id} submitted successfully. Polling for results...`,
      });

      // Start polling
      pollIntervalRef.current = setInterval(() => pollStatus(response.job_id), POLL_INTERVAL);
      // Initial poll
      pollStatus(response.job_id);

    } catch (err) {
      console.error('Error submitting analysis:', err);
      setError(err instanceof RNASeqApiError ? err.message : 'Failed to submit analysis');
      setAnalysisState('failed');
      showToast({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [validateForm, sampleName, fastq1.file, fastq2.file, reference.file, annotation.file, pollStatus, showToast]);

  // Reset form
  const handleReset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setSampleName("");
    setFastq1({ file: null, error: null });
    setFastq2({ file: null, error: null });
    setReference({ file: null, error: null });
    setAnnotation({ file: null, error: null });
    setAnalysisState('idle');
    setJobId(null);
    setJobStatus(null);
    setResults(null);
    setError(null);
    setUploadProgress(0);
  }, []);

  // Download results as CSV
  const handleDownloadResults = useCallback(() => {
    if (!filteredResults.length) return;

    const headers = ['Gene ID', 'Gene Symbol', 'Counts', 'TPM', 'FPKM'];
    const rows = filteredResults.map(g => [
      g.gene_id || '',
      g.gene_symbol || '',
      g.counts.toString(),
      g.tpm !== null ? g.tpm.toFixed(2) : 'N/A',
      g.fpkm !== null ? g.fpkm.toFixed(2) : 'N/A',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rnaseq_results_${sampleName || 'sample'}_filtered.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredResults, sampleName]);

  // Calculate total file size
  const totalFileSize = useMemo(() => {
    const sizes = [
      fastq1.file?.size || 0,
      fastq2.file?.size || 0,
      reference.file?.size || 0,
      annotation.file?.size || 0,
    ];
    return sizes.reduce((a, b) => a + b, 0);
  }, [fastq1.file, fastq2.file, reference.file, annotation.file]);

  const isFormValid = fastq1.file && fastq2.file && reference.file && annotation.file &&
    !fastq1.error && !fastq2.error && !reference.error && !annotation.error;

  const isRunning = analysisState === 'uploading' || analysisState === 'running';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10">
            <Dna className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">RNA-seq Analysis</h2>
            {localNetworkName && (
              <p className="text-xs text-muted-foreground">
                Filtering results for: {localNetworkName}
              </p>
            )}
          </div>
        </div>
        {analysisState !== 'idle' && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Form Section */}
        {(analysisState === 'idle' || analysisState === 'validating') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Sequencing Data
              </CardTitle>
              <CardDescription>
                Upload paired-end FASTQ files along with reference genome and annotation for RNA-seq analysis.
                FASTQ files can be large (1-50 GB) - analysis typically takes 1-4 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sample Name */}
              <div className="space-y-2">
                <Label htmlFor="sample_name" className="text-sm font-medium">
                  Sample Name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="sample_name"
                  placeholder="e.g., patient_001"
                  value={sampleName}
                  onChange={(e) => setSampleName(e.target.value)}
                  disabled={isRunning}
                />
              </div>

              <Separator />

              {/* Forward Reads (R1) */}
              <div className="space-y-2">
                <Label htmlFor="fastq_1" className="text-sm font-medium">
                  Forward Reads (R1) <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="fastq_1"
                    type="file"
                    accept=".fastq.gz,.fq.gz"
                    onChange={handleFastq1Change}
                    disabled={isRunning}
                    className="sr-only"
                  />
                  <Button variant="secondary" size="sm" onClick={() => triggerFileInput('fastq_1')}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose file
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadFastqSample('R1')} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download sample
                  </Button>
                  {fastq1.file && (
                    <Badge variant="secondary" className="shrink-0">
                      {formatFileSize(fastq1.file.size)}
                    </Badge>
                  )}
                </div>
                {fastq1.error ? (
                  <p className="text-xs text-red-500">{fastq1.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Paired-end forward reads (.fastq.gz)</p>
                )}
              </div>

              {/* Reverse Reads (R2) */}
              <div className="space-y-2">
                <Label htmlFor="fastq_2" className="text-sm font-medium">
                  Reverse Reads (R2) <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="fastq_2"
                    type="file"
                    accept=".fastq.gz,.fq.gz"
                    onChange={handleFastq2Change}
                    disabled={isRunning}
                    className="sr-only"
                  />
                  <Button variant="secondary" size="sm" onClick={() => triggerFileInput('fastq_2')}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose file
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadFastqSample('R2')} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download sample
                  </Button>
                  {fastq2.file && (
                    <Badge variant="secondary" className="shrink-0">
                      {formatFileSize(fastq2.file.size)}
                    </Badge>
                  )}
                </div>
                {fastq2.error ? (
                  <p className="text-xs text-red-500">{fastq2.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Paired-end reverse reads (.fastq.gz)</p>
                )}
              </div>

              <Separator />

              {/* Reference Genome */}
              <div className="space-y-2">
                <Label htmlFor="reference" className="text-sm font-medium">
                  Reference Genome <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="reference"
                    type="file"
                    accept=".fa.gz,.fasta.gz"
                    onChange={handleReferenceChange}
                    disabled={isRunning}
                    className="sr-only"
                  />
                  <Button variant="secondary" size="sm" onClick={() => triggerFileInput('reference')}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose file
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadFastaSample} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download sample
                  </Button>
                  {reference.file && (
                    <Badge variant="secondary" className="shrink-0">
                      {formatFileSize(reference.file.size)}
                    </Badge>
                  )}
                </div>
                {reference.error ? (
                  <p className="text-xs text-red-500">{reference.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Reference FASTA file (.fa.gz)</p>
                )}
              </div>

              {/* Annotation File */}
              <div className="space-y-2">
                <Label htmlFor="annotation" className="text-sm font-medium">
                  Gene Annotation <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="annotation"
                    type="file"
                    accept=".gff3.gz,.gtf.gz"
                    onChange={handleAnnotationChange}
                    disabled={isRunning}
                    className="sr-only"
                  />
                  <Button variant="secondary" size="sm" onClick={() => triggerFileInput('annotation')}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose file
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadGff3Sample} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download sample
                  </Button>
                  {annotation.file && (
                    <Badge variant="secondary" className="shrink-0">
                      {formatFileSize(annotation.file.size)}
                    </Badge>
                  )}
                </div>
                {annotation.error ? (
                  <p className="text-xs text-red-500">{annotation.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">GFF3 or GTF annotation file (.gff3.gz, .gtf.gz)</p>
                )}
              </div>

              {/* Total size and submit */}
              <Separator />

              {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {totalFileSize > 0 && (
                    <span>Total upload size: <strong>{formatFileSize(totalFileSize)}</strong></span>
                  )}
                </div>
                <Button 
                  onClick={handleSubmit}
                  disabled={!isFormValid || isRunning}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Progress */}
        {analysisState === 'uploading' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileUp className="w-4 h-4 animate-pulse" />
                Uploading Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Upload Progress</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Uploading {formatFileSize(totalFileSize)} of sequencing data...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Running Status */}
        {analysisState === 'running' && jobStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysis Running
              </CardTitle>
              <CardDescription>
                Job ID: {jobId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{jobStatus.current_stage || 'Processing...'}</span>
                  <span>{jobStatus.progress_percent}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${jobStatus.progress_percent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-muted-foreground text-xs">Status</p>
                  <p className="font-medium capitalize">{jobStatus.state}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-muted-foreground text-xs">Polling</p>
                  <p className="font-medium">Every 30s</p>
                </div>
              </div>

              <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  RNA-seq analysis typically takes 1-4 hours. You can leave this page and return later.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failed */}
        {analysisState === 'failed' && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <XCircle className="w-4 h-4" />
                Analysis Failed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error || 'Unknown error occurred'}</p>
              </div>
              <Button onClick={handleReset} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {analysisState === 'completed' && results && (
          <>
            {/* Summary Card */}
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Analysis Complete
                </CardTitle>
                <CardDescription>
                  Sample: {results.sample_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-md bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{results.gene_count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Genes</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{filteredResults.length.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">In Network</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{results.total_counts > 0 ? results.total_counts.toLocaleString() : 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">Total Counts</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50 text-center">
                    <p className="text-2xl font-bold">
                      {results.mapping_rate !== null && results.mapping_rate > 0 
                        ? `${(results.mapping_rate * 100).toFixed(1)}%` 
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">Mapping Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Table */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Expression Results (Network Genes Only)
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadResults}
                    disabled={filteredResults.length === 0}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV
                  </Button>
                </div>
                <CardDescription>
                  Showing {filteredResults.length} of {results.gene_count} genes that match nodes in your network
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredResults.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No matching genes found</p>
                    <p className="text-xs mt-1">
                      None of the {results.gene_count} detected genes match nodes in your network.
                      {networkNodes.length === 0 && " (No network loaded)"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[400px] border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background border-b">
                        <tr className="bg-muted/50">
                          <th className="text-left p-2 font-semibold">Gene Symbol</th>
                          <th className="text-left p-2 font-semibold">Gene ID</th>
                          <th className="text-right p-2 font-semibold">Counts</th>
                          <th className="text-right p-2 font-semibold">TPM</th>
                          <th className="text-right p-2 font-semibold">FPKM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((gene, idx) => (
                          <tr key={gene.gene_id || idx} className={cn("border-t", idx % 2 === 0 && "bg-muted/20")}>
                            <td className="p-2 font-medium">{gene.gene_symbol || '-'}</td>
                            <td className="p-2 text-muted-foreground font-mono text-xs">{gene.gene_id || '-'}</td>
                            <td className="p-2 text-right font-mono">{gene.counts.toLocaleString()}</td>
                            <td className="p-2 text-right font-mono">{gene.tpm !== null ? gene.tpm.toFixed(2) : '-'}</td>
                            <td className="p-2 text-right font-mono">{gene.fpkm !== null ? gene.fpkm.toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Network context warning */}
        {networkNodes.length === 0 && analysisState === 'idle' && (
          <div className="p-4 rounded-md bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              <strong>No network selected.</strong> Results will show all genes from the analysis.
              Select a network in the Network tab to filter results by genes present in your network.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SeqAnalysisTab;
