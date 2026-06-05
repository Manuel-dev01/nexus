# Nexus API Reference

## Smart Contract API

### Package
```
0x2797464179d14bd6ac9463019abb2000d840fc33547b378372ed3b6fc6b393e7
```

### Module: `nexus_marketplace`

#### `list_dataset<T>`
List a new dataset on the marketplace. **Generic over the payment coin type `T`** (e.g. `0x2::sui::SUI`) — the listing is priced and must be bought in `T`.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `marketplace` | `&mut Marketplace` | Shared marketplace object |
| `name` | `String` | Dataset name (non-empty) |
| `description` | `String` | Dataset description (non-empty) |
| `category` | `String` | Category (e.g., "embeddings") |
| `walrus_blob_id` | `String` | Walrus blob ID (non-empty) |
| `size_bytes` | `u64` | File size in bytes |
| `price` | `u64` | Price in the smallest unit of `T` (> 0) |
| `content_hash` | `Option<String>` | Optional SHA256 hash |
| `storage_epochs` | `Option<u64>` | Optional Walrus storage epochs |
| `seal_policy_id` | `vector<u8>` | Seal encryption identity; empty `[]` = not encrypted |
| `clock` | `&Clock` | Sui system clock |

**Returns:** `ID` — The listing object ID. The listing stores `coin_type` (= `T`) and `seal_policy_id`.

**Events:** Emits `DatasetListed` (includes `coin_type: String` and `encrypted: bool`)

---

#### `buy_dataset<T>`
Purchase a dataset listing. **`T` must match the listing's `coin_type`** (the token it's priced in).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `marketplace` | `&mut Marketplace` | Shared marketplace object |
| `listing_id` | `ID` | Listing to purchase |
| `payment` | `Coin<T>` | Payment in the listing's currency (>= price) |
| `clock` | `&Clock` | Sui system clock |

**Behavior:**
- Takes exactly `price` from the payment: 2% (200 bps) platform fee paid to the marketplace **admin**, the remaining 98% to the provider.
- Refunds any overpayment **from the buyer's own coin** (never the treasury).
- Records the buyer in the listing's `purchasers` table and mints a `DatasetAccess` (owned, carrying the listing's `seal_policy_id`) to the buyer.

**Error conditions (aborts):**
| Code | When |
|------|------|
| `EWrongPaymentToken` | `T` ≠ the listing's `coin_type` |
| `EAlreadyPurchased` | The buyer already owns access to this listing (no double-buy) |
| `EInsufficientPayment` | `payment` < `price` |
| `EListingNotActive` | Listing delisted, or the marketplace is paused |
| `EListingNotFound` | `listing_id` not in the marketplace |

**Events:** Emits `DatasetPurchased` (includes `platform_fee` and `provider_payout`)

---

#### `seal_approve` *(entry)*
Seal access-control function. The Seal key servers dry-run this to decide whether to release decryption key shares — it succeeds only if the caller's `DatasetAccess` carries a `seal_policy_id` equal to `id`. Side-effect free.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `vector<u8>` | The encryption identity (= the listing's `seal_policy_id`) |
| `access` | `&DatasetAccess` | The buyer's proof-of-purchase object |

**Aborts:** `ENoAccess` if the access object has no policy or it doesn't match `id`.

---

#### `has_purchased`
View: whether an address already owns access to a listing.

| Parameter | Type |
|-----------|------|
| `marketplace` | `&Marketplace` |
| `listing_id` | `ID` |
| `addr` | `address` |

**Returns:** `bool`

---

#### `delist_dataset`
Delist a dataset (provider only).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `marketplace` | `&mut Marketplace` | Shared marketplace object |
| `cap` | `&ProviderCap` | Provider capability |
| `clock` | `&Clock` | Sui system clock |

**Events:** Emits `DatasetDelisted`

---

#### `get_listing`
Get listing details.

**Parameters:**
| Parameter | Type |
|-----------|------|
| `marketplace` | `&Marketplace` |
| `listing_id` | `ID` |

**Returns:** `(String, String, String, String, u64, u64, address, bool, u64, u64)`

---

#### `get_marketplace_stats`
Get marketplace statistics.

**Returns:** `(u64, u64, u64, u64)` — (total_listings, total_sales, total_volume, treasury)

---

#### `has_purchased`
Check whether an address already purchased a listing (used to avoid `EAlreadyPurchased`).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `marketplace` | `&Marketplace` | Shared marketplace object |
| `listing_id` | `ID` | Listing to check |
| `addr` | `address` | Address to check |

**Returns:** `bool`

---

### Objects

| Object | Ownership | Notes |
|--------|-----------|-------|
| `Marketplace` | Shared | Holds `listings: Table<ID, DatasetListing>`, `treasury`, `fee_bps` (200), stats |
| `DatasetListing` | Stored in the marketplace `listings` table | Includes `purchasers: Table<address,bool>` for double-buy prevention |
| `DatasetAccess` | Owned (buyer) | Proof of purchase + download rights; holds the `walrus_blob_id` |
| `ProviderCap` | Owned (provider) | Capability required to `delist_dataset` |

