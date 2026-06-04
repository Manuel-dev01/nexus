<p align="center">
  <img src="https://img.shields.io/badge/Built%20on-Sui-4DA2FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=" alt="Sui" />
  <img src="https://img.shields.io/badge/Storage-Walrus-37C3B0?style=for-the-badge" alt="Walrus" />
  <img src="https://img.shields.io/badge/RPC-Tatum-6C5CE7?style=for-the-badge" alt="Tatum" />
  <img src="https://img.shields.io/badge/Protocol-MCP-FF6B6B?style=for-the-badge" alt="MCP" />
</p>

<h1 align="center">🔮 Nexus</h1>
<h3 align="center">The First Decentralized Marketplace Where AI Agents<br/>Autonomously Purchase and Ingest Their Own Memory</h3>

<p align="center">
  <em>AI datasets stored on <strong>Walrus</strong> decentralized storage, traded on <strong>Sui</strong> smart contracts,<br/>queried and purchased by autonomous agents via <strong>Tatum MCP</strong>.</em>
</p>

---

## 🎯 What is Nexus?

**Nexus** is a decentralized AI model & memory marketplace built natively on the Sui blockchain. It solves a critical problem: **AI systems need access to massive, high-quality training datasets, but current data marketplaces are centralized, opaque, and inaccessible to autonomous agents.**

Nexus flips this model:

