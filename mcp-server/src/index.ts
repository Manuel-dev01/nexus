/**
 * Nexus MCP Server — AI Agent Tool Definitions
 *
 * Exposes domain-specific tools for autonomous AI agents:
 * - search_nexus_datasets: Find datasets by metadata/price
 * - get_dataset_details: Get full listing info
 * - get_walrus_blob: Download raw dataset from Walrus
 * - get_marketplace_stats: Marketplace overview
 * - verify_dataset_integrity: Check blob hash
 * - check_dataset_purchase: Whether an address already owns access to a listing
 *
 * All Sui reads are routed through Tatum's RPC gateway.
 * Implements Model Context Protocol (MCP) for LLM integration.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createHash } from 'crypto';

// === Configuration ===

const TATUM_RPC_URL = process.env.TATUM_RPC_URL || 'https://sui-testnet.gateway.tatum.io';
const TATUM_API_KEY = process.env.TATUM_API_KEY || '';
const SUI_RPC_URL = 'https://fullnode.testnet.sui.io:443';
const PACKAGE_ID = process.env.NEXUS_PACKAGE_ID || '0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6';
const MARKETPLACE_ID = process.env.NEXUS_MARKETPLACE_ID || '0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99';
const WALRUS_AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';

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
  purchaseCount: number;
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

/**
 * Query Sui RPC. The Tatum gateway is the primary path — this is the MCP
 * server's Tatum integration surface, so autonomous-agent reads flow through
 * Tatum's infrastructure. The public Sui fullnode is an automatic fallback so
 * a missing key or a transient Tatum hiccup never takes the server down.
 */
async function suiRpc(method: string, params: any[]): Promise<any> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });

  // Primary: Tatum gateway (requires an API key).
  if (TATUM_API_KEY) {
    try {
      const res = await fetch(TATUM_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': TATUM_API_KEY },
        body,
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (!data.error) return data.result;
      }
    } catch {
      // Fall through to the public fullnode below.
    }
  }

  // Fallback: public Sui fullnode.
  const res = await fetch(SUI_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = (await res.json()) as any;
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

/**
 * Get all listings by querying DatasetListed events.
 * This is more reliable than dynamic fields for Sui Table types.
 */
async function getAllListings(): Promise<DatasetListing[]> {
  const result = await suiRpc('suix_queryEvents', [
    { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } },
    null,
    100,
    true,
  ]);

  const events = result?.data || [];
  const listings: DatasetListing[] = [];

  for (const event of events) {
    if (!event.type?.includes('DatasetListed')) continue;
    const parsed = event.parsedJson || {};
    listings.push({
      id: parsed.listing_id || '',
      name: parsed.name || 'Unknown',
      description: parsed.description || 'No description available',
      category: parsed.category || 'other',
      walrusBlobId: parsed.walrus_blob_id || '',
      sizeBytes: parseInt(parsed.size_bytes) || 0,
      price: parseInt(parsed.price) || 0,
      provider: parsed.provider || '',
      active: true,
      purchaseCount: 0,
    });
  }

  return listings;
}

// DatasetListing objects are stored INSIDE the marketplace's `listings` Table,
// which wraps them — so `sui_getObject(listingId)` returns `notExists`. They
// must be read as dynamic fields of the table (key type `0x2::object::ID`).
let listingsTableIdCache: string | null = null;

async function getListingsTableId(): Promise<string> {
  if (listingsTableIdCache) return listingsTableIdCache;
  const mk = await suiRpc('sui_getObject', [MARKETPLACE_ID, { showContent: true }]);
  const id = mk?.data?.content?.fields?.listings?.fields?.id?.id;
  if (!id) throw new Error('Could not resolve marketplace listings table');
  listingsTableIdCache = id;
  return id;
}

/** Read a single listing's on-chain fields from the marketplace table. Null if absent. */
async function getListingFields(listingId: string): Promise<any | null> {
  const tableId = await getListingsTableId();
  const df = await suiRpc('suix_getDynamicFieldObject', [
    tableId,
    { type: '0x2::object::ID', value: listingId },
  ]);
  return df?.data?.content?.fields?.value?.fields ?? null;
}

/** Check whether an address owns a DatasetAccess for a listing (proof of purchase). */
async function ownsDatasetAccess(address: string, listingId: string): Promise<boolean> {
  const res = await suiRpc('suix_getOwnedObjects', [
    address,
    {
      filter: { StructType: `${PACKAGE_ID}::nexus_marketplace::DatasetAccess` },
      options: { showContent: true },
    },
  ]);
  return (res?.data || []).some((obj: any) => {
    const content = obj.data?.content;
    return content?.dataType === 'moveObject' && content.fields?.listing_id === listingId;
  });
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
      const allListings = await getAllListings();

      // Apply filters
      let filtered = allListings.filter(l => l.active);
      if (category) filtered = filtered.filter(l => l.category === category);
      if (maxPrice) filtered = filtered.filter(l => l.price <= maxPrice);
      if (minSize) filtered = filtered.filter(l => l.sizeBytes >= minSize);
      if (maxSize) filtered = filtered.filter(l => l.sizeBytes <= maxSize);
      if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = filtered.filter(l =>
          l.name.toLowerCase().includes(kw) || l.description.toLowerCase().includes(kw)
        );
      }

      // Sort by price and limit
      const results = filtered
        .sort((a, b) => a.price - b.price)
        .slice(0, limit || 10)
        .map(l => ({
          id: l.id,
          name: l.name,
          description: l.description.substring(0, 200) + (l.description.length > 200 ? '...' : ''),
          category: l.category,
          price: formatSui(l.price),
          priceMist: l.price,
          size: formatFileSize(l.sizeBytes),
          sizeBytes: l.sizeBytes,
          provider: l.provider,
          walrusBlobId: l.walrusBlobId,
        }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ totalFound: filtered.length, returned: results.length, datasets: results }, null, 2)
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
 */