> **Reading a listing off-chain:** because `DatasetListing` is stored *inside* the marketplace `listings` table, it is a wrapped object — `sui_getObject(listingId)` returns `notExists`. Read it instead via the table's dynamic field:
> `suix_getDynamicFieldObject(<listingsTableId>, { type: "0x2::object::ID", value: <listingId> })`, where the listing fields live under `content.fields.value.fields`. (Discover the `listingsTableId` from the marketplace object's `listings.fields.id.id`.) Listing discovery for the grid uses `DatasetListed` events.

---

## Walrus API

### Upload
```
PUT https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs={N}
Content-Type: application/octet-stream

<file bytes>
```

**Response:**
```json
{
  "newlyCreated": {
    "blobObject": {
      "blobId": "...",
      "id": "...",
      "size": 12345,
      "certifiedEpoch": 100,
      "storageEpochs": 5
    },
    "cost": 1000000
  }
}
```

### Download
```
GET https://aggregator.walrus-testnet.walrus.space/v1/blobs/{BLOB_ID}
```

**Response:** Raw file bytes

### Verify
Download and compute SHA256 hash, compare with stored hash.

---

## MCP Server Tools

### `search_nexus_datasets`
Search for datasets by category, price, or keyword.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | `string` | No | Filter by category |
| `maxPrice` | `number` | No | Max price in MIST |
| `keyword` | `string` | No | Search keyword |
| `limit` | `number` | No | Max results (default 10) |

**Example:**
```json
{
  "category": "embeddings",
  "maxPrice": 1000000000,
  "keyword": "GPT"
}
```

---

### `get_dataset_details`
Get full metadata for a listing. Reads the wrapped listing via `suix_getDynamicFieldObject` (see the note under Smart Contract API → Objects), not `sui_getObject`.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listingId` | `string` | Yes | Listing object ID |

---

### `check_dataset_purchase`
Check whether a wallet already owns access (a `DatasetAccess`) for a listing — lets an agent avoid the `EAlreadyPurchased` abort before buying, or confirm download rights after.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | `string` | Yes | Wallet address to check |
| `listingId` | `string` | Yes | Listing object ID |

**Returns:** `{ hasPurchased: boolean, canDownload: boolean, ... }`

---

### `get_walrus_blob`
Download a blob from Walrus.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `blobId` | `string` | Yes | Walrus blob ID |
| `expectedHash` | `string` | No | SHA256 for verification |

---

### `get_marketplace_stats`
Get marketplace overview.

**Parameters:** None

---

### `verify_dataset_integrity`
Verify blob integrity.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `blobId` | `string` | Yes | Walrus blob ID |
| `expectedHash` | `string` | Yes | Expected SHA256 |

---

### `buy_dataset`  *(opt-in, custodial signing)*
Autonomously purchase a dataset — the **server signs and submits** the `buy_dataset` transaction with a custodial key, mints a `DatasetAccess`, and returns the digest. Pre-checks `check_dataset_purchase` to avoid the `EAlreadyPurchased` abort. Signs via the public fullnode (reads still go through Tatum).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listingId` | `string` | Yes | Listing object ID to purchase |

**Returns:** `{ signed, buyer, listingId, priceMist, digest, accessId, explorer }` on success; if signing is disabled, returns instructions instead.

**Enable it:** start the server with `NEXUS_ENABLE_SIGNING=true` and `SUI_PRIVATE_KEY=<dedicated low-balance TESTNET key>`. ⚠️ The key can spend funds — use a throwaway testnet key only. Disabled by default; without it, the wallet purchase flow is used instead.

---

## Sui RPC (via Tatum)

### Endpoint
```
https://sui-testnet.gateway.tatum.io
```

### Auth
```
x-api-key: <TATUM_API_KEY>
```

### Common Methods
| Method | Purpose |
|--------|---------|
| `sui_getObject` | Get a standalone object (e.g. the `Marketplace`) by ID |
| `suix_getDynamicFieldObject` | Read a `DatasetListing` from the marketplace `listings` table |
| `suix_queryEvents` | Query `DatasetListed` / `DatasetPurchased` events |
| `suix_getOwnedObjects` | Find a buyer's `DatasetAccess` objects (proof of purchase) |
| `sui_getLatestCheckpointSequenceNumber` | Latest checkpoint |

> The frontend uses these via a plain `fetch` (not the `@mysten/sui` SDK client) — the SDK adds a `client-sdk-version` header that the Tatum gateway's CORS rejects in the browser — and prefers Tatum, falling back to the public Sui fullnode if no key is set. The MCP server and scripts call Tatum directly.

---

## Tatum MCP Server

**Package:** `@tatumio/blockchain-mcp`

**Key Tools:**
| Tool | Description |
|------|-------------|
| `gateway_execute_rpc` | Raw RPC on any chain |
| `get_wallet_portfolio` | Wallet balance |
| `get_transaction_history` | TX history |
| `get_metadata` | Object metadata |
| `check_owner` | Verify ownership |
