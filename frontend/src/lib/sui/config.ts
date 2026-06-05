/**
 * Sui / Tatum RPC Configuration
 *
 * Configures the Sui client to route all RPC calls through Tatum's gateway.
 * Provides SuiClient initialization and PTB builders for marketplace operations.
 */

import { Transaction } from '@mysten/sui/transactions';

// === Configuration ===

export const TATUM_RPC_URL = import.meta.env.PUBLIC_TATUM_RPC_URL
  || 'https://sui-testnet.gateway.tatum.io';

export const TATUM_API_KEY = import.meta.env.PUBLIC_TATUM_API_KEY || '';

export const NETWORK = import.meta.env.PUBLIC_SUI_NETWORK || 'testnet';

// === Package IDs (deployed contract addresses) ===

export const PACKAGE_ID = import.meta.env.PUBLIC_NEXUS_PACKAGE_ID
  || '0x2797464179d14bd6ac9463019abb2000d840fc33547b378372ed3b6fc6b393e7';

export const MARKETPLACE_ID = import.meta.env.PUBLIC_NEXUS_MARKETPLACE_ID
  || '0xac47e84574ce49163c02c2ea7f9e472aa45fcf64de599b97e8cac2e95f417430';

// === Explorer (Suiscan) link builders ===
// Sui Explorer is deprecated and redirects to Suiscan, so link there directly.
export const EXPLORER_BASE = 'https://suiscan.xyz/testnet';
export const explorerTx = (digest: string) => `${EXPLORER_BASE}/tx/${digest}`;
export const explorerObject = (id: string) => `${EXPLORER_BASE}/object/${id}`;
export const explorerAccount = (addr: string) => `${EXPLORER_BASE}/account/${addr}`;

// === Browser-safe RPC ===

/**
 * Public Sui fullnode — CORS-open and key-less. Used as a fallback (and when no
 * Tatum key is configured) for browser reads.
 */
export const SUI_FULLNODE_URL = 'https://fullnode.testnet.sui.io:443';

/**
 * Raw JSON-RPC call. The frontend deliberately does NOT use the @mysten/sui
 * SuiClient for reads: the SDK adds a `client-sdk-version` request header that
 * the Tatum gateway's CORS allowlist rejects, so SDK-over-Tatum fails the
 * browser preflight. A plain fetch sends no such header. Tatum is preferred
 * when an API key is present; otherwise (and on any Tatum error) we fall back to
 * the public fullnode so the app keeps working even if PUBLIC_TATUM_API_KEY is
 * unset in the host. Server-side code (MCP server, scripts) still uses Tatum.
 */
