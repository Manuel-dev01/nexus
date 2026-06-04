/**
 * Nexus MCP Server — AI Agent Tool Definitions
 *
 * Exposes domain-specific tools for autonomous AI agents:
 * - search_nexus_datasets: Find datasets by metadata/price
 * - get_dataset_details: Get full listing info
 * - get_walrus_blob: Download raw dataset from Walrus
 *
 * All Sui reads are routed through Tatum's RPC gateway.
 * Implements Model Context Protocol (MCP) for LLM integration.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SuiClient } from '@mysten/sui/client';
import { createHash } from 'crypto';

// === Configuration ===

const TATUM_RPC_URL = process.env.TATUM_RPC_URL || 'https://sui-testnet.gateway.tatum.io';
const TATUM_API_KEY = process.env.TATUM_API_KEY || '';
const PACKAGE_ID = process.env.NEXUS_PACKAGE_ID || '';
const MARKETPLACE_ID = process.env.NEXUS_MARKETPLACE_ID || '';
const WALRUS_AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';

// === SuiClient Initialization ===

const suiClient = new SuiClient({
  url: TATUM_RPC_URL,
  headers: {
    'x-api-key': TATUM_API_KEY
  }
});

// === Types ===

interface DatasetListing {
  id: string;
  name: string;
  description: string;
  category: string;
  walrusBlobId: string;
  sizeBytes: number;
  price: number;
  provider: string;
  active: boolean;
  listedAt: number;
  purchaseCount: number;
  contentHash: string | null;
  storageEpochs: number | null;
}

interface MarketplaceStats {
  totalListings: number;
  totalSales: number;
  totalVolume: number;
  treasury: number;
  feeBps: number;
  paused: boolean;
}

// === Helper Functions ===

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function formatSui(mist: number): string {
  return `${(mist / 1_000_000_000).toFixed(4)} SUI`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// === MCP Server Setup ===

const server = new McpServer({
  name: 'nexus-mcp-server',
  version: '1.0.0',
  description: 'Nexus Marketplace MCP Server - AI agent tools for decentralized dataset marketplace'
});

// === Tool Definitions ===

/**
 * Search for datasets in the Nexus marketplace.
 * Allows AI agents to discover datasets by category, price range, or keywords.
 */
