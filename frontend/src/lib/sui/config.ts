/**
 * Sui / Tatum RPC Configuration
 *
 * Configures the Sui client to route all RPC calls through Tatum's gateway.
 * Provides SuiClient initialization and PTB builders for marketplace operations.
 */

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';

// === Configuration ===

export const TATUM_RPC_URL = import.meta.env.PUBLIC_TATUM_RPC_URL
  || 'https://sui-testnet.gateway.tatum.io';

export const TATUM_API_KEY = import.meta.env.PUBLIC_TATUM_API_KEY || '';

export const NETWORK = import.meta.env.PUBLIC_SUI_NETWORK || 'testnet';

// === Package IDs (deployed contract addresses) ===

export const PACKAGE_ID = import.meta.env.PUBLIC_NEXUS_PACKAGE_ID
  || '0xd4121a4525729f9319db53d66967f0669a5eff6603009d346befe9bac5b74816';

export const MARKETPLACE_ID = import.meta.env.PUBLIC_NEXUS_MARKETPLACE_ID
  || '0x7718f693693cac1637a972ae9a6cf14fdacb0d275a8c8b1aef34eb4b4dae1bce';

// === SuiClient Initialization ===

/**
 * Create a SuiJsonRpcClient configured to use Tatum's RPC gateway.
 * All Sui RPC calls will be routed through Tatum.
 *
 * @returns SuiJsonRpcClient instance
 */
export function createSuiClient(): SuiJsonRpcClient {
  const transport = new JsonRpcHTTPTransport({
    url: TATUM_RPC_URL,
    rpc: {
      headers: {
        'x-api-key': TATUM_API_KEY
      }
    }
  });

  return new SuiJsonRpcClient({
    transport,
    network: NETWORK as 'testnet' | 'mainnet' | 'devnet',
  });
}

/**
 * Get a singleton SuiJsonRpcClient instance.
 * Reuses the same client across the application.
 */
let clientInstance: SuiJsonRpcClient | null = null;

export function getSuiClient(): SuiJsonRpcClient {
  if (!clientInstance) {
    clientInstance = createSuiClient();
  }
  return clientInstance;
}

// === PTB Builders for Marketplace Operations ===

/**
 * Build a PTB to list a dataset on the marketplace.
 *
 * @param params - Listing parameters
 * @returns Transaction object ready to be signed and executed
 */
export function buildListDatasetTransaction(params: {
  marketplaceId: string;
  name: string;
  description: string;
  category: string;
  walrusBlobId: string;
  sizeBytes: number;
  price: number;
  contentHash?: string;
  storageEpochs?: number;
  clockId: string;
}): Transaction {
  const tx = new Transaction();

  // Convert strings to bytes for Move
  const nameBytes = Array.from(new TextEncoder().encode(params.name));
  const descriptionBytes = Array.from(new TextEncoder().encode(params.description));
  const categoryBytes = Array.from(new TextEncoder().encode(params.category));
  const walrusBlobIdBytes = Array.from(new TextEncoder().encode(params.walrusBlobId));

  // Build optional arguments
  const contentHashArg = params.contentHash
    ? tx.pure.option('string', params.contentHash)
    : tx.pure.option('string', null);

  const storageEpochsArg = params.storageEpochs
    ? tx.pure.option('u64', params.storageEpochs)
    : tx.pure.option('u64', null);

  // Call list_dataset function
  tx.moveCall({
    target: `${PACKAGE_ID}::nexus_marketplace::list_dataset`,
    arguments: [
      tx.object(params.marketplaceId),
      tx.pure.string(params.name),
      tx.pure.string(params.description),
      tx.pure.string(params.category),
      tx.pure.string(params.walrusBlobId),
      tx.pure.u64(params.sizeBytes),
      tx.pure.u64(params.price),
      contentHashArg,
      storageEpochsArg,
      tx.object(params.clockId),
    ],
  });

  return tx;
}

/**
 * Build a PTB to buy a dataset from the marketplace.
 *
 * @param params - Purchase parameters
 * @returns Transaction object ready to be signed and executed
 */
export function buildBuyDatasetTransaction(params: {
  marketplaceId: string;
  listingId: string;
  paymentCoinId: string;
  paymentAmount: number;
  clockId: string;
}): Transaction {
  const tx = new Transaction();

  // Split coin for payment if needed
  const [paymentCoin] = tx.splitCoins(tx.object(params.paymentCoinId), [params.paymentAmount]);

  // Call buy_dataset function
  tx.moveCall({
    target: `${PACKAGE_ID}::nexus_marketplace::buy_dataset`,
    arguments: [
      tx.object(params.marketplaceId),
      tx.pure.id(params.listingId),
      paymentCoin,
      tx.object(params.clockId),
    ],
  });

  return tx;
}

/**
 * Build a PTB to delist a dataset from the marketplace.
 *
 * @param params - Delist parameters
 * @returns Transaction object ready to be signed and executed
 */
export function buildDelistDatasetTransaction(params: {
  marketplaceId: string;
  providerCapId: string;
  clockId: string;
}): Transaction {
  const tx = new Transaction();

  // Call delist_dataset function
  tx.moveCall({
    target: `${PACKAGE_ID}::nexus_marketplace::delist_dataset`,
    arguments: [
      tx.object(params.marketplaceId),
      tx.object(params.providerCapId),
      tx.object(params.clockId),
    ],
  });

  return tx;
}

