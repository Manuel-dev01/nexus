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

| Contract | Object ID |
|----------|-----------|
| Package | `0x86208eab6fcdadc33273cc65fed9b43177d7c65105ef88134eb635652d258788` |
| Marketplace | `0xaea5cb73bb7d4b8a6cac69be6dbd7d736cf73ec62563ac87f125c4f0c45f30b2` |

**Seeded Datasets:**

| Dataset | Category | Price | Walrus Blob ID |
|---------|----------|-------|----------------|
| GPT-2 Embedding Vectors | embeddings | 0.5 SUI | `K1Ib_CNCEr7rG9rOiPMYd3NGxiF9x4DtlLoHNJJjEy8` |
| Fine-Tuning Dataset | fine-tuning | 0.25 SUI | `aGir1MudixR_2MezEKRfKHzqwXkBzD1xd9iaFhamZQ0` |
| LoRA Adapter Weights | model-weights | 1.0 SUI | `foce6UR-SRib69uQJf9i6NCbve6fzGZmxbtCr9WzVV8` |

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

All blockchain interactions, from the frontend wallet to backend scripts, are routed through Tatum's managed Sui RPC gateway:

```
https://sui-testnet.gateway.tatum.io
```

This ensures reliable, low-latency access to the Sui network without running our own full node.

### 2. Model Context Protocol (MCP) Server

Nexus implements a **custom MCP server** that exposes domain-specific tools for AI agents, powered by Tatum's RPC infrastructure:

| MCP Tool | Description | Backed By |
|----------|-------------|-----------|
| `search_nexus_datasets` | Find datasets by metadata and price range | Tatum `sui_queryEvents` |
| `get_dataset_details` | Get full listing info including Blob ID | Tatum `sui_getObject` |
| `get_walrus_blob` | Download raw dataset from Walrus | Walrus Aggregator |
| `get_marketplace_stats` | Get marketplace overview | Tatum `sui_getObject` |
| `verify_dataset_integrity` | Verify blob hash matches expected | Walrus Aggregator |

The Tatum `@tatumio/blockchain-mcp` server runs alongside for generic blockchain data (wallet balances, transaction history, etc.).

> For the full API reference, see [docs/API.md](docs/API.md).

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
| [Demo & Verification Flow](docs/Demo-Verification-Flow.md) | Step-by-step guide to verify and demo all features |
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
|   +-- tests/                      # Move unit tests (12 tests)
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