server.tool(
  'search_nexus_datasets',
  'Search for AI training datasets in the Nexus marketplace. Find datasets by category, price range, or keywords.',
  {
    category: z.string().optional().describe('Filter by category (e.g., "embeddings", "fine-tuning", "model-weights")'),
    maxPrice: z.number().optional().describe('Maximum price in MIST'),
    minSize: z.number().optional().describe('Minimum size in bytes'),
    maxSize: z.number().optional().describe('Maximum size in bytes'),
    keyword: z.string().optional().describe('Search keyword in name or description'),
    limit: z.number().optional().default(10).describe('Maximum number of results')
  },
  async ({ category, maxPrice, minSize, maxSize, keyword, limit }) => {
    try {
      // Get marketplace object
      const marketplace = await suiClient.getObject({
        id: MARKETPLACE_ID,
        options: { showContent: true }
      });

      if (!marketplace.data?.content || marketplace.data.content.dataType !== 'moveObject') {
        return {
          content: [{ type: 'text', text: 'Error: Failed to fetch marketplace data' }],
          isError: true
        };
      }

      const fields = marketplace.data.content.fields as any;
      const listingsTableId = fields.listings.fields.id.id;

      // Get all listings
      const dynamicFields = await suiClient.getDynamicFields({
        parentId: listingsTableId
      });

      const listings: DatasetListing[] = [];

      for (const field of dynamicFields.data) {
        const listingId = field.objectId;
        const listingObj = await suiClient.getObject({
          id: listingId,
          options: { showContent: true }
        });

        if (!listingObj.data?.content || listingObj.data.content.dataType !== 'moveObject') {
          continue;
        }

        const listingFields = listingObj.data.content.fields as any;

        const listing: DatasetListing = {
          id: listingId,
          name: listingFields.name,
          description: listingFields.description,
          category: listingFields.category,
          walrusBlobId: listingFields.walrus_blob_id,
          sizeBytes: parseInt(listingFields.size_bytes),
          price: parseInt(listingFields.price),
          provider: listingFields.provider,
          active: listingFields.active,
          listedAt: parseInt(listingFields.listed_at),
          purchaseCount: parseInt(listingFields.purchase_count),
          contentHash: listingFields.content_hash,
          storageEpochs: listingFields.storage_epochs ? parseInt(listingFields.storage_epochs) : null
        };

        // Apply filters
        if (!listing.active) continue;
        if (category && listing.category !== category) continue;
        if (maxPrice && listing.price > maxPrice) continue;
        if (minSize && listing.sizeBytes < minSize) continue;
        if (maxSize && listing.sizeBytes > maxSize) continue;
        if (keyword) {
          const keywordLower = keyword.toLowerCase();
          const nameMatch = listing.name.toLowerCase().includes(keywordLower);
          const descMatch = listing.description.toLowerCase().includes(keywordLower);
          if (!nameMatch && !descMatch) continue;
        }

        listings.push(listing);
      }

      // Sort by price (ascending) and limit results
      const sortedListings = listings
        .sort((a, b) => a.price - b.price)
        .slice(0, limit || 10);

      // Format results
      const results = sortedListings.map(listing => ({
        id: listing.id,
        name: listing.name,
        description: listing.description.substring(0, 200) + (listing.description.length > 200 ? '...' : ''),
        category: listing.category,
        price: formatSui(listing.price),
        priceMist: listing.price,
        size: formatFileSize(listing.sizeBytes),
        sizeBytes: listing.sizeBytes,
        provider: listing.provider,
        purchaseCount: listing.purchaseCount,
        walrusBlobId: listing.walrusBlobId
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalFound: listings.length,
            returned: results.length,
            datasets: results
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error searching datasets: ${error}` }],
        isError: true
      };
    }
  }
);

/**
 * Get detailed information about a specific dataset.
 * Provides full metadata including Walrus blob ID for download.
 */
server.tool(
  'get_dataset_details',
  'Get detailed information about a specific dataset in the Nexus marketplace. Returns full metadata including Walrus blob ID.',
  {
    listingId: z.string().describe('The listing object ID')
  },
  async ({ listingId }) => {
    try {
      const listingObj = await suiClient.getObject({
        id: listingId,
        options: { showContent: true, showOwner: true }
      });

      if (!listingObj.data?.content || listingObj.data.content.dataType !== 'moveObject') {
        return {
          content: [{ type: 'text', text: 'Error: Listing not found' }],
          isError: true
        };
      }

      const fields = listingObj.data.content.fields as any;

      const listing: DatasetListing = {
        id: listingId,
        name: fields.name,
        description: fields.description,
        category: fields.category,
        walrusBlobId: fields.walrus_blob_id,
        sizeBytes: parseInt(fields.size_bytes),
        price: parseInt(fields.price),
        provider: fields.provider,
        active: fields.active,
        listedAt: parseInt(fields.listed_at),
        purchaseCount: parseInt(fields.purchase_count),
        contentHash: fields.content_hash,
        storageEpochs: fields.storage_epochs ? parseInt(fields.storage_epochs) : null
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: listing.id,
            name: listing.name,
            description: listing.description,
            category: listing.category,
            walrusBlobId: listing.walrusBlobId,
            size: formatFileSize(listing.sizeBytes),
            sizeBytes: listing.sizeBytes,
            price: formatSui(listing.price),
            priceMist: listing.price,
            provider: listing.provider,
            active: listing.active,
            listedAt: new Date(listing.listedAt).toISOString(),
            purchaseCount: listing.purchaseCount,
            contentHash: listing.contentHash,
            storageEpochs: listing.storageEpochs,
            downloadUrl: `${WALRUS_AGGREGATOR_URL}/v1/blobs/${listing.walrusBlobId}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error getting dataset details: ${error}` }],
        isError: true
      };
    }
  }
);

/**
 * Download a dataset from Walrus by blob ID.
 * Returns the raw dataset content with integrity verification.
 */
server.tool(
  'get_walrus_blob',
  'Download a dataset from Walrus decentralized storage by blob ID. Returns the raw content with SHA256 verification.',
  {
    blobId: z.string().describe('The Walrus blob ID'),
    expectedHash: z.string().optional().describe('Expected SHA256 hash for verification')
  },
  async ({ blobId, expectedHash }) => {
    try {
      const url = `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
      const response = await fetch(url);

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `Error: Walrus download failed with status ${response.status}` }],
          isError: true
        };
      }

      const data = Buffer.from(await response.arrayBuffer());
      const actualHash = sha256(data);
      const verified = expectedHash ? actualHash === expectedHash : true;

      // Convert to base64 for transmission
      const base64Data = data.toString('base64');

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            blobId,
            size: formatFileSize(data.length),
            sizeBytes: data.length,
            sha256: actualHash,
            verified,
            expectedHash: expectedHash || null,
            dataPreview: data.substring(0, 200).toString('utf-8', 0, Math.min(200, data.length)),
            fullDataBase64: base64Data
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error downloading blob: ${error}` }],
        isError: true
      };
    }
  }
);

/**
 * Get marketplace statistics.
 * Returns overview of marketplace activity.
 */
server.tool(
  'get_marketplace_stats',
  'Get Nexus marketplace statistics including total listings, sales volume, and treasury balance.',
  {},
  async () => {
    try {
      const marketplace = await suiClient.getObject({
        id: MARKETPLACE_ID,
        options: { showContent: true }
      });

      if (!marketplace.data?.content || marketplace.data.content.dataType !== 'moveObject') {
        return {
          content: [{ type: 'text', text: 'Error: Failed to fetch marketplace data' }],
          isError: true
        };
      }

      const fields = marketplace.data.content.fields as any;

      const stats: MarketplaceStats = {
        totalListings: parseInt(fields.total_listings),
        totalSales: parseInt(fields.total_sales),
        totalVolume: parseInt(fields.total_volume),
        treasury: parseInt(fields.treasury),
        feeBps: parseInt(fields.fee_bps),
        paused: fields.paused
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalListings: stats.totalListings,
            totalSales: stats.totalSales,
            totalVolume: formatSui(stats.totalVolume),
            totalVolumeMist: stats.totalVolume,
            treasuryBalance: formatSui(stats.treasury),
            treasuryBalanceMist: stats.treasury,
            platformFeePercent: stats.feeBps / 100,
            isPaused: stats.paused
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error getting marketplace stats: ${error}` }],
        isError: true
      };
    }
  }
);