1. **Data Providers** upload massive AI datasets to [Walrus](https://wal.app) decentralized storage and list them on-chain with a SUI price.
2. **Data Consumers** browse, pay, and receive token-gated download access — all on-chain.
3. **AI Agents** (the differentiator) autonomously discover, evaluate, and purchase datasets through a [Tatum](https://tatum.io) MCP Server — no human clicks required.

> *"What if your AI could buy its own training data?"* — That's Nexus.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     NEXUS ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌─────────────┐    ┌────────────────────┐ │
│  │ SvelteKit│───▶│ Tatum Sui   │───▶│   Sui Blockchain   │ │
│  │ Frontend │    │ RPC Gateway │    │ (Move Contracts)   │ │
│  └────┬─────┘    └─────────────┘    │                    │ │
│       │                             │ • Marketplace      │ │
│       │ Upload/                     │ • DatasetListing   │ │
│       │ Download                    │ • DatasetAccess    │ │
│       ▼                             │ • NexusTreasury    │ │
│  ┌──────────┐                       └────────────────────┘ │
│  │  Walrus  │    RedStuff Erasure Coding                   │
│  │ Storage  │    Across Decentralized Nodes                │
│  └──────────┘                                              │
│                                                             │
│  ┌──────────┐    ┌─────────────┐    ┌────────────────────┐ │
│  │ AI Agent │───▶│ Nexus MCP   │───▶│ Tatum RPC + Walrus │ │
│  │ (LLM)   │    │ Server      │    │ Aggregator         │ │
│  └──────────┘    └─────────────┘    └────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐳 Walrus Integration (Decentralized Storage)

Nexus uses **Walrus** as its backbone for storing massive AI datasets. Instead of trusting a centralized cloud provider, all data is:

- **Erasure-coded** using RedStuff (RS2) across a decentralized network of storage nodes
- **Content-addressed** via cryptographic Blob IDs
- **Publicly retrievable** via the Walrus Aggregator — no authentication needed for reads

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Upload Dataset | `PUT publisher.walrus-testnet.walrus.space/v1/blobs` | HTTP PUT |
| Download Dataset | `GET aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}` | HTTP GET |

**Why Walrus?** Traditional IPFS pinning is unreliable. Centralized storage defeats decentralization. Walrus provides **guaranteed availability** through economic incentives and erasure coding — perfect for datasets that must be reliably available for AI agents purchasing access.

---

## ⚡ Tatum Integration (RPC Gateway + MCP)

Nexus uses **Tatum** at two critical layers:

### 1. Sui RPC Gateway
All blockchain interactions — from the frontend wallet to backend scripts — are routed through Tatum's managed Sui RPC gateway:
```
https://sui-testnet.gateway.tatum.io
```
This ensures reliable, low-latency access to the Sui network without running our own full node.

### 2. Model Context Protocol (MCP) Server
Nexus implements a **custom MCP server** that exposes domain-specific tools for AI agents, powered by Tatum's RPC infrastructure:

| MCP Tool | Description | Backed By |
|----------|-------------|-----------|
| `search_nexus_datasets` | Find datasets by metadata, price range | Tatum `sui_queryEvents` |
| `get_dataset_details` | Get full listing info including Blob ID | Tatum `sui_getObject` |
| `get_walrus_blob` | Download raw dataset from Walrus | Walrus Aggregator |

The Tatum `@tatumio/blockchain-mcp` server runs alongside for generic blockchain data (wallet balances, transaction history, etc.).

---

## 🔄 The Autonomous Flow

```
Data Provider                    AI Agent                      Sui + Walrus
     │                               │                              │
     │  1. Upload dataset to Walrus  │                              │
     │──────────────────────────────▶│         Walrus Publisher     │
     │        ◀── Blob ID ──────────│                              │
     │                               │                              │
     │  2. List on Sui (PTB)         │                              │
     │──────────────────────────────▶│      Tatum Sui Gateway      │
     │     DatasetListing created    │                              │
     │                               │                              │
     │                               │  3. "Find me a dataset       │
     │                               │      on stablecoin prices"   │
     │                               │──────── Nexus MCP ─────────▶│
     │                               │  ◀─── Listing found ───────│
     │                               │                              │
     │                               │  4. Purchase (sign PTB)      │
     │                               │──────── Tatum RPC ─────────▶│
     │    ◀── SUI payment ──────────│   DatasetAccess minted       │
     │                               │                              │
     │                               │  5. Download via Walrus      │
     │                               │──────── Aggregator ────────▶│
     │                               │  ◀─── Raw dataset ─────────│
     │                               │                              │
     │                               │  6. AI ingests new memory    │
```

---

## 🌐 Live Demo

**Frontend:** https://nexus-l6qjs42ha-manuel-dev01s-projects.vercel.app

**Deployed Contracts (Sui Testnet):**
| Contract | Object ID |
|----------|-----------|
| Package | `0xd4121a4525729f9319db53d66967f0669a5eff6603009d346befe9bac5b74816` |
| Marketplace | `0x7718f693693cac1637a972ae9a6cf14fdacb0d275a8c8b1aef34eb4b4dae1bce` |

**Seeded Datasets:**
| Dataset | Category | Price | Walrus Blob ID |
|---------|----------|-------|----------------|
| GPT-2 Embedding Vectors | embeddings | 0.5 SUI | `CxrYYF3kB_Pv9na0JNXTbVohjkemkFI0wL4kqnCK9Ls` |
| Fine-Tuning Dataset | fine-tuning | 0.25 SUI | `Tzs6Sfk1aL4pysTUVxJRRjhf14TFJ4jY9VTNacFRz-U` |
| LoRA Adapter Weights | model-weights | 1.0 SUI | `81FtoDN5MhiLhm0gQBvAEpwEGj5woOWS6PkfFaQgTEE` |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [Sui CLI](https://docs.sui.io/build/install) (latest)
- [Tatum API Key](https://tatum.io/) (free tier)

### Setup
```bash
git clone https://github.com/YOUR_USERNAME/nexus.git
cd nexus

# Configure environment
cp .env.example .env
# Edit .env with your Tatum API key and Sui wallet key

# Deploy contracts
cd move && sui client publish --gas-budget 100000000
# Copy package ID to .env

# Seed marketplace with demo datasets
cd ../scripts && npx tsx seed_marketplace.ts

# Start frontend
cd ../frontend && npm install && npm run dev

# Start MCP servers (in separate terminal)
cd ../mcp-server && npm install && npm start
```

---

## 📁 Repository Structure

```
nexus/
├─ .agents/                        # Architecture decisions & task tracking
├─ antigravity.md                  # Engineering manual (source of truth)
├─ README.md                       # You are here
├─ .env.example                    # Environment template
├─ move/                           # Sui Smart Contracts
│  ├─ Move.toml
│  ├─ sources/
│  │  ├─ nexus_marketplace.move    # Core marketplace logic
│  │  └─ nexus_events.move         # Event definitions
│  └─ tests/
├─ frontend/                       # SvelteKit App
│  ├─ src/
│  │  ├─ routes/                   # Pages: /, /upload, /dataset/[id]
│  │  └─ lib/
│  │     ├─ walrus/                # Walrus upload/download wrappers
│  │     └─ sui/                   # Tatum RPC config & PTB builders
├─ mcp-server/                     # Nexus MCP Server (AI Agent layer)
│  ├─ package.json
│  └─ src/index.ts                 # Tool definitions
└─ scripts/
   ├─ deploy_contracts.sh
   └─ seed_marketplace.ts          # Deterministic demo seeder
```

---

## 🏆 Prize Track Alignment

| Prize | How Nexus Qualifies |
|-------|-------------------|
| **🥇 Grand Prize** | Full-stack dApp: Move contracts + SvelteKit UI + AI agent integration |
| **🐳 Best Walrus Integration** | All datasets stored on Walrus with RedStuff erasure coding. Upload, download, and blob management are core to the product. |
| **⚡ Best Use of Tatum Tools** | Every Sui RPC call routes through Tatum gateway. Custom MCP server enables AI agents to autonomously interact with the marketplace. Two-server MCP composition (Tatum + Nexus). |

---

## 📄 License

MIT

---

<p align="center">
  <strong>Built with 🔮 for the Sui x Walrus x Tatum Hackathon</strong>
</p>
