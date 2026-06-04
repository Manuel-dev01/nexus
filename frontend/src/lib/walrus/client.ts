/**
 * Walrus Upload/Download Client
 *
 * Wraps the Walrus HTTP API (Publisher + Aggregator) for the SvelteKit frontend.
 * Provides upload with progress tracking, download with integrity verification,
 * and blob lifecycle management.
 */

import { createHash } from 'crypto';

// === Configuration ===

export const WALRUS_PUBLISHER_URL = import.meta.env.PUBLIC_WALRUS_PUBLISHER_URL
  || 'https://publisher.walrus-testnet.walrus.space';

export const WALRUS_AGGREGATOR_URL = import.meta.env.PUBLIC_WALRUS_AGGREGATOR_URL
  || 'https://aggregator.walrus-testnet.walrus.space';

// === Types ===

export interface WalrusUploadResponse {
  newlyCreated?: {
    blobObject: {
      blobId: string;
      id: string;
      size: number;
      certifiedEpoch: number;
      storageEpochs: number;
    };
    cost: number;
  };
  alreadyCertified?: {
    blobId: string;
    endEpoch: number;
  };
}

export interface WalrusBlobMetadata {
  blobId: string;
  objectId: string;
  size: number;
  cost: number;
  certifiedEpoch: number | null;
  storageEpochs: number | undefined;
  sha256: string;
  uploadedAt: Date;
}

export interface WalrusDownloadResult {
  data: ArrayBuffer;
  sha256: string;
  size: number;
  verified: boolean;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

// === Utility Functions ===

function sha256(data: ArrayBuffer): string {
  const hash = createHash('sha256');
  hash.update(Buffer.from(data));
  return hash.digest('hex');
}

function formatMist(mist: number): string {
  return `${(mist / 1_000_000_000).toFixed(4)} SUI`;
}

// === Upload Function ===

/**
 * Upload a file to Walrus Publisher.
 * Returns blob metadata including blobId for on-chain storage.
 *
 * @param file - The file to upload
 * @param epochs - Number of storage epochs (default: 1)
 * @param onProgress - Optional progress callback
 * @returns Promise<WalrusBlobMetadata>
 */
export async function uploadToWalrus(
  file: File,
  epochs: number = 1,
  onProgress?: UploadProgressCallback
): Promise<WalrusBlobMetadata> {
  const url = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${epochs}`;

  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();
  const fileSize = fileBuffer.byteLength;

  // Calculate hash before upload
  const fileHash = sha256(fileBuffer);

  // Create XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100)
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response: WalrusUploadResponse = JSON.parse(xhr.responseText);

          if (response.newlyCreated) {
            const { blobObject, cost } = response.newlyCreated;
            resolve({
              blobId: blobObject.blobId,
              objectId: blobObject.id,
              size: blobObject.size,
              cost,
              certifiedEpoch: blobObject.certifiedEpoch,
              storageEpochs: blobObject.storageEpochs,
              sha256: fileHash,
              uploadedAt: new Date()
            });
          } else if (response.alreadyCertified) {
            resolve({
              blobId: response.alreadyCertified.blobId,
              objectId: '',
              size: fileSize,
              cost: 0,
              certifiedEpoch: null,
              storageEpochs: undefined,
              sha256: fileHash,
              uploadedAt: new Date()
            });
          } else {
            reject(new Error('Unexpected response format from Walrus'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Walrus response: ${error}`));
        }
      } else {
        reject(new Error(`Walrus upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during Walrus upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Walrus upload was aborted'));
    });

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(fileBuffer);
  });
}

// === Download Function ===

/**
 * Download a blob from Walrus Aggregator by blob ID.
 * Returns raw blob data with integrity verification.
 *
 * @param blobId - The Walrus blob ID to download
 * @param expectedHash - Optional SHA256 hash for verification
 * @returns Promise<WalrusDownloadResult>
 */
export async function downloadFromWalrus(
  blobId: string,
  expectedHash?: string
): Promise<WalrusDownloadResult> {
  const url = `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Walrus download failed with status ${response.status}: ${await response.text()}`);
  }

  const data = await response.arrayBuffer();
  const actualHash = sha256(data);
  const verified = expectedHash ? actualHash === expectedHash : true;

  return {
    data,
    sha256: actualHash,
    size: data.byteLength,
    verified
  };
}

// === Blob Verification ===

/**
 * Verify a blob's integrity by downloading and comparing hash.
 *
 * @param blobId - The Walrus blob ID to verify
 * @param expectedHash - The expected SHA256 hash
 * @returns Promise<boolean>
 */
export async function verifyBlob(
  blobId: string,
  expectedHash: string
): Promise<boolean> {
  try {
    const result = await downloadFromWalrus(blobId, expectedHash);
    return result.verified;
  } catch (error) {
    console.error('Blob verification failed:', error);
    return false;
  }
}

// === Cost Estimation ===

/**
 * Estimate the cost of uploading data to Walrus.
 * Note: This is an approximation; actual cost may vary.
 *
 * @param sizeBytes - Size of the data in bytes
 * @param epochs - Number of storage epochs
 * @returns Estimated cost in MIST
 */
export function estimateUploadCost(sizeBytes: number, epochs: number = 1): number {
  // Base cost per byte per epoch (approximate)
  const costPerBytePerEpoch = 100; // MIST
  return sizeBytes * epochs * costPerBytePerEpoch;
}

/**
 * Format cost from MIST to SUI string.
 *
 * @param mist - Cost in MIST
 * @returns Formatted string (e.g., "0.0004 SUI")
 */
export function formatCost(mist: number): string {
  return formatMist(mist);
}

// === Blob Lifecycle ===

/**
 * Check if a blob exists on Walrus.
 *
 * @param blobId - The Walrus blob ID to check
 * @returns Promise<boolean>
 */
export async function blobExists(blobId: string): Promise<boolean> {
  try {
    const url = `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get blob metadata from Walrus (size, existence).
 *
 * @param blobId - The Walrus blob ID
 * @returns Promise<{ exists: boolean; size: number | null }>
 */
export async function getBlobMetadata(
  blobId: string
): Promise<{ exists: boolean; size: number | null }> {
  try {
    const url = `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
    const response = await fetch(url, { method: 'HEAD' });

    if (!response.ok) {
      return { exists: false, size: null };
    }

    const contentLength = response.headers.get('Content-Length');
    const size = contentLength ? parseInt(contentLength, 10) : null;

    return { exists: true, size };
  } catch (error) {
    return { exists: false, size: null };
  }
}

// === Helper Functions ===

/**
 * Create a File from an ArrayBuffer with a given name.
 *
 * @param buffer - The data buffer
 * @param fileName - The file name
 * @param mimeType - The MIME type (default: 'application/octet-stream')
 * @returns File
 */
export function createFileFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string = 'application/octet-stream'
): File {
  return new File([buffer], fileName, { type: mimeType });
}

/**
 * Read a File as ArrayBuffer.
 *
 * @param file - The file to read
 * @returns Promise<ArrayBuffer>
 */
export function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/**
 * Format file size to human-readable string.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