/**
 * Verify dataset integrity.
 * Checks if a Walrus blob matches expected hash.
 */
server.tool(
  'verify_dataset_integrity',
  'Verify the integrity of a dataset stored on Walrus by comparing its hash.',
  {
    blobId: z.string().describe('The Walrus blob ID'),
    expectedHash: z.string().describe('Expected SHA256 hash')
  },
  async ({ blobId, expectedHash }) => {
    try {
      const url = `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
      const response = await fetch(url);

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `Error: Blob not found (${response.status})` }],
          isError: true
        };
      }

      const data = Buffer.from(await response.arrayBuffer());
      const actualHash = sha256(data);
      const matches = actualHash === expectedHash;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            blobId,
            expectedHash,
            actualHash,
            matches,
            size: formatFileSize(data.length),
            status: matches ? 'VERIFIED' : 'MISMATCH'
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error verifying integrity: ${error}` }],
        isError: true
      };
    }
  }
);

// === Resource Definitions ===

/**
 * Resource: Marketplace overview
 */
server.resource(
  'marketplace://overview',
  'Nexus Marketplace Overview',
  'Current state of the Nexus dataset marketplace',
  async () => {
    try {
      const marketplace = await suiClient.getObject({
        id: MARKETPLACE_ID,
        options: { showContent: true }
      });

      if (!marketplace.data?.content || marketplace.data.content.dataType !== 'moveObject') {
        return {
          contents: [{
            uri: 'marketplace://overview',
            text: 'Error: Failed to fetch marketplace data'
          }]
        };
      }

      const fields = marketplace.data.content.fields as any;

      return {
        contents: [{
          uri: 'marketplace://overview',
          text: JSON.stringify({
            name: 'Nexus AI Dataset Marketplace',
            description: 'Decentralized marketplace for AI training data stored on Walrus',
            network: 'Sui Testnet',
            totalListings: parseInt(fields.total_listings),
            totalSales: parseInt(fields.total_sales),
            totalVolume: formatSui(parseInt(fields.total_volume)),
            platformFee: `${parseInt(fields.fee_bps) / 100}%`,
            isPaused: fields.paused
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: 'marketplace://overview',
          text: `Error: ${error}`
        }]
      };
    }
  }
);

// === Start Server ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Nexus MCP Server started');
}

main().catch(console.error);
