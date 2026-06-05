# Nexus Architecture

## Overview

Nexus is a decentralized AI model and memory marketplace built on Sui. Data providers upload massive AI training datasets to Walrus decentralized storage and list them for sale on the Sui blockchain. AI agents can autonomously discover, evaluate, and purchase datasets through the MCP (Model Context Protocol) server.

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Agent (LLM)                       │
│                    ↕ MCP Protocol (stdio)                    │
├─────────────────────────────────────────────────────────────┤
│                   Nexus MCP Server                          │
│            (Node.js + @modelcontextprotocol/sdk)            │
│         search_nexus_datasets | get_dataset_details         │
│         get_walrus_blob | get_marketplace_stats              │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│    ┌─────────▼──────────┐    ┌─────────────────────────┐   │
│    │   Sui Blockchain   │    │   Walrus Storage         │   │
│    │  (via Tatum RPC)   │    │  (Publisher/Aggregator)  │   │
│    │                    │    │                          │   │
│    │  Marketplace obj   │    │  Blob storage with       │   │
│    │  DatasetListing    │    │  RedStuff erasure coding  │   │
│    │  DatasetAccess     │    │                          │   │
│    │  ProviderCap       │    │                          │   │
│    └────────────────────┘    └─────────────────────────┘   │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│                   SvelteKit Frontend                        │
│            (Svelte 5 + TypeScript + Vite)                   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Nav    │  │  Hero +  │  │  Upload  │  │ Dataset  │   │
│  │ (sticky) │  │  Market  │  │  (drop   │  │  Detail  │   │
│  │          │  │  Grid    │  │  zone)   │  │ (sidebar)│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## System Components

### 1. Smart Contracts (Sui Move)

**Package:** `0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6`

**Modules:**
- `nexus_marketplace` — Core marketplace logic, including the `DatasetListed` / `DatasetPurchased` / `DatasetDelisted` events emitted for indexing

**Objects:**

| Object | Type | Owner | Purpose |
|--------|------|-------|---------|
| `Marketplace` | Shared | Shared | Holds `listings: Table<ID, DatasetListing>`, treasury, fee config, stats |
| `DatasetListing` | Wrapped in the `listings` table | Marketplace | A dataset for sale; includes a `purchasers: Table<address,bool>` to block double-buys |
| `DatasetAccess` | Owned | Buyer | Proves purchase, grants download |
| `ProviderCap` | Owned | Provider | Capability required to delist |

> Because each `DatasetListing` is wrapped inside the marketplace table, it is **not** directly fetchable via `sui_getObject` (returns `notExists`). Both the frontend and the MCP server read listings via `suix_getDynamicFieldObject` on the table, and discover them via `DatasetListed` events.

**Functions:**

| Function | Purpose |
|----------|---------|
| `list_dataset` | Create a new listing (provider); returns a `ProviderCap` |
| `buy_dataset` | Purchase a listing (buyer); blocks double-buys (`EAlreadyPurchased`), refunds overpayment from the buyer's coin |
| `delist_dataset` | Remove listing (provider only, via `ProviderCap`) |
| `get_listing` / `get_marketplace_stats` | View listing / marketplace stats |
| `has_purchased` | Whether an address already bought a listing |
| `withdraw_fees` / `update_fee` / `set_paused` | Admin controls |

**Economic Model:**
- Prices in MIST (1 SUI = 1,000,000,000 MIST)
- 2% platform fee (200 bps) on all sales
- 98% to provider, 2% to treasury

### 2. Frontend (SvelteKit 2)

**Tech Stack:**
- Svelte 5 with runes mode (`$state`, `$derived`, `$props`)
- TypeScript (strict mode)
- Vite bundler
- Pure CSS custom properties (no Tailwind)

**Design System:**
- Bone/clay palette (warm, light mode)
- Space Grotesk (headings) + Spline Sans Mono (body)
- Convergence mark SVG logo

**Pages:**

| Route | Purpose |
|-------|---------|
| `/` | Homepage: hero, marketplace grid, steps, stats, CTA |
| `/upload` | Provider portal: drop zone, form, Walrus upload, Sui listing |
| `/dataset/[id]` | Dataset detail: metadata, sidebar, download, verify |

**Key Libraries:**
- `$lib/wallet/store.ts` — Sui Wallet Standard integration (connect + sign with the active account)
- `$lib/walrus/client.ts` — Walrus HTTP API (upload/download/verify)
- `$lib/sui/config.ts` — browser-safe `rpc()` (raw fetch, Tatum-preferred + public-fullnode fallback), dynamic-field listing reads (`getListingFields`), PTB builders, and Suiscan link helpers
- `$lib/components/Mark.svelte` — Convergence mark SVG

