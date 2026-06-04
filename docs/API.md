# Nexus API Reference

## Smart Contract API

### Package
```
0xd4121a4525729f9319db53d66967f0669a5eff6603009d346befe9bac5b74816
```

### Module: `nexus_marketplace`

#### `list_dataset`
List a new dataset on the marketplace.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `marketplace` | `&mut Marketplace` | Shared marketplace object |
| `name` | `String` | Dataset name (non-empty) |
| `description` | `String` | Dataset description (non-empty) |
| `category` | `String` | Category (e.g., "embeddings") |
| `walrus_blob_id` | `String` | Walrus blob ID (non-empty) |
| `size_bytes` | `u64` | File size in bytes |
| `price` | `u64` | Price in MIST (> 0) |
| `content_hash` | `Option<String>` | Optional SHA256 hash |
| `storage_epochs` | `Option<u64>` | Optional Walrus storage epochs |
| `clock` | `&Clock` | Sui system clock |

**Returns:** `ID` — The listing object ID

**Events:** Emits `DatasetListed`

---

#### `buy_dataset`
Purchase a dataset listing.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `marketplace` | `&mut Marketplace` | Shared marketplace object |
| `listing_id` | `ID` | Listing to purchase |
| `payment` | `Coin<SUI>` | Payment (>= price) |
| `clock` | `&Clock` | Sui system clock |

**Behavior:**
- Splits payment: 2% to treasury, 98% to provider
- Creates `DatasetAccess` for buyer
- Refunds excess payment if any

**Events:** Emits `DatasetPurchased`

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
Get full metadata for a listing.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listingId` | `string` | Yes | Listing object ID |

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
| `sui_getObject` | Get object by ID |
| `suix_queryEvents` | Query events by type |
| `suix_getOwnedObjects` | Get objects owned by address |
| `sui_getLatestCheckpointSequenceNumber` | Latest checkpoint |

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
