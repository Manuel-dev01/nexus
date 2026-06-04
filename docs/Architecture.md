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

**Package:** `0xd4121a4525729f9319db53d66967f0669a5eff6603009d346befe9bac5b74816`

**Modules:**
- `nexus_marketplace` — Core marketplace logic
- `nexus_events` — Event type definitions for indexing

**Objects:**

| Object | Type | Owner | Purpose |
|--------|------|-------|---------|
| `Marketplace` | Shared | Shared | Holds all listings, treasury, config |
| `DatasetListing` | Shared | In Marketplace table | A dataset for sale |
| `DatasetAccess` | Owned | Buyer | Proves purchase, grants download |
| `ProviderCap` | Owned | Provider | Controls listing (delist) |

**Functions:**

| Function | Purpose |
|----------|---------|
| `list_dataset` | Create a new listing (provider) |
| `buy_dataset` | Purchase a listing (buyer) |
| `delist_dataset` | Remove listing (provider only) |
| `get_listing` | View listing details |
| `get_marketplace_stats` | View marketplace stats |
| `withdraw_fees` | Withdraw treasury (admin) |

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
- `$lib/wallet/store.ts` — Sui Wallet Standard integration
- `$lib/walrus/client.ts` — Walrus HTTP API (upload/download/verify)
- `$lib/sui/config.ts` — SuiJsonRpcClient via Tatum + PTB builders
- `$lib/components/Mark.svelte` — Convergence mark SVG

### 3. MCP Server (Node.js)

**Package:** `@modelcontextprotocol/sdk`

**Tools:**

| Tool | Description |
|------|-------------|
| `search_nexus_datasets` | Search by category, price, keyword |
| `get_dataset_details` | Get full listing metadata |
| `get_walrus_blob` | Download blob from Walrus |
| `get_marketplace_stats` | Marketplace overview |
| `verify_dataset_integrity` | Check blob hash |

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
- Frontend SuiJsonRpcClient configured with Tatum transport
- MCP server uses direct Sui RPC for reliability

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
  → search_nexus_datasets (query events)
  → get_dataset_details (get metadata)
  → get_walrus_blob (download data)
  → verify_dataset_integrity (check hash)
```

## Contract Deployment

**Network:** Sui Testnet (chain ID: `4c78adac`)

**Deployed Objects:**
- Package: `0xd4121a4525729f9319db53d66967f0669a5eff6603009d346befe9bac5b74816`
- Marketplace: `0x7718f693693cac1637a972ae9a6cf14fdacb0d275a8c8b1aef34eb4b4dae1bce`

**Existing Listings:**
| Name | Category | Price | Blob ID |
|------|----------|-------|---------|
| LoRA-Weights | model-weights | 1 SUI | `81FtoDN5MhiLhm0gQBvAEpwEGj5woOWS6PkfFaQgTEE` |
| FineTuning-Dataset | fine-tuning | 0.25 SUI | `Tzs6Sfk1aL4pysTUVxJRRjhf14TFJ4jY9VTNacFRz-U` |
| GPT2-Embeddings | embeddings | 0.5 SUI | `CxrYYF3kB_Pv9na0JNXTbVohjkemkFI0wL4kqnCK9Ls` |

## Security Considerations

- **Object Ownership:** DatasetListing can only be delisted by the original provider (via ProviderCap)
- **Payment Security:** Uses `coin::split` and `coin::into_balance` for safe SUI handling
- **Fee Protection:** Platform fee hardcoded at 200 bps, max 10% (admin can update)
- **Input Validation:** Non-empty names, descriptions, blob IDs; positive prices
- **Wallet Integration:** Uses Sui Wallet Standard (no private keys in code)
