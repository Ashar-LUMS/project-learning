/**
 * RNA-seq Microservice API Client
 * 
 * Handles communication with the RNA-seq analysis microservice for:
 * - Job submission with FASTQ, reference genome, and annotation files
 * - Status polling during analysis
 * - Results retrieval when complete
 */

// Default to localhost in development - should be configured via env variable in production
const API_URL = import.meta.env.VITE_RNASEQ_API_URL || 'http://localhost:8000';

export interface RNASeqJobSubmitResponse {
  job_id: string;
  status_url: string;
  results_url: string;
}

export type JobState = 'pending' | 'running' | 'completed' | 'failed';

export interface RNASeqJobStatus {
  job_id: string;
  state: JobState;
  progress_percent: number;
  current_stage: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface GeneExpression {
  gene_id?: string;
  gene_symbol?: string;
  /** Alternative field name some pipelines use instead of gene_symbol */
  gene_name?: string;
  counts: number;
  tpm?: number;
  fpkm?: number;
}

export interface RNASeqResults {
  job_id: string;
  sample_name: string;
  genes: GeneExpression[];
  gene_count: number;
  total_counts: number;
  mapping_rate?: number;
  completed_at: string;
}

export class RNASeqApiError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(
    message: string,
    statusCode?: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'RNASeqApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Submit an RNA-seq analysis job to the microservice
 * 
 * @param formData - FormData containing:
 *   - fastq_1: Forward reads (R1) .fastq.gz file (required)
 *   - fastq_2: Reverse reads (R2) .fastq.gz file (required)
 *   - reference: Reference genome .fa.gz file (required)
 *   - annotation: Gene annotation .gff3.gz file (required)
 *   - sample_name: Optional sample identifier
 */
export async function submitRNASeqAnalysis(formData: FormData): Promise<RNASeqJobSubmitResponse> {
  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new RNASeqApiError(
      `Failed to submit analysis: ${errorText}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Check the status of an RNA-seq analysis job
 * 
 * @param jobId - The job ID returned from submitRNASeqAnalysis
 */
export async function checkRNASeqStatus(jobId: string): Promise<RNASeqJobStatus> {
  const response = await fetch(`${API_URL}/status/${jobId}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new RNASeqApiError(
      `Failed to check status: ${errorText}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get the results of a completed RNA-seq analysis job
 * 
 * @param jobId - The job ID returned from submitRNASeqAnalysis
 */
export async function getRNASeqResults(jobId: string): Promise<RNASeqResults> {
  const response = await fetch(`${API_URL}/results/${jobId}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new RNASeqApiError(
      `Failed to get results: ${errorText}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Poll for job completion with automatic retry
 * 
 * @param jobId - The job ID to poll
 * @param onProgress - Callback for progress updates
 * @param pollInterval - Interval between polls in ms (default: 30000)
 * @param maxAttempts - Maximum polling attempts (default: 480 = 4 hours at 30s intervals)
 */
export async function pollUntilComplete(
  jobId: string,
  onProgress?: (status: RNASeqJobStatus) => void,
  pollInterval = 30000,
  maxAttempts = 480
): Promise<RNASeqResults> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await checkRNASeqStatus(jobId);
    onProgress?.(status);

    if (status.state === 'completed') {
      return getRNASeqResults(jobId);
    }

    if (status.state === 'failed') {
      throw new RNASeqApiError(
        `Analysis failed: ${status.error_message || 'Unknown error'}`,
        undefined,
        status
      );
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;
  }

  throw new RNASeqApiError(
    `Analysis timed out after ${maxAttempts * pollInterval / 1000 / 60} minutes`
  );
}

/**
 * Validate file extensions before upload
 */
export function validateRNASeqFiles(files: {
  fastq1?: File | null;
  fastq2?: File | null;
  reference?: File | null;
  annotation?: File | null;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!files.fastq1) {
    errors.push('Forward reads (R1) file is required');
  } else if (!files.fastq1.name.match(/\.(fastq|fq)\.gz$/i)) {
    errors.push('Forward reads must be a .fastq.gz or .fq.gz file');
  }

  if (!files.fastq2) {
    errors.push('Reverse reads (R2) file is required');
  } else if (!files.fastq2.name.match(/\.(fastq|fq)\.gz$/i)) {
    errors.push('Reverse reads must be a .fastq.gz or .fq.gz file');
  }

  if (!files.reference) {
    errors.push('Reference genome file is required');
  } else if (!files.reference.name.match(/\.(fa|fasta)\.gz$/i)) {
    errors.push('Reference genome must be a .fa.gz or .fasta.gz file');
  }

  if (!files.annotation) {
    errors.push('Gene annotation file is required');
  } else if (!files.annotation.name.match(/\.(gff3|gtf)\.gz$/i)) {
    errors.push('Annotation must be a .gff3.gz or .gtf.gz file');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
