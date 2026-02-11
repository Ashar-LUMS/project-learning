"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
  const [sampleName, setSampleName] = useState("");
  const [hasMatchedNormal, setHasMatchedNormal] = useState(false);

  const [tumorFastq1, setTumorFastq1] = useState<FileInputState>({ file: null, error: null });
  const [tumorFastq2, setTumorFastq2] = useState<FileInputState>({ file: null, error: null });
  const [normalFastq1, setNormalFastq1] = useState<FileInputState>({ file: null, error: null });
  const [normalFastq2, setNormalFastq2] = useState<FileInputState>({ file: null, error: null });
  const [reference, setReference] = useState<FileInputState>({ file: null, error: null });
  const [targetsBed, setTargetsBed] = useState<FileInputState>({ file: null, error: null });
  const [captureManifest, setCaptureManifest] = useState<FileInputState>({ file: null, error: null });
  const [dbsnpVcf, setDbsnpVcf] = useState<FileInputState>({ file: null, error: null });
  const [knownIndelsVcf, setKnownIndelsVcf] = useState<FileInputState>({ file: null, error: null });
  const [panelOfNormalsVcf, setPanelOfNormalsVcf] = useState<FileInputState>({ file: null, error: null });

  const [minCoverage, setMinCoverage] = useState<string>("30");
  const [minBaseQual, setMinBaseQual] = useState<string>("20");
  const [minMapQual, setMinMapQual] = useState<string>("30");
  const [platform, setPlatform] = useState<string>("Illumina");
  const [captureKit, setCaptureKit] = useState<string>("Agilent SureSelect");

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
  const handleNormalFastq1Change = useCallback(
    handleFileChange(setNormalFastq1, /(fastq|fq)\.gz$/i, "Must be a .fastq.gz or .fq.gz file"),
    [handleFileChange]
  );
  const handleNormalFastq2Change = useCallback(
    handleFileChange(setNormalFastq2, /(fastq|fq)\.gz$/i, "Must be a .fastq.gz or .fq.gz file"),
    [handleFileChange]
  );
  const handleReferenceChange = useCallback(
    handleFileChange(setReference, /(fa|fasta)\.gz$/i, "Must be a .fa.gz or .fasta.gz file"),
    [handleFileChange]
  );
  const handleTargetsBedChange = useCallback(
    handleFileChange(setTargetsBed, /(bed|bed\.gz)$/i, "Must be a .bed or .bed.gz file"),
    [handleFileChange]
  );
  const handleCaptureManifestChange = useCallback(
    handleFileChange(setCaptureManifest, /(bed|bed\.gz)$/i, "Must be a .bed or .bed.gz file"),
    [handleFileChange]
  );
  const handleDbsnpVcfChange = useCallback(
    handleFileChange(setDbsnpVcf, /(vcf|vcf\.gz)$/i, "Must be a .vcf or .vcf.gz file"),
    [handleFileChange]
  );
  const handleKnownIndelsVcfChange = useCallback(
    handleFileChange(setKnownIndelsVcf, /(vcf|vcf\.gz)$/i, "Must be a .vcf or .vcf.gz file"),
    [handleFileChange]
  );
  const handlePanelOfNormalsChange = useCallback(
    handleFileChange(setPanelOfNormalsVcf, /(vcf|vcf\.gz)$/i, "Must be a .vcf or .vcf.gz file"),
    [handleFileChange]
  );

  // Sample file download helpers
  const downloadTextFile = useCallback((filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadFastqSample = useCallback((prefix: string) => {
    const content = [
      '@SEQ_ID',
      'GATTTGGGGTTCAAAGCAGTATCGATCAAATAGTAA',
      '+',
      'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII',
    ].join('\n');
    downloadTextFile(`${prefix.toLowerCase()}_sample.fastq.gz`, content);
  }, [downloadTextFile]);

  const downloadFastaSample = useCallback(() => {
    const content = ['>chr1', 'ACGTACGTACGTACGTACGTACGTACGT'].join('\n');
    downloadTextFile('sample_reference.fa.gz', content);
  }, [downloadTextFile]);

  const downloadBedSample = useCallback(() => {
    const content = ['chr1\t10000\t10100\tEXON1', 'chr1\t15000\t15100\tEXON2'].join('\n');
    downloadTextFile('sample_targets.bed.gz', content);
  }, [downloadTextFile]);

  const downloadManifestSample = useCallback(() => {
    const content = ['chr1\t20000\t20100\tCAPTURE1'].join('\n');
    downloadTextFile('sample_capture_manifest.bed.gz', content);
  }, [downloadTextFile]);

  const downloadVcfSample = useCallback((name: string) => {
    const header = ['##fileformat=VCFv4.2', '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO'].join('\n');
    const record = ['chr1','10100','.','A','G','60','PASS','.'].join('\t');
    downloadTextFile(`${name}.vcf.gz`, `${header}\n${record}`);
  }, [downloadTextFile]);

  const totalFileSize = useMemo(() => {
    const sizes = [
      tumorFastq1.file?.size || 0,
      tumorFastq2.file?.size || 0,
      hasMatchedNormal ? (normalFastq1.file?.size || 0) : 0,
      hasMatchedNormal ? (normalFastq2.file?.size || 0) : 0,
      reference.file?.size || 0,
      targetsBed.file?.size || 0,
      captureManifest.file?.size || 0,
      dbsnpVcf.file?.size || 0,
      knownIndelsVcf.file?.size || 0,
      panelOfNormalsVcf.file?.size || 0,
    ];
    return sizes.reduce((a, b) => a + b, 0);
  }, [tumorFastq1.file, tumorFastq2.file, normalFastq1.file, normalFastq2.file, hasMatchedNormal, reference.file, targetsBed.file, captureManifest.file, dbsnpVcf.file, knownIndelsVcf.file, panelOfNormalsVcf.file]);

  const isFormValid = tumorFastq1.file && tumorFastq2.file && reference.file && targetsBed.file && !tumorFastq1.error && !tumorFastq2.error && !reference.error && !targetsBed.error && (!hasMatchedNormal || (!normalFastq1.error && !normalFastq2.error));

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
    setSampleName("");
    setHasMatchedNormal(false);
    setTumorFastq1({ file: null, error: null });
    setTumorFastq2({ file: null, error: null });
    setNormalFastq1({ file: null, error: null });
    setNormalFastq2({ file: null, error: null });
    setReference({ file: null, error: null });
    setTargetsBed({ file: null, error: null });
    setCaptureManifest({ file: null, error: null });
    setDbsnpVcf({ file: null, error: null });
    setKnownIndelsVcf({ file: null, error: null });
    setPanelOfNormalsVcf({ file: null, error: null });
    setMinCoverage("30");
    setMinBaseQual("20");
    setMinMapQual("30");
    setPlatform("Illumina");
    setCaptureKit("Agilent SureSelect");
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
                Provide tumor FASTQ pairs, optional matched-normal pairs, reference genome and target regions for variant calling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sample Name */}
              <div className="space-y-2">
                <Label htmlFor="exome_sample_name" className="text-sm font-medium">
                  Sample Name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="exome_sample_name"
                  placeholder="e.g., patient_001_tumor"
                  value={sampleName}
                  onChange={(e) => setSampleName(e.target.value)}
                  disabled={isRunning}
                />
              </div>

              <Separator />

              {/* Tumor FASTQ R1/R2 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Tumor Reads (R1 & R2) <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="file"
                      accept=".fastq.gz,.fq.gz"
                      onChange={handleTumorFastq1Change}
                      disabled={isRunning}
                      className={cn(tumorFastq1.error && "border-red-500")}
                    />
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadFastqSample('tumor_R1')}>Sample</Button>
                    {tumorFastq1.file && (
                      <Badge variant="secondary" className="mt-2">
                        {formatFileSize(tumorFastq1.file.size)}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Tumor paired-end forward reads (R1)</p>
                  </div>
                  <div>
                    <Input
                      type="file"
                      accept=".fastq.gz,.fq.gz"
                      onChange={handleTumorFastq2Change}
                      disabled={isRunning}
                      className={cn(tumorFastq2.error && "border-red-500")}
                    />
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadFastqSample('tumor_R2')}>Sample</Button>
                    {tumorFastq2.file && (
                      <Badge variant="secondary" className="mt-2">
                        {formatFileSize(tumorFastq2.file.size)}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Tumor paired-end reverse reads (R2)</p>
                  </div>
                </div>
                {(tumorFastq1.error || tumorFastq2.error) && (
                  <p className="text-xs text-red-500">{tumorFastq1.error || tumorFastq2.error}</p>
                )}
              </div>

              {/* Matched normal toggle + inputs */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Matched Normal</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="checkbox"
                    checked={hasMatchedNormal}
                    onChange={(e) => setHasMatchedNormal(e.target.checked)}
                  />
                  <span className="text-sm text-muted-foreground">Provide matched-normal FASTQ pairs (optional)</span>
                </div>
                {hasMatchedNormal && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <div>
                      <Input
                        type="file"
                        accept=".fastq.gz,.fq.gz"
                        onChange={handleNormalFastq1Change}
                        disabled={isRunning}
                        className={cn(normalFastq1.error && "border-red-500")}
                      />
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadFastqSample('normal_R1')}>Sample</Button>
                      {normalFastq1.file && (
                        <Badge variant="secondary" className="mt-2">
                          {formatFileSize(normalFastq1.file.size)}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Normal paired-end forward reads (R1)</p>
                    </div>
                    <div>
                      <Input
                        type="file"
                        accept=".fastq.gz,.fq.gz"
                        onChange={handleNormalFastq2Change}
                        disabled={isRunning}
                        className={cn(normalFastq2.error && "border-red-500")}
                      />
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadFastqSample('normal_R2')}>Sample</Button>
                      {normalFastq2.file && (
                        <Badge variant="secondary" className="mt-2">
                          {formatFileSize(normalFastq2.file.size)}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Normal paired-end reverse reads (R2)</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Reference Genome */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reference Genome <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-2">
                  <Input
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
                <p className="text-xs text-muted-foreground">Compressed FASTA (.fa.gz)</p>
              </div>

              {/* Target Regions BED */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Exome Targets (BED) <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-2">
                  <Input
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
                <p className="text-xs text-muted-foreground">Target regions for capture (.bed)</p>
              </div>

              {/* Capture Manifest (optional) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Capture Manifest (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".bed,.bed.gz"
                    onChange={handleCaptureManifestChange}
                    disabled={isRunning}
                  />
                  <Button variant="outline" size="sm" onClick={downloadManifestSample}>Sample</Button>
                  {captureManifest.file && (
                    <Badge variant="secondary" className="shrink-0">{formatFileSize(captureManifest.file.size)}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Vendor-specific manifest (e.g., Agilent/Illumina)</p>
              </div>

              <Separator />

              {/* Known variants (VCF) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Known SNPs (dbSNP VCF)</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".vcf,.vcf.gz" onChange={handleDbsnpVcfChange} disabled={isRunning} />
                  <Button variant="outline" size="sm" onClick={() => downloadVcfSample('sample_dbsnp')}>Sample</Button>
                </div>
                <p className="text-xs text-muted-foreground">Optional: known SNPs for annotation</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Known Indels (VCF)</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".vcf,.vcf.gz" onChange={handleKnownIndelsVcfChange} disabled={isRunning} />
                  <Button variant="outline" size="sm" onClick={() => downloadVcfSample('sample_indels')}>Sample</Button>
                </div>
                <p className="text-xs text-muted-foreground">Optional: known indels for annotation</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Panel of Normals (VCF)</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".vcf,.vcf.gz" onChange={handlePanelOfNormalsChange} disabled={isRunning} />
                  <Button variant="outline" size="sm" onClick={() => downloadVcfSample('sample_pon')}>Sample</Button>
                </div>
                <p className="text-xs text-muted-foreground">Optional: reduce false positives in tumor-only mode</p>
              </div>

              <Separator />

              {/* Quality/capture params */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Min Coverage (X)</Label>
                  <Input value={minCoverage} onChange={(e) => setMinCoverage(e.target.value)} placeholder="e.g., 30" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Min Base Quality</Label>
                  <Input value={minBaseQual} onChange={(e) => setMinBaseQual(e.target.value)} placeholder="e.g., 20" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Min Mapping Quality</Label>
                  <Input value={minMapQual} onChange={(e) => setMinMapQual(e.target.value)} placeholder="e.g., 30" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Platform</Label>
                  <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Illumina / MGI / ..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Capture Kit</Label>
                  <Input value={captureKit} onChange={(e) => setCaptureKit(e.target.value)} placeholder="e.g., Agilent SureSelect" />
                </div>
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
