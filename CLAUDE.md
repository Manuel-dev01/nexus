# `antigravity.md` — Nexus Engineering Manual

This file is the single source of truth for the Nexus project. The Antigravity Agent reads it on every session. It is written to the Antigravity Agent in the second person. When anything here conflicts with the live Tatum, Walrus, or Sui docs, the live docs win — stop and tell me. When anything here is ambiguous, ask before guessing.

## 0. TABLE OF CONTENTS

1. Mission & Success Criteria
2. Product Specification
3. Domain Glossary
4. The Autonomous Flow (Canonical)
5. Economic Model & Blob Management
6. Listing & Access Lifecycles
7. Hard Rules (Never Violate)
8. Walrus & Tatum Technical Reference (Verify-First)
9. Tech Stack (Pinned)
10. Repository Structure
11. Contract Specifications (File by File)
12. Frontend Specifications (Screen by Screen)
13. Coding Standards
14. Testing Strategy
15. Security Checklist (Project-Specific)
16. Deployment Runbook
17. Demo Plan (The North Star)
18. Build Phases & Milestones
19. Scope Tiers (MVP vs Stretch — Anti-Gold-Plating)
20. Pivot Triggers
21. Git & Workflow Conventions
22. Definition of Done
23. Judge Context (Bias Decisions Toward This)
24. Known Risks & Open Questions
25. Out of Scope (Do Not Build)
26. How to Work with Me

## 1. MISSION & SUCCESS CRITERIA

**What we're building.** Nexus: A Decentralized AI Model & Memory Marketplace on Sui. When data scientists need massive AI training datasets, they purchase token-gated access natively on Sui. The heavy data blobs are stored on Walrus decentralized storage. The system is natively queryable by external AI agents using a Tatum MCP (Model Context Protocol) Server, allowing AI to autonomously buy and ingest its own memory.
**Who's building it.** A solo developer: intermediate backend engineering (Golang/PostgreSQL/TS), prior Web3 experience, with strong AI agent familiarity. No team. ~6 days until submission. Bias toward decisions that conserve time.
**Three goals, in priority order.**

1. **Ship.** A deployed, working, demoable prototype on Sui Testnet/Mainnet with a public GitHub repo and a 2–3 minute demo video.
2. **Win.** Clinch the 1st Place Grand Prize ($600) + Best Walrus Integration ($200) + Best Use of Tatum Tools ($200). The architecture *must* explicitly highlight the dependencies on these tools.
3. **Startup-ready.** Keep the Move contracts secure and object-centric so the project can scale post-hackathon.

## 2. PRODUCT SPECIFICATION

Nexus has three user types (two human, one autonomous).

1. **Data Providers** upload massive AI datasets to Walrus and list the resulting `Blob ID` and price via a Sui smart contract.
2. **Data Consumers** browse the marketplace, pay the SUI fee, and receive decryption/download rights to the Walrus blob.
3. **The AI Agent (via Tatum MCP)** is the differentiator. Instead of a human clicking "buy," an autonomous agent queries the Nexus MCP Server via natural language, reads the blockchain state using Tatum RPCs, finds the dataset it needs, and initiates the download from Walrus.
**The product's defensible claim is:** "The first fully decentralized marketplace where AI agents can autonomously purchase and ingest their own long-term memory."

## 3. DOMAIN GLOSSARY

* **Blob ID:** The unique cryptographic hash returned by Walrus after successfully uploading and erasure-coding a file.
* **Publisher / Aggregator:** The Walrus network endpoints. Publishers handle uploads; Aggregators handle downloads/reads.
* **RedStuff:** The erasure coding mechanism Walrus uses. (Use this term in UI/docs for judge points).
* **MCP (Model Context Protocol):** A standardized way for AI models to securely connect to external tools and data sources. We are using Tatum's implementation.
* **PTB (Programmable Transaction Block):** Sui's mechanism for chaining multiple operations (like paying a fee and transferring an Access NFT) into one atomic transaction.
* **Object-Centric:** Sui's data model. Datasets and access rights are discrete objects, not entries in a massive smart contract mapping.