### 3. MCP Server (Node.js)

**Package:** `@modelcontextprotocol/sdk`

**Tools:**

| Tool | Description |
|------|-------------|
| `search_nexus_datasets` | Search by category, price, keyword (via events) |
| `get_dataset_details` | Get full listing metadata (via dynamic field) |
| `check_dataset_purchase` | Whether an address already owns access to a listing |
| `get_walrus_blob` | Download blob from Walrus |
| `get_marketplace_stats` | Marketplace overview |
| `verify_dataset_integrity` | Check blob hash |

The stock `@tatumio/blockchain-mcp` server is composed alongside it (see [Deployment.md](./Deployment.md#4-configure-in-an-ai-client-two-server-composition)).

**Resources:**

| Resource | Description |
|----------|-------------|
| `marketplace://overview` | Current marketplace state |

### 4. Storage (Walrus)

**Endpoints (Testnet):**
- Publisher: `https://publisher.walrus-testnet.walrus.space`
- Aggregator: `https://aggregator.walrus-testnet.walrus.space`

**Upload Flow:**
1. `PUT /v1/blobs?epochs=N` with file body
2. Response: `newlyCreated.blobObject.blobId`
3. Store blob ID in Sui listing

**Download Flow:**
1. `GET /v1/blobs/<BLOB_ID>`
2. Returns raw file data
3. Verify SHA256 hash if available

**Encoding:** RS2 (RedStuff) erasure coding

### 5. RPC Gateway (Tatum)

**Endpoints:**
- Testnet: `https://sui-testnet.gateway.tatum.io`
- Auth: `x-api-key` header

**Usage:**
- MCP server + scripts call Tatum directly (raw JSON-RPC), with the public fullnode as a fallback.
- Frontend uses a raw-`fetch` `rpc()` helper (Tatum-preferred when a key is set, public-fullnode fallback). It avoids the `@mysten/sui` SDK client in the browser because the SDK's `client-sdk-version` header is rejected by Tatum's CORS.

## Data Flow

### Upload Flow (Provider)
```
Provider → Frontend (drop zone)
  → Walrus Publisher (PUT /v1/blobs)
    → Returns blobId
  → Build list_dataset PTB
  → Wallet signs transaction
  → Sui blockchain (DatasetListing created)
  → ProviderCap transferred to provider
```

### Purchase Flow (Consumer)
```
Consumer → Frontend (dataset detail page)
  → Build buy_dataset PTB
  → Wallet signs transaction
  → Sui blockchain:
    → 2% fee to treasury
    → 98% to provider
    → DatasetAccess transferred to buyer
  → Buyer downloads from Walrus Aggregator
```

### Agent Flow (AI)
```
AI Agent → MCP Server (stdio)
  → search_nexus_datasets (query DatasetListed events)
  → get_dataset_details (read listing via dynamic field)
  → check_dataset_purchase (skip if already owned)
  → [wallet signs buy_dataset PTB]
  → get_walrus_blob (download data)
  → verify_dataset_integrity (check hash)
```

## Contract Deployment

**Network:** Sui Testnet (chain ID: `4c78adac`)

**Deployed Objects:**
- Package: `0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6`
- Marketplace: `0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99`

**Existing Listings:**
| Name | Category | Price | Blob ID |
|------|----------|-------|---------|
| LoRA-Weights | model-weights | 1 SUI | `Zkw-aZCSW8EMuZHmXh_fq-J3qlVnQcPEj9t9M46WOeQ` |
| FineTuning-Dataset | fine-tuning | 0.25 SUI | `aGir1MudixR_2MezEKRfKHzqwXkBzD1xd9iaFhamZQ0` |
| GPT2-Embeddings | embeddings | 0.5 SUI | `BBCZfBAb6FI8zHOHa7ztwPBUHvcIJd3X9TARW7RVX8w` |

## Security Considerations

- **Object Ownership:** DatasetListing can only be delisted by the original provider (via ProviderCap; the contract also re-checks `provider == sender`)
- **Payment Security:** Takes exactly `price` from the payment, refunds overpayment from the buyer's own coin (never the treasury), pays the provider `price − fee`
- **Double-buy prevention:** A `purchasers` table on each listing blocks repeat purchases by the same address (`EAlreadyPurchased`)
- **Fee Protection:** Platform fee hardcoded at 200 bps, max 10% (admin can update)
- **Input Validation:** Non-empty names, descriptions, blob IDs; positive prices
- **Wallet Integration:** Uses Sui Wallet Standard (no private keys in code)