server.tool(
  'get_dataset_details',
  'Get detailed information about a specific dataset in the Nexus marketplace.',
  {
    listingId: z.string().describe('The listing object ID')
  },
  async ({ listingId }) => {
    try {
      // Listings are wrapped in the marketplace table — read via dynamic field,
      // not sui_getObject (which returns notExists for wrapped objects).
      const fields = await getListingFields(listingId);

      if (!fields) {
        return {
          content: [{ type: 'text', text: 'Error: Listing not found' }],
          isError: true
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: listingId,
            name: fields.name,
            description: fields.description,
            category: fields.category,
            walrusBlobId: fields.walrus_blob_id,
            size: formatFileSize(parseInt(fields.size_bytes)),
            sizeBytes: parseInt(fields.size_bytes),
            price: formatSui(parseInt(fields.price)),
            priceMist: parseInt(fields.price),
            provider: fields.provider,
            active: fields.active,
            listedAt: new Date(parseInt(fields.listed_at)).toISOString(),
            purchaseCount: parseInt(fields.purchase_count),
            contentHash: fields.content_hash,
            storageEpochs: fields.storage_epochs ? parseInt(fields.storage_epochs) : null,
            downloadUrl: `${WALRUS_AGGREGATOR_URL}/v1/blobs/${fields.walrus_blob_id}`
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
 */
server.tool(
  'get_walrus_blob',
  'Download a dataset from Walrus decentralized storage by blob ID.',
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
            dataPreview: data.subarray(0, 200).toString('utf-8'),
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
 */
server.tool(
  'get_marketplace_stats',
  'Get Nexus marketplace statistics including total listings, sales volume, and treasury balance.',
  {},
  async () => {
    try {
      const result = await suiRpc('sui_getObject', [
        MARKETPLACE_ID,
        { showContent: true },
      ]);

      if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
        return {
          content: [{ type: 'text', text: 'Error: Failed to fetch marketplace data' }],
          isError: true
        };
      }

      const fields = result.data.content.fields as any;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalListings: parseInt(fields.total_listings),
            totalSales: parseInt(fields.total_sales),
            totalVolume: formatSui(parseInt(fields.total_volume)),
            totalVolumeMist: parseInt(fields.total_volume),
            treasuryBalance: formatSui(parseInt(fields.treasury)),
            treasuryBalanceMist: parseInt(fields.treasury),
            platformFeePercent: parseInt(fields.fee_bps) / 100,
            isPaused: fields.paused
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

/**
 * Check whether an address already purchased a dataset (proof-of-purchase).
 * Lets an agent avoid the on-chain EAlreadyPurchased abort before buying again,
 * and confirm it owns download access after a purchase.
 */
server.tool(
  'check_dataset_purchase',
  'Check whether a wallet address already owns purchase access (a DatasetAccess) for a given Nexus dataset listing. Use before buying to avoid a duplicate-purchase error, or to confirm download rights.',
  {
    address: z.string().describe('The wallet address to check'),
    listingId: z.string().describe('The dataset listing object ID')
  },
  async ({ address, listingId }) => {
    try {
      const hasAccess = await ownsDatasetAccess(address, listingId);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address,
            listingId,
            hasPurchased: hasAccess,
            canDownload: hasAccess,
            note: hasAccess
              ? 'This address already owns access — buying again would abort with EAlreadyPurchased.'
              : 'No access found — this address can purchase this dataset.'
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error checking purchase: ${error}` }],
        isError: true
      };
    }
  }
);

// === Resource Definitions ===

server.resource(
  'marketplace-overview',
  'marketplace://overview',
  { description: 'Current state of the Nexus dataset marketplace' },
  async () => {
    try {
      const result = await suiRpc('sui_getObject', [
        MARKETPLACE_ID,
        { showContent: true },
      ]);

      if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
        return {
          contents: [{ uri: 'marketplace://overview', text: 'Error: Failed to fetch marketplace data' }]
        };
      }

      const fields = result.data.content.fields as any;

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
        contents: [{ uri: 'marketplace://overview', text: `Error: ${error}` }]
      };
    }
  }
);

// === Start Server ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const rpcMode = TATUM_API_KEY
    ? `Tatum gateway (${TATUM_RPC_URL}) with public-fullnode fallback`
    : `public fullnode only (no TATUM_API_KEY set) — ${SUI_RPC_URL}`;
  console.error('Nexus MCP Server started');
  console.error(`Sui RPC: ${rpcMode}`);
}

main().catch(console.error);
