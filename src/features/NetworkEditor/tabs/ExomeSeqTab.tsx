"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { downloadTextAsFile } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileUp,
  RefreshCw,
  XCircle,
  AlertCircle,
  Play,
} from "lucide-react";
import type { ProjectNetworkRecord } from '@/hooks/useProjectNetworks';
import type { NetworkNode } from "@/types/network";

interface ExomeSeqTabProps {
  networkNodes?: NetworkNode[];
  networks?: ProjectNetworkRecord[];
  onNetworkSelect?: (id: string) => void;
  selectedNetworkId?: string | null;
  projectId?: string | null;
  networkId?: string | null;
  networkName?: string | null;
}

interface FileInputState {
  file: File | null;
  error: string | null;
}

export function ExomeSeqTab({
  networkNodes = [],
  networks = [],
  onNetworkSelect: _onNetworkSelect,
  selectedNetworkId: _selectedNetworkId,
  projectId: _projectId,
  networkId: _networkId,
  networkName,
}: ExomeSeqTabProps) {
  void _onNetworkSelect;
  void _selectedNetworkId;
  void _projectId;
  void _networkId;
  void networkNodes;
  void networks;

  // Form state
  const [tumorFastq1, setTumorFastq1] = useState<FileInputState>({ file: null, error: null });
  const [tumorFastq2, setTumorFastq2] = useState<FileInputState>({ file: null, error: null });
  const [reference, setReference] = useState<FileInputState>({ file: null, error: null });
  const [targetsBed, setTargetsBed] = useState<FileInputState>({ file: null, error: null });

  const [analysisState, setAnalysisState] = useState<'idle'|'uploading'|'running'|'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes)/Math.log(1024));
    return `${(bytes/Math.pow(1024,i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleFileChange = useCallback((
    setter: React.Dispatch<React.SetStateAction<FileInputState>>, acceptPattern: RegExp, errorMessage: string
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && !file.name.match(acceptPattern)) {
      setter({ file: null, error: errorMessage });
    } else {
      setter({ file, error: null });
    }
  }, []);

  const handleTumorFastq1Change = useCallback(
    handleFileChange(setTumorFastq1, /(fastq|fq)\.gz$/i, "Must be a .fastq.gz or .fq.gz file"),
    [handleFileChange]
  );
  const handleTumorFastq2Change = useCallback(
    handleFileChange(setTumorFastq2, /(fastq|fq)\.gz$/i, "Must be a .fastq.gz or .fq.gz file"),
    [handleFileChange]
  );
  const handleTargetsBedChange = useCallback(
    handleFileChange(setTargetsBed, /(bed|bed\.gz)$/i, "Must be a .bed or .bed.gz file"),
    [handleFileChange]
  );
  const handleReferenceChange = useCallback(
    handleFileChange(setReference, /(fa|fasta)\.gz$/i, "Must be a .fa.gz or .fasta.gz file"),
    [handleFileChange]
  );

  const downloadFastqSample = useCallback((prefix: string) => {
    const content = [
      '@SEQ_ID',
      'GATTTGGGGTTCAAAGCAGTATCGATCAAATAGTAA',
      '+',
      'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII',
    ].join('\n') + '\n';
    downloadTextAsFile(`${prefix.toLowerCase()}_sample.fastq.gz`, content);
  }, []);

  const downloadFastaSample = useCallback(() => {
    const content = ['>chr1', 'ACGTACGTACGTACGTACGTACGTACGT'].join('\n') + '\n';
    downloadTextAsFile('sample_reference.fa.gz', content);
  }, []);

  const downloadBedSample = useCallback(() => {
    const content = ['chr1\t10000\t10100\tEXON1', 'chr1\t15000\t15100\tEXON2'].join('\n') + '\n';
    downloadTextAsFile('sample_targets.bed.gz', content);
  }, []);

  const totalFileSize = useMemo(() => {
    const sizes = [
      tumorFastq1.file?.size || 0,
      tumorFastq2.file?.size || 0,
      reference.file?.size || 0,
      targetsBed.file?.size || 0,
    ];
    return sizes.reduce((a, b) => a + b, 0);
  }, [tumorFastq1.file, tumorFastq2.file, reference.file, targetsBed.file]);

  const isFormValid =
    !!tumorFastq1.file &&
    !!tumorFastq2.file &&
    !!reference.file &&
    !!targetsBed.file &&
    !tumorFastq1.error &&
    !tumorFastq2.error &&
    !reference.error &&
    !targetsBed.error;

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) {
      setError('Please provide required tumor FASTQ pairs, reference genome, and exome target BED.');
      return;
    }
    setError(null);
    setAnalysisState('uploading');
    setUploadProgress(0);
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 400);
    // Placeholder: backend submission not implemented yet
    setTimeout(() => {
      clearInterval(progressInterval);
      setUploadProgress(100);
      setAnalysisState('failed');
      setError('Exome-seq pipeline integration is coming soon.');
    }, 2000);
  }, [isFormValid]);

  const handleReset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setTumorFastq1({ file: null, error: null });
    setTumorFastq2({ file: null, error: null });
    setReference({ file: null, error: null });
    setTargetsBed({ file: null, error: null });
    setAnalysisState('idle');
    setError(null);
    setUploadProgress(0);
  }, []);

  const isRunning = analysisState === 'uploading' || analysisState === 'running';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <Upload className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Exome-seq Analysis</h2>
            {networkName && (
              <p className="text-xs text-muted-foreground">
                Optional filtering by network genes: {networkName}
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
        {(analysisState === 'idle') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Exome Sequencing Data
              </CardTitle>
              <CardDescription>
                Provide tumor FASTQ pairs, reference genome and target regions for variant calling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tumor Reads (R1) */}
              <div className="space-y-2">
                <Label htmlFor="exome_tumor_r1" className="text-sm font-medium">
                  Tumor Reads (R1) <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="exome_tumor_r1"
                    type="file"
                    accept=".fastq.gz,.fq.gz"
                    onChange={handleTumorFastq1Change}
                    disabled={isRunning}
                    className={cn(tumorFastq1.error && "border-red-500")}
                  />
                  <Button variant="outline" size="sm" onClick={() => downloadFastqSample('tumor_R1')}>Sample</Button>
                  {tumorFastq1.file && (
                    <Badge variant="secondary" className="shrink-0">
                      {formatFileSize(tumorFastq1.file.size)}
                    </Badge>
                  )}
                </div>
                {tumorFastq1.error ? (
                  <p className="text-xs text-red-500">{tumorFastq1.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Tumor paired-end forward reads (.fastq.gz)</p>
                )}
              </div>

              {/* Tumor Reads (R2) */}
              <div className="space-y-2">
                <Label htmlFor="exome_tumor_r2" className="text-sm font-medium">
                  Tumor Reads (R2) <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="exome_tumor_r2"
                    type="file"
                    accept=".fastq.gz,.fq.gz"
                    onChange={handleTumorFastq2Change}
                    disabled={isRunning}
                    className={cn(tumorFastq2.error && "border-red-500")}
                  />
                  <Button variant="outline" size="sm" onClick={() => downloadFastqSample('tumor_R2')}>Sample</Button>
                  {tumorFastq2.file && (
                    <Badge variant="secondary" className="shrink-0">
                      {formatFileSize(tumorFastq2.file.size)}
                    </Badge>
                  )}
                </div>
                {tumorFastq2.error ? (
                  <p className="text-xs text-red-500">{tumorFastq2.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Tumor paired-end reverse reads (.fastq.gz)</p>
                )}
              </div>

              <Separator />

              {/* Reference Genome */}
              <div className="space-y-2">
                <Label htmlFor="exome_reference" className="text-sm font-medium">
                  Reference Genome <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="exome_reference"
                    type="file"
                    accept=".fa.gz,.fasta.gz"
                    onChange={handleReferenceChange}
                    disabled={isRunning}
                    className={cn(reference.error && "border-red-500")}
                  />
                  <Button variant="outline" size="sm" onClick={downloadFastaSample}>Sample</Button>
                  {reference.file && (
                    <Badge variant="secondary" className="shrink-0">{formatFileSize(reference.file.size)}</Badge>
                  )}
                </div>
                {reference.error ? (
                  <p className="text-xs text-red-500">{reference.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Reference FASTA file (.fa.gz)</p>
                )}
              </div>

              {/* Target Regions BED */}
              <div className="space-y-2">
                <Label htmlFor="exome_targets" className="text-sm font-medium">
                  Exome Targets (BED) <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="exome_targets"
                    type="file"
                    accept=".bed,.bed.gz"
                    onChange={handleTargetsBedChange}
                    disabled={isRunning}
                    className={cn(targetsBed.error && "border-red-500")}
                  />
                  <Button variant="outline" size="sm" onClick={downloadBedSample}>Sample</Button>
                  {targetsBed.file && (
                    <Badge variant="secondary" className="shrink-0">{formatFileSize(targetsBed.file.size)}</Badge>
                  )}
                </div>
                {targetsBed.error ? (
                  <p className="text-xs text-red-500">{targetsBed.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Target regions for capture (.bed)</p>
                )}
              </div>

              {/* Submit */}
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
                <Button onClick={handleSubmit} disabled={!isFormValid || isRunning} className="gap-2">
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
                  <div className="bg-violet-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Uploading {formatFileSize(totalFileSize)} of sequencing data...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Failed */}
        {analysisState === 'failed' && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <XCircle className="w-4 h-4" />
                Analysis Not Available Yet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error || 'Integration pending'}</p>
              </div>
              <Button onClick={handleReset} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset Form
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default ExomeSeqTab;
