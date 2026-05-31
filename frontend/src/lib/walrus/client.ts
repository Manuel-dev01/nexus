/**
 * Walrus Upload/Download Client
 * 
 * Wraps the Walrus HTTP API (Publisher + Aggregator) for the SvelteKit frontend.
 * Phase 2: Full implementation with progress tracking and error handling.
 */

export const WALRUS_PUBLISHER_URL = import.meta.env.PUBLIC_WALRUS_PUBLISHER_URL
  || 'https://publisher.walrus-testnet.walrus.space';

export const WALRUS_AGGREGATOR_URL = import.meta.env.PUBLIC_WALRUS_AGGREGATOR_URL
  || 'https://aggregator.walrus-testnet.walrus.space';

/**
 * Upload a file to Walrus Publisher.
 * Returns the blobId for on-chain storage.
 */
export async function uploadToWalrus(file: File): Promise<string> {
  // Phase 2: Full implementation
  throw new Error('Not implemented — Phase 2');
}

/**
 * Download a blob from Walrus Aggregator by blob ID.
 * Returns raw blob data.
 */
export async function downloadFromWalrus(blobId: string): Promise<ArrayBuffer> {
  // Phase 2: Full implementation
  throw new Error('Not implemented — Phase 2');
}