export async function rpc(method: string, params: any[]): Promise<any> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });

  if (TATUM_API_KEY) {
    try {
      const res = await fetch(TATUM_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': TATUM_API_KEY },
        body,
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.error) return data.result;
      }
    } catch {
      // fall through to the public fullnode
    }
  }

  const res = await fetch(SUI_FULLNODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

/** Fetch an object; mirrors the shape of SuiClient.getObject's response. */
export async function getObject(id: string, options: Record<string, boolean>) {
  return rpc('sui_getObject', [id, options]);
}

// DatasetListing objects are stored *inside* the marketplace's `listings` Table,
// which wraps them — so `sui_getObject(listingId)` returns `notExists`. They must
// be read as dynamic fields of the table (key type `0x2::object::ID`).
let listingsTableIdCache: string | null = null;

async function getListingsTableId(marketplaceId: string): Promise<string> {
  if (listingsTableIdCache) return listingsTableIdCache;
  const mk = await getObject(marketplaceId, { showContent: true });
  const id = (mk?.data?.content as any)?.fields?.listings?.fields?.id?.id;
  if (!id) throw new Error('Could not resolve the marketplace listings table');
  listingsTableIdCache = id;
  return id;
}

export interface ListingOnChain {
  /** The listing's on-chain fields (name, price, walrus_blob_id, ...). */
  fields: Record<string, any>;
  /** The live dynamic-field object that holds the listing (viewable on Suiscan).
   *  NOTE: the listing ID itself is NOT directly viewable — it's wrapped here. */
  objectId: string;
  /** Most recent transaction that touched the listing (viewable on Suiscan). */
  lastTxDigest: string;
}

/**
 * Read a DatasetListing from the marketplace table (it's a wrapped dynamic field,
 * not a standalone object). Returns null if the listing isn't found.
 */
export async function getListingFields(
  marketplaceId: string,
  listingId: string,
): Promise<ListingOnChain | null> {
  const tableId = await getListingsTableId(marketplaceId);
  const df = await rpc('suix_getDynamicFieldObject', [
    tableId,
    { type: '0x2::object::ID', value: listingId },
  ]);
  const data = df?.data;
  // The Field wraps the listing under content.fields.value.fields.
  const fields = (data?.content as any)?.fields?.value?.fields;
  if (!fields) return null;
  return {
    fields,
    objectId: data.objectId,
    lastTxDigest: data.previousTransaction,
  };
}

// === PTB Builders for Marketplace Operations ===

/**
 * Build a PTB to list a dataset on the marketplace.
 *
 * @param params - Listing parameters
 * @returns Transaction object ready to be signed and executed
 */
/** Full Sui coin type a listing is priced in. Defaults to native SUI. */
export const SUI_COIN_TYPE = '0x2::sui::SUI';

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
  /** Coin type the dataset is priced in (full type, e.g. "0x2::sui::SUI"). */
  coinType?: string;
  /** Seal encryption identity bytes ([] = not encrypted). */
  sealPolicyId?: number[];
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

  // Call list_dataset<T> — generic over the priced coin type.
  tx.moveCall({
    target: `${PACKAGE_ID}::nexus_marketplace::list_dataset`,
    typeArguments: [params.coinType ?? SUI_COIN_TYPE],
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
      tx.pure.vector('u8', params.sealPolicyId ?? []),
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
  paymentAmount: number;
  /** Coin type to pay in — must match the listing. Defaults to SUI (split from gas). */
  coinType?: string;
  /** For non-SUI tokens, the coin object id to pay from. */
  paymentCoinId?: string;
  clockId: string;
}): Transaction {
  const tx = new Transaction();

  const coinType = params.coinType ?? SUI_COIN_TYPE;

  // SUI is split from the gas coin; other tokens are split from a provided coin.
  // The contract refunds any rounding remainder from the buyer's own coin.
  const source = coinType === SUI_COIN_TYPE
    ? tx.gas
    : tx.object(params.paymentCoinId!);
  const [paymentCoin] = tx.splitCoins(source, [params.paymentAmount]);

  // Call buy_dataset<T>
  tx.moveCall({
    target: `${PACKAGE_ID}::nexus_marketplace::buy_dataset`,
    typeArguments: [coinType],
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
  const result = await getObject(marketplaceId, { showContent: true });

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
  const listing = await getListingFields(marketplaceId, listingId);

  if (!listing) {
    throw new Error('Failed to fetch listing data');
  }

  const fields = listing.fields;

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
  // Get marketplace object to access listings table
  const marketplace = await getObject(marketplaceId, { showContent: true });

  if (!marketplace.data?.content || marketplace.data.content.dataType !== 'moveObject') {
    throw new Error('Failed to fetch marketplace data');
  }

  const fields = marketplace.data.content.fields as any;
  const listingsTableId = fields.listings.fields.id.id;

  // Query dynamic fields of the listings table
  const dynamicFields = await rpc('suix_getDynamicFields', [listingsTableId, null, null]);

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
  const objects = await rpc('suix_getOwnedObjects', [
    address,
    { filter: { StructType: `${PACKAGE_ID}::nexus_marketplace::DatasetAccess` } },
  ]);

  return (objects.data || []).map((obj: any) => obj.data?.objectId || '').filter(Boolean);
}

/**
 * Check whether an address owns a DatasetAccess for a specific listing.
 * Used to gate downloads behind proof-of-purchase. Routed through Tatum.
 *
 * @param address - The user's address
 * @param listingId - The listing object ID to check access for
 * @returns Promise<boolean> - true if the address holds access to the listing
 */
export async function hasPurchasedListing(address: string, listingId: string): Promise<boolean> {
  const objects = await rpc('suix_getOwnedObjects', [
    address,
    {
      filter: { StructType: `${PACKAGE_ID}::nexus_marketplace::DatasetAccess` },
      options: { showContent: true },
    },
  ]);

  return (objects.data || []).some((obj: any) => {
    const content = obj.data?.content;
    return content?.dataType === 'moveObject' && content.fields?.listing_id === listingId;
  });
}

/**
 * Get user's ProviderCap objects (listed datasets).
 *
 * @param address - The user's address
 * @returns Promise with array of capability object IDs
 */
export async function getUserProviderCaps(address: string): Promise<string[]> {
  const objects = await rpc('suix_getOwnedObjects', [
    address,
    { filter: { StructType: `${PACKAGE_ID}::nexus_marketplace::ProviderCap` } },
  ]);

  return (objects.data || []).map((obj: any) => obj.data?.objectId || '').filter(Boolean);
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
  const events = await rpc('suix_queryEvents', [
    { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } },
    null,
    limit,
    true, // descending
  ]);

  return (events.data || []).filter((event: any) => event.type.includes(eventType));
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