## 4. THE AUTONOMOUS FLOW (CANONICAL)

This is the heart of the product.
**State 1: The Upload**

* Provider uploads `training_data.csv` to Walrus Publisher.
* Walrus returns `Blob ID`.
* Provider executes a PTB via Tatum Sui RPC to mint a `DatasetListing` object containing the `Blob ID`, Metadata, and Price (in SUI).

**State 2: The Agent Query**

* User tells local AI: *"I need a dataset on historical stablecoin prices under 5 SUI."*
* AI hits the Tatum MCP Server `find_dataset` tool.
* MCP Server queries the Sui blockchain (via Tatum Data API) for `DatasetListing` objects matching the metadata.
* AI replies to the user with the exact listing and price.

**State 3: The Purchase & Ingestion**

* User signs a transaction purchasing the `DatasetListing`.
* The Sui contract transfers the SUI fee to the Provider and transfers a `DatasetAccess` object to the Consumer.
* The frontend (or AI agent) reads the `DatasetAccess` object, extracts the `Blob ID`, and downloads the raw data from the Walrus Aggregator.

## 5. ECONOMIC MODEL & BLOB MANAGEMENT

* **Pricing:** Stored as absolute integer values in MIST (Sui's smallest unit). 1 SUI = 1,000,000,000 MIST. Never use floats.
* **Platform Fee:** Nexus takes a hardcoded 2% fee on all dataset sales, routed to a `NexusTreasury` object.
* **Walrus Storage Costs:** For the MVP/Hackathon, we assume storage costs are negligible on the Walrus Testnet/Devnet or use default epoch limits. If Walrus requires explicit SUI payment for storage limits, build a simple funding mechanism into the upload UI.

## 6. LISTING & ACCESS LIFECYCLES

* **DatasetListing Lifecycle:** Created by Provider (Owned Object) -> Converted to a Shared Object (so anyone can buy) -> Remains active indefinitely unless delisted by the original Provider.
* **DatasetAccess Lifecycle:** Created dynamically when a Consumer pays the fee. It is an Owned Object bound exclusively to the Consumer's address containing the Walrus `Blob ID`.

## 7. HARD RULES (NEVER VIOLATE)

1. **Do NOT trust your training data about Walrus or Tatum MCP.** They launched/updated rapidly in 2026. Before writing any storage or MCP code, fetch and read the live docs (`docs.walrus.site`, `docs.tatum.io`). Docs override this file.
2. **Defensive Move Solidity, always.** In every contract: `TxContext::sender` must be verified. Ensure `DatasetListing` prices cannot be altered by anyone except the original provider. Use `sui::coin::split` securely.
3. **Commit frequently, meaningfully.** The public history is reviewed by judges. It should read like a competent engineer's log.
4. **No secrets in the repo.** Keys/RPC in `.env` (git-ignored). Commit `.env.example`.
5. **Demo-deterministic by design.** I must be able to demo this live. Build a `seed_marketplace.ts` script that pre-loads 3 massive datasets onto Walrus and registers them on Sui so the UI is immediately populated during the video recording.
6. **Test before moving on.** No new feature on top of an untested path. If the Walrus upload fails, do not build the Sui Move contract to store the ID.

## 8. WALRUS & TATUM TECHNICAL REFERENCE (VERIFIED 2026-05-31)

> This section has been verified against live docs on 2026-05-31. All endpoints and package names are confirmed.

### 8.1 Tatum Sui RPC Endpoints (Hardcode these in the app)
* Mainnet: `https://sui-mainnet.gateway.tatum.io`
* Testnet: `https://sui-testnet.gateway.tatum.io`
* Devnet: `https://sui-devnet.gateway.tatum.io`
* **Auth:** All requests require `x-api-key: <TATUM_API_KEY>` header.

### 8.2 Walrus Endpoints (Testnet — Verified)
* **Publisher:** `https://publisher.walrus-testnet.walrus.space`
* **Aggregator:** `https://aggregator.walrus-testnet.walrus.space`
* **Upload Relay (SDK):** `https://upload-relay.testnet.walrus.space`
* **Docs:** `https://docs.wal.app` (NOT docs.walrus.site — that domain is deprecated)

### 8.3 Walrus HTTP API
* **Upload:** `PUT <PUBLISHER>/v1/blobs` (query params: `epochs`, `permanent`, `deletable`, `send_object_to`)
* **Download:** `GET <AGGREGATOR>/v1/blobs/<BLOB_ID>` (no auth required)
* **Response key field:** `response.newlyCreated.blobObject.blobId`
* **Encoding type:** API returns `RS2` (marketing name: RedStuff). Use "RedStuff" in UI, expect `RS2` in code.
* **Default behavior:** Newly stored blobs are **deletable** by default. Use `permanent=true` for marketplace listings.

### 8.4 Walrus TypeScript SDK
* **Package:** `@mysten/walrus` (official Mysten Labs SDK)
* **Peer dep:** `@mysten/sui`
* **Usage:** Extends `SuiGrpcClient` with `.walrus.writeBlob()` and `.walrus.readBlob()` methods.

### 8.5 Tatum MCP Server (CORRECTED)
* **Package:** `@tatumio/blockchain-mcp` (NOT `@tatumio/mcp-server` — the spec was wrong)
* **Architecture:** This is a **closed, pre-built server** exposing 14 fixed tools. You CANNOT register custom tools into it.
* **Key tools:** `gateway_execute_rpc` (raw RPC on any chain), `get_wallet_portfolio`, `get_transaction_history`, `get_metadata`, `check_owner`, etc.
* **Our approach:** Build a **separate Nexus MCP server** using `@modelcontextprotocol/sdk` that exposes domain-specific tools (`search_nexus_datasets`, `buy_dataset`, `get_walrus_blob`). Internally this server calls Tatum's RPC gateway for Sui reads. Both MCP servers are composed in the AI client config.

## 9. TECH STACK (PINNED)

* **Contracts:** Sui Move (latest framework, v1.73.0 testnet). Test via `sui move test`.
* **Move.toml:** Do NOT add explicit `Sui` git dependency — CLI v1.73.0+ auto-resolves `MoveStdlib`, `Sui`, `Bridge`, `DeepBook`, `SuiSystem`.
* **Frontend:** SvelteKit + TypeScript + Tailwind. `@mysten/dapp-kit` for wallet connections. (SvelteKit is explicitly chosen to align with Walrus UI tutorials).
* **Walrus SDK:** `@mysten/walrus` + `@mysten/sui` for programmatic blob upload/download.
* **AI Server:** Node.js + TypeScript. Two-server MCP architecture:
  * `@tatumio/blockchain-mcp` — stock Tatum server for generic blockchain data + RPC gateway.
  * Custom Nexus MCP server (`@modelcontextprotocol/sdk`) — domain-specific tools backed by Tatum Sui RPC.
* **Tooling:** GitHub Actions CI running `sui move test`.
Do not introduce frameworks beyond these without asking.

## 10. REPOSITORY STRUCTURE

```text
nexus/
├─ .agents/                        # Antigravity memory bank (architecture.md, active-tasks.md)
├─ CLAUDE.md / antigravity.md      # This file
├─ README.md                       # Judges read first
├─ .env.example
├─ move/                           # Sui Smart Contracts
│  ├─ Move.toml
│  ├─ sources/
│  │  ├─ nexus_marketplace.move    # Core marketplace logic
│  │  └─ nexus_events.move         # Event emission (DatasetListed, DatasetBought)
│  └─ tests/                       # Native Move unit tests
├─ frontend/                       # SvelteKit App
│  ├─ src/
│  │  ├─ routes/                   # App pages (/, /upload, /dataset/[id])
│  │  └─ lib/
│  │     ├─ walrus/                # Walrus upload/download wrappers
│  │     └─ sui/                   # Tatum RPC configurations & PTB builders
├─ mcp-server/                     # Tatum AI Agent layer
│  ├─ package.json
│  └─ src/index.ts                 # Tool definitions
└─ scripts/
   ├─ deploy_contracts.sh
   └─ seed_marketplace.ts          # Deterministic demo seeder

```

## 11. CONTRACT SPECIFICATIONS (FILE BY FILE)

**`nexus_marketplace.move`**

* **Objects:**
* `Marketplace`: Shared object tracking total volume and platform fees.
* `DatasetListing`: Shared object containing `id`, `provider` (address), `walrus_blob_id` (String), `price` (u64), `metadata` (String).
* `DatasetAccess`: Owned object minted to the buyer containing the `walrus_blob_id`.


* **Functions:** `init` (creates Treasury), `list_dataset` (creates Listing), `buy_dataset` (takes `Coin<SUI>`, splits fee to Treasury, sends rest to provider, mints Access), `delist_dataset`.
* **Events:** Emitted on every state change so the SvelteKit frontend and Tatum MCP can index them.

## 12. FRONTEND SPECIFICATIONS (SCREEN BY SCREEN)

Clean, hyper-modern, "AI-native" aesthetic. Dark mode default.

* **`/` (Marketplace Hub):** Grid of available datasets. Shows Title, Size (e.g., "500MB Blob"), and Price. Powered by Tatum RPC reads.
* **`/upload` (Provider Portal):** A massive drag-and-drop zone. Shows a progress bar communicating with the Walrus Publisher. Once uploaded, prompts wallet to sign the PTB to list it on Sui.
* **`/dataset/[id]` (Detail Page):** Shows metadata. If the user owns a `DatasetAccess` object for this ID, the "Buy" button becomes "Download via Walrus Aggregator."

## 13. CODING STANDARDS

* **Sui Move:** Strict object-centric design. Custom error codes (e.g., `EInsufficientFunds: u64 = 1;`).
* **TypeScript:** Strict mode. No `any`. Typed PTB builders.
* **General:** Small functions. Comments explain *why* an architectural choice was made, not *what* the code does.

## 14. TESTING STRATEGY

* **Move:** `sui move test` covering every function. Must test failing states (e.g., trying to buy with insufficient SUI).
* **Walrus:** A dedicated `walrus.test.ts` script that uploads a 1MB file and reads it back to ensure endpoints are alive.
* **Integration:** Execute the `seed_marketplace.ts` script on Testnet.

## 15. SECURITY CHECKLIST (PROJECT-SPECIFIC)

* **Blob Validation:** Ensure the SvelteKit frontend validates the Walrus upload was successful *before* prompting the user to sign the Sui listing transaction.
* **Sui Coin Handling:** Use `coin::split` and `coin::into_balance` correctly. Prevent reentrancy (though Sui's object model natively mitigates most EVM-style reentrancy).
* **Object Ownership:** Ensure `DatasetListing` can only be altered by its `provider`.

## 16. DEPLOYMENT RUNBOOK

1. `cp .env.example .env`; fill Tatum RPC keys, wallet seeds, and Walrus gateway URLs.
2. `cd move && sui client publish --gas-budget 100000000`.
3. Copy the package ID to `.env`.
4. Run `ts-node scripts/seed_marketplace.ts` to push 3 real datasets to Walrus and register them.
5. Deploy Frontend to Vercel/Netlify.
6. Record demo video.

## 17. DEMO PLAN (THE NORTH STAR)

Every build decision serves this 2–3 minute video.

* **0:00–0:30:** Open the SvelteKit frontend. Explain the problem (AI needs decentralized memory). Show dragging a massive `.csv` dataset into the UI. Watch it upload to Walrus in real-time, then sign the Sui transaction via Tatum RPC.
* **0:30–1:30 (The AI Magic):** Open a split terminal. Start the Tatum MCP server. Type in a local LLM client: *"Find me a dataset for historical stablecoin prices on Nexus and buy it."*
* **1:30–2:30:** Watch the LLM autonomously query the Sui blockchain via Tatum, locate the exact dataset we just uploaded, and trigger the wallet payload to purchase the blob. Explain how this makes AI truly autonomous. Show the Walrus download executing.
* **2:30–End:** Link GitHub repo. Emphasize it runs exclusively on Sui + Walrus + Tatum.

## 18. BUILD PHASES & MILESTONES

* **Phase 0 (Day 1 — May 31): ✅ COMPLETE.** Verified live Walrus/Tatum docs. Found 5 divergences (§8 updated). Scaffolded repo (17 files). `sui move build` passes on CLI v1.73.0. Two semantic commits: `edc68e5`, `3402480`.
* **Phase 1 (Day 2 — June 1):** The Spike. Write a script to upload a mock file to Walrus and read it back. Do not build UI until this works.
* **Phase 2 (Days 3-4 — June 2-3):** Move Contracts & Frontend UI. Write `nexus_marketplace.move`. Build SvelteKit views. Acceptance: Can manually upload, list, and buy via browser wallet.
* **Phase 3 (Day 5 — June 4):** AI Server (MCP). Build the Node.js server exposing the Sui/Tatum search tools to the LLM. Acceptance: An LLM can read the marketplace state.
* **Phase 4 (Day 6 — June 5-6):** Seed, Polish, Record. Run the seeder. Record the video perfectly. Submit by June 6.

## 19. SCOPE TIERS (ANTI-GOLD-PLATING)

* **MVP (Must Ship):** SvelteKit UI, working Walrus Upload/Download, working Sui token gating, basic MCP read-only server.
* **Stretch (Only if time):** The MCP agent actually signing the PTB to execute the purchase (requires handling private keys in the Node server, which is complex).
* **Explicitly Later:** Multi-token payments, dataset encrypted previews.

## 20. PIVOT TRIGGERS

* **Walrus Testnet is unstable/down:** Pivot to Devnet. If Devnet is down, explicitly mock the storage layer in UI but maintain the Move logic, and state in README that Walrus testnet was down during filming.
* **Tatum MCP is too complex for the timeframe:** Drop the AI agent integration and focus entirely on the human-to-human marketplace to secure the Walrus prize.

## 21. GIT & WORKFLOW CONVENTIONS

* Conventional Commits.
* Keep `active-tasks.md` updated before every commit.

## 22. DEFINITION OF DONE (HACKATHON SUBMISSION)

* [ ] Move contracts deployed to Sui Testnet/Mainnet.
* [ ] Full autonomous flow demonstrable (Upload -> AI Query -> Buy -> Download).
* [ ] Public GitHub repo with strong README explicitly detailing Tatum & Walrus use.
* [ ] 2-3 min demo video recorded per §17.

## 23. JUDGE CONTEXT (BIAS DECISIONS TOWARD THIS)

Judges are scoring strictly on:

1. **Walrus Integration (30%)**: Is the data actually large and decentralized?
2. **Tatum Integration (30%)**: Are the RPCs used? Is MCP implemented?
If a feature doesn't serve these two metrics, drop it.

## 24. KNOWN RISKS & OPEN QUESTIONS

* ~~Exact Walrus Devnet/Testnet publisher URLs.~~ **RESOLVED Phase 0:** Publisher: `publisher.walrus-testnet.walrus.space`, Aggregator: `aggregator.walrus-testnet.walrus.space`. See §8.2.
* ~~How Tatum MCP handles Sui complex data types.~~ **PARTIALLY RESOLVED Phase 0:** Tatum MCP is a closed server (`@tatumio/blockchain-mcp`). It exposes `gateway_execute_rpc` for raw Sui JSON-RPC calls. We build a separate Nexus MCP server for domain logic. See §8.5. Still need Phase 1 spike to test actual `sui_queryEvents` through Tatum.
* **NEW:** Network reliability — first `sui move build` failed due to git clone timeout. Auto-resolved deps (empty `[dependencies]` in Move.toml) work but still need a one-time GitHub fetch. Retry succeeded.
* **NEW:** Sui CLI installed via manual binary download (suiup GitHub release). Path: `$USERPROFILE\bin\sui.exe`. Not on system PATH — use full path or add to PATH.

## 25. OUT OF SCOPE (DO NOT BUILD)

* Complex user profiles, ratings, or reviews.
* Support for uploading folders (stick to single massive zip/csv files for MVP).

## 26. HOW TO WORK WITH ME

* Begin each session by stating the current phase and the single next milestone, then proceed.
* Work in small, verifiable increments; run tests; report pass/fail; propose the next step.
* When live docs differ from this file, stop and tell me before coding.
* Default to action on routine decisions; escalate only genuine forks.

## 27. SESSION LOG

### Session 1 — 2026-05-31 (Phase 0)

**Duration:** ~3 hours | **Commits:** `edc68e5`, `3402480`

**Accomplished:**
1. Researched live Walrus docs (`docs.wal.app`), Tatum MCP (`@tatumio/blockchain-mcp`), and Sui RPC gateway.
2. Identified 5 divergences from original spec — all documented and corrected in §8.
3. Critical finding: Tatum MCP is closed (no custom tools). Architecture pivoted to two-server MCP composition.
4. Scaffolded full repo: 17 files across `.agents/`, `move/`, `frontend/`, `mcp-server/`, `scripts/`.
5. Installed Sui CLI v1.73.0 (testnet binary). `sui move build` passes.
6. Created high-impact README.md for hackathon judges.

**Decisions made:**
- ADR-001: Two-server MCP architecture (Tatum + custom Nexus)
- ADR-002: HTTP API for spike, SDK for production
- ADR-003: Testnet-first development
- Move.toml uses empty `[dependencies]` (auto-resolved by CLI v1.73.0+)

**Next session:** Phase 1 — The Spike (upload mock text to Walrus → capture blobId → query via Tatum Sui RPC → read back)

---

### Session 2 — 2026-06-02 (Phase 1: The Spike)

**Duration:** ~1 hour

**Accomplished:**
1. Created `scripts/package.json` and `scripts/tsconfig.json` for spike infrastructure.
2. Wrote `walrus-spike.ts` — self-contained validation script using raw `fetch()` (per ADR-002).
3. Discovered corporate firewall (DANCOM/Fortinet) blocking Walrus endpoints — switched networks.
4. **Walrus Upload validated:** `PUT /v1/blobs` → blobId `bJb3aHwiTsHAaa3B-Ra1dcyrnpDmgVXKgcPnI3RsTg0`.
5. **Walrus Download validated:** `GET /v1/blobs/<ID>` → 211 bytes round-tripped, content matches.
6. **Tatum Sui RPC validated:** `sui_getLatestCheckpointSequenceNumber` → checkpoint `343886846`.
7. All 3 infrastructure checks: ✅ PASS.

**Issues encountered:**
- Corporate network (Fortinet) blocks `*.walrus.space` as "Unrated" — resolved by switching to unrestricted network.
- Walrus testnet TLS certs triggered `SELF_SIGNED_CERT_IN_CHAIN` on corporate network (firewall MITM) — resolved with network switch.

**Next session:** Phase 2 — Move Contracts & Frontend (write `nexus_marketplace.move`, `nexus_events.move`, tests, SvelteKit UI)

---