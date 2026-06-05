<p align="center">
  <img src="https://img.shields.io/badge/Built%20on-Sui-4DA2FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=" alt="Sui" />
  <img src="https://img.shields.io/badge/Storage-Walrus-37C3B0?style=for-the-badge" alt="Walrus" />
  <img src="https://img.shields.io/badge/RPC-Tatum-6C5CE7?style=for-the-badge" alt="Tatum" />
  <img src="https://img.shields.io/badge/Protocol-MCP-FF6B6B?style=for-the-badge" alt="MCP" />
</p>

<h1 align="center">Nexus</h1>
<h3 align="center">The First Decentralized Marketplace Where AI Agents<br/>Autonomously Purchase and Ingest Their Own Memory</h3>

<p align="center">
  <em>AI datasets stored on <strong>Walrus</strong> decentralized storage, traded on <strong>Sui</strong> smart contracts,<br/>queried and purchased by autonomous agents via <strong>Tatum MCP</strong>.</em>
</p>

---

## What is Nexus?

**Nexus** is a decentralized AI model and memory marketplace built natively on the Sui blockchain. It solves a critical problem: AI systems need access to massive, high-quality training datasets, but current data marketplaces are centralized, opaque, and inaccessible to autonomous agents.

Nexus flips this model:

1. **Data Providers** upload massive AI datasets to [Walrus](https://wal.app) decentralized storage and list them on-chain with a SUI price.
2. **Data Consumers** browse, pay, and receive token-gated download access, all on-chain.
3. **AI Agents** (the differentiator) autonomously discover, evaluate, and purchase datasets through a [Tatum](https://tatum.io) MCP Server, with no human clicks required.

> *What if your AI could buy its own training data?* That's Nexus.

---

## Architecture

```
+--------------------------------------------------------------+
|                      NEXUS ECOSYSTEM                          |
+--------------------------------------------------------------+
|                                                                |
|  +----------+    +-------------+    +---------------------+   |
|  | SvelteKit|--->| Tatum Sui   |--->|   Sui Blockchain    |   |
|  | Frontend |    | RPC Gateway |    | (Move Contracts)    |   |
|  |          |    +-------------+    |                     |   |
|  | Upload/  |                       | - Marketplace       |   |
|  | Download |                       | - DatasetListing    |   |
|  |          |                       | - DatasetAccess     |   |
|  +----+-----+                       | - NexusTreasury     |   |
|       |                             +---------------------+   |
|       v                                                        |
|  +----------+    RedStuff Erasure Coding                      |
|  |  Walrus  |    Across Decentralized Nodes                   |
|  | Storage  |                                                  |
|  +----------+                                                  |
|                                                                |
|  +----------+    +-------------+    +---------------------+   |
|  | AI Agent |--->| Nexus MCP   |--->| Tatum RPC + Walrus  |   |
|  | (LLM)   |    | Server      |    | Aggregator          |   |
|  +----------+    +-------------+    +---------------------+   |
|                                                                |
+--------------------------------------------------------------+
```

> For a detailed architecture breakdown, see [docs/Architecture.md](docs/Architecture.md).

---

## Live Demo

**Frontend:** https://nexus-l6qjs42ha-manuel-dev01s-projects.vercel.app

> ⚠️ **Public access:** the Vercel project must have **Deployment Protection → Vercel Authentication disabled** for this URL to load without a Vercel login. If you hit a login wall, that toggle is still on — see [docs/Deployment.md](docs/Deployment.md#required-vercel-dashboard-settings).

**Deployed Contracts (Sui Testnet):**

| Contract | Object ID (click to verify on Suiscan) |
|----------|-----------|
| Package | [`0x2797464…c6b393e7`](https://suiscan.xyz/testnet/object/0x2797464179d14bd6ac9463019abb2000d840fc33547b378372ed3b6fc6b393e7) |
| Marketplace | [`0xac47e84…5f417430`](https://suiscan.xyz/testnet/object/0xac47e84574ce49163c02c2ea7f9e472aa45fcf64de599b97e8cac2e95f417430) |

**Seeded Datasets:**

| Dataset | Category | Price | Walrus Blob ID |
|---------|----------|-------|----------------|
| GPT-2 Embedding Vectors | embeddings | 0.5 SUI | `njQKp7aFXHLNd6PzKGcZYQEt9-UU2m3a9nASmIC8OU8` |
| Fine-Tuning Dataset | fine-tuning | 0.25 SUI | `aGir1MudixR_2MezEKRfKHzqwXkBzD1xd9iaFhamZQ0` |
| LoRA Adapter Weights | model-weights | 1.0 SUI | `rusSEWN3gYhFC-FZicd9KU1BCXt-HIvT9gF1Yc-tIQo` |

---

## Status

**Code complete & verified** — Move contracts (**15/15 tests**, deployed `0x2797464…`), SvelteKit frontend (builds clean), and the **7-tool MCP server** (`test-mcp` 9/1) are all wired against the live testnet deployment.

**Beyond the core marketplace, the contract + UI also implement:**
- **Multi-token payments** — `list_dataset<T>` / `buy_dataset<T>` are generic over the payment coin type; each listing stores its `coin_type` and the UI shows/charges in that currency.
- **Encrypted datasets (Seal)** — datasets can be encrypted client-side with [Mysten Seal](https://github.com/MystenLabs/seal); the on-chain `seal_approve(id, &DatasetAccess)` releases the decryption key only to buyers (token-gated decryption).
- **Autonomous purchasing** — the MCP server can sign and submit `buy_dataset` itself with a custodial key (opt-in `NEXUS_ENABLE_SIGNING`), so the agent completes the trade end-to-end.

Remaining: re-set the Vercel env vars to the current addresses + redeploy the frontend; a browser+wallet pass on the Seal encrypt→buy→decrypt loop (live key-server round-trips can't be verified headless); record/verify the demo; submit.

→ Full triaged status & checklist: **[docs/Blockers.md](docs/Blockers.md)**

---

## Walrus Integration (Decentralized Storage)

Nexus uses **Walrus** as its backbone for storing massive AI datasets. Instead of trusting a centralized cloud provider, all data is:

- **Erasure-coded** using RedStuff (RS2) across a decentralized network of storage nodes
- **Content-addressed** via cryptographic Blob IDs
- **Publicly retrievable** via the Walrus Aggregator with no authentication needed for reads

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Upload Dataset | `PUT publisher.walrus-testnet.walrus.space/v1/blobs` | HTTP PUT |
| Download Dataset | `GET aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}` | HTTP GET |

**Why Walrus?** Traditional IPFS pinning is unreliable. Centralized storage defeats decentralization. Walrus provides guaranteed availability through economic incentives and erasure coding, making it ideal for datasets that must be reliably available for AI agents purchasing access.

> For the full Walrus API reference, see [docs/API.md](docs/API.md).

---

## Tatum Integration (RPC Gateway + MCP)

Nexus uses **Tatum** at two critical layers:

### 1. Sui RPC Gateway

Sui reads are routed through Tatum's managed Sui RPC gateway:

```
https://sui-testnet.gateway.tatum.io
```

The **MCP server and scripts** call Tatum directly. The **frontend prefers Tatum** (when `PUBLIC_TATUM_API_KEY` is set) and automatically falls back to the public Sui fullnode otherwise — it uses a plain `fetch` rather than the `@mysten/sui` SDK client, because the SDK adds a `client-sdk-version` header that the gateway's CORS rejects in the browser. This gives reliable, low-latency access without running our own full node.

### 2. Model Context Protocol (MCP) Server

Nexus implements a **custom MCP server** that exposes domain-specific tools for AI agents, powered by Tatum's RPC infrastructure:

| MCP Tool | Description | Backed By |
|----------|-------------|-----------|
| `search_nexus_datasets` | Find datasets by metadata and price range | Tatum `suix_queryEvents` |
| `get_dataset_details` | Get full listing info including Blob ID | Tatum `suix_getDynamicFieldObject` |
| `check_dataset_purchase` | Whether a wallet already owns access to a listing | Tatum `suix_getOwnedObjects` |
| `get_walrus_blob` | Download raw dataset from Walrus | Walrus Aggregator |
| `get_marketplace_stats` | Get marketplace overview | Tatum `sui_getObject` |
| `verify_dataset_integrity` | Verify blob hash matches expected | Walrus Aggregator |
| `buy_dataset` *(opt-in)* | Agent signs & submits the purchase itself (custodial key) | Sui fullnode signing |

The Tatum `@tatumio/blockchain-mcp` server runs alongside for generic blockchain data (wallet balances, transaction history, etc.).

**📦 Published on npm** — run the Nexus MCP server with zero clone:
```bash
npx -y @olanuel/nexus-mcp-server
```
→ [`@olanuel/nexus-mcp-server`](https://www.npmjs.com/package/@olanuel/nexus-mcp-server) on npm.

> Full API reference: [docs/API.md](docs/API.md) · Wiring both MCP servers into an AI client: [docs/Deployment.md](docs/Deployment.md#4-configure-in-an-ai-client-two-server-composition) · Publishing guide: [docs/Publishing-MCP.md](docs/Publishing-MCP.md).

---

## The Autonomous Flow

```
Data Provider                    AI Agent                      Sui + Walrus
     |                               |                              |
     |  1. Upload dataset to Walrus  |                              |
     |------------------------------>|         Walrus Publisher     |
     |        <-- Blob ID ----------|                              |
     |                               |                              |
     |  2. List on Sui (PTB)         |                              |
     |------------------------------>|      Tatum Sui Gateway      |
     |     DatasetListing created    |                              |
     |                               |                              |
     |                               |  3. Find me a dataset       |
     |                               |     on stablecoin prices    |
     |                               |-------- Nexus MCP --------->|
     |                               |  <----- Listing found ------|
     |                               |                              |
     |                               |  4. Purchase (sign PTB)      |
     |                               |-------- Tatum RPC --------->|
     |    <-- SUI payment ----------|   DatasetAccess minted       |
     |                               |                              |
     |                               |  5. Download via Walrus      |
     |                               |-------- Aggregator -------->|
     |                               |  <----- Raw dataset --------|
     |                               |                              |
     |                               |  6. AI ingests new memory    |
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Sui CLI](https://docs.sui.io/build/install) (latest)
- [Tatum API Key](https://tatum.io/) (free tier)

> **Note:** the contracts in [Live Demo](#live-demo) are already deployed to Sui Testnet **and pre-seeded with the 3 datasets above.** You only need the deploy + seed steps below if you want to run your *own* independent instance.

### Setup

```bash
git clone https://github.com/Manuel-dev01/nexus.git
cd nexus

# Configure environment
cp .env.example .env
# Edit .env with your Tatum API key and Sui wallet key (see .env.example for which
# vars each component needs). The frontend reads frontend/.env (PUBLIC_* vars).

# Run against the existing testnet deployment (fastest) — just start the app:
cd frontend && npm install && npm run dev

# --- OR, to stand up your own instance: ---

# Deploy contracts, then copy the printed package + marketplace IDs into .env
cd move && sui client publish --gas-budget 100000000

# Seed your fresh marketplace with the 3 demo datasets (needs SUI_PRIVATE_KEY
# with testnet gas). Skip this if using the already-seeded testnet deployment.
cd ../scripts && npm install && npx tsx seed_marketplace.ts

# Start MCP server (separate terminal; needs TATUM_API_KEY for Tatum-routed reads)
cd ../mcp-server && npm install && npm run build && npm start
```

> For full deployment instructions, see [docs/Deployment.md](docs/Deployment.md).

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/Architecture.md) | System architecture, data flows, security model |
| [API Reference](docs/API.md) | Smart contract API, Walrus API, MCP tools, Sui RPC |
| [Deployment Guide](docs/Deployment.md) | Contract deployment, frontend deploy, MCP server setup |
| [Testing Guide](docs/Testing-Guide.md) | End-to-end runbook: contracts → Walrus → Tatum → MCP → frontend → full flow |
| [Blockers & Gaps](docs/Blockers.md) | Triaged open issues, verified state, and what's been fixed |

---

## Repository Structure

```
nexus/
+-- docs/                           # Project documentation
|   +-- Architecture.md             # System architecture
|   +-- API.md                      # API reference
|   +-- Deployment.md               # Deployment guide
|   +-- Demo-Verification-Flow.md   # Demo and verification guide
+-- move/                           # Sui Smart Contracts
|   +-- Move.toml
|   +-- sources/
|   |   +-- nexus_marketplace.move  # Core marketplace logic (objects, events, fees)
|   +-- tests/                      # Move unit tests (15 tests)
+-- frontend/                       # SvelteKit 2 App (Svelte 5)
|   +-- src/
|   |   +-- routes/                 # Pages: /, /upload, /dataset/[id]
|   |   +-- lib/
|   |       +-- wallet/             # Sui Wallet Standard integration
|   |       +-- walrus/             # Walrus upload/download wrappers
|   |       +-- sui/                # Tatum RPC config and PTB builders
|   |       +-- components/         # Convergence mark SVG
+-- mcp-server/                     # Nexus MCP Server (AI Agent layer)
|   +-- package.json
|   +-- src/index.ts                # Tool definitions
+-- scripts/                        # Test and utility scripts
|   +-- test-contracts.ts           # Contract E2E tests
|   +-- test-mcp.ts                 # MCP server tests
|   +-- e2e-test.ts                 # Frontend E2E tests
+-- .env.example                    # Environment template
+-- README.md                       # You are here
```

---

## Prize Track Alignment

| Prize | How Nexus Qualifies |
|-------|-------------------|
| **Grand Prize** | Full-stack dApp: Move contracts + SvelteKit UI + AI agent integration |
| **Best Walrus Integration** | All datasets stored on Walrus with RedStuff erasure coding. Upload, download, and blob management are core to the product. |
| **Best Use of Tatum Tools** | Every Sui RPC call routes through Tatum gateway. Custom MCP server enables AI agents to autonomously interact with the marketplace. Two-server MCP composition (Tatum + Nexus). |

---

## License

MIT

---

<p align="center">
  <strong>Built with care for the Sui x Walrus x Tatum Hackathon</strong>
</p>