// === Query Functions ===

/**
 * Get marketplace statistics.
 *
 * @param marketplaceId - The marketplace object ID
 * @returns Promise with marketplace stats
 */
export async function getMarketplaceStats(marketplaceId: string) {
  const client = getSuiClient();

  const result = await client.getObject({
    id: marketplaceId,
    options: {
      showContent: true,
    },
  });

  if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
    throw new Error('Failed to fetch marketplace data');
  }

  const fields = result.data.content.fields as any;

  return {
    totalListings: parseInt(fields.total_listings),
    totalSales: parseInt(fields.total_sales),
    totalVolume: parseInt(fields.total_volume),
    treasury: parseInt(fields.treasury),
    feeBps: parseInt(fields.fee_bps),
    paused: fields.paused,
  };
}

/**
 * Get listing details.
 *
 * @param marketplaceId - The marketplace object ID
 * @param listingId - The listing object ID
 * @returns Promise with listing details
 */
export async function getListingDetails(marketplaceId: string, listingId: string) {
  const client = getSuiClient();

  const result = await client.getObject({
    id: listingId,
    options: {
      showContent: true,
      showOwner: true,
    },
  });

  if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
    throw new Error('Failed to fetch listing data');
  }

  const fields = result.data.content.fields as any;

  return {
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
    storageEpochs: fields.storage_epochs,
  };
}

/**
 * Get all active listings from the marketplace.
 *
 * @param marketplaceId - The marketplace object ID
 * @returns Promise with array of listing IDs
 */
export async function getActiveListings(marketplaceId: string): Promise<string[]> {
  const client = getSuiClient();

  // Get marketplace object to access listings table
  const marketplace = await client.getObject({
    id: marketplaceId,
    options: {
      showContent: true,
    },
  });

  if (!marketplace.data?.content || marketplace.data.content.dataType !== 'moveObject') {
    throw new Error('Failed to fetch marketplace data');
  }

  const fields = marketplace.data.content.fields as any;
  const listingsTableId = fields.listings.fields.id.id;

  // Query dynamic fields of the listings table
  const dynamicFields = await client.getDynamicFields({
    parentId: listingsTableId,
  });

  // Filter for active listings
  const activeListings: string[] = [];

  for (const field of dynamicFields.data) {
    const listingId = field.objectId;
    const listing = await getListingDetails(marketplaceId, listingId);

    if (listing.active) {
      activeListings.push(listingId);
    }
  }

  return activeListings;
}

/**
 * Get user's DatasetAccess objects (purchased datasets).
 *
 * @param address - The user's address
 * @returns Promise with array of access object IDs
 */
export async function getUserAccessObjects(address: string): Promise<string[]> {
  const client = getSuiClient();

  const objects = await client.getOwnedObjects({
    owner: address,
    filter: {
      StructType: `${PACKAGE_ID}::nexus_marketplace::DatasetAccess`,
    },
  });

  return objects.data.map(obj => obj.data?.objectId || '').filter(Boolean);
}

/**
 * Get user's ProviderCap objects (listed datasets).
 *
 * @param address - The user's address
 * @returns Promise with array of capability object IDs
 */
export async function getUserProviderCaps(address: string): Promise<string[]> {
  const client = getSuiClient();

  const objects = await client.getOwnedObjects({
    owner: address,
    filter: {
      StructType: `${PACKAGE_ID}::nexus_marketplace::ProviderCap`,
    },
  });

  return objects.data.map(obj => obj.data?.objectId || '').filter(Boolean);
}

// === Event Queries ===

/**
 * Query marketplace events.
 *
 * @param marketplaceId - The marketplace object ID
 * @param eventType - The event type to query
 * @param limit - Maximum number of events to return
 * @returns Promise with array of events
 */
export async function queryMarketplaceEvents(
  marketplaceId: string,
  eventType: 'DatasetListed' | 'DatasetPurchased' | 'DatasetDelisted',
  limit: number = 50
) {
  const client = getSuiClient();

  const events = await client.queryEvents({
    query: {
      MoveModule: {
        package: PACKAGE_ID,
        module: 'nexus_marketplace',
      },
    },
    limit,
    order: 'descending',
  });

  return events.data.filter(event => event.type.includes(eventType));
}

// === Utility Functions ===

/**
 * Format SUI amount from MIST.
 *
 * @param mist - Amount in MIST
 * @returns Formatted string (e.g., "1.5 SUI")
 */
export function formatSui(mist: number): string {
  return `${(mist / 1_000_000_000).toFixed(4)} SUI`;
}

/**
 * Convert SUI to MIST.
 *
 * @param sui - Amount in SUI
 * @returns Amount in MIST
 */
export function suiToMist(sui: number): number {
  return Math.floor(sui * 1_000_000_000);
}

/**
 * Convert MIST to SUI.
 *
 * @param mist - Amount in MIST
 * @returns Amount in SUI
 */
export function mistToSui(mist: number): number {
  return mist / 1_000_000_000;
}
