# Nexus — Active Development Backlog

> Updated: 2026-06-03 | Current Phase: 2 COMPLETE → Ready for Phase 3

## Phase 0 — Verify & Scaffold (Day 1: May 31)

- [x] Verify Walrus HTTP API endpoints & response shapes
- [x] Verify Tatum MCP package name & tool registration model
- [x] Verify Tatum Sui RPC gateway endpoints & auth
- [x] Flag divergences from antigravity.md spec
- [x] Update antigravity.md with verified infrastructure
- [x] Scaffold complete repository structure
- [x] Create .gitignore, .env.example, README.md
- [x] Populate .agents/ context files
- [x] Initialize Move project (`sui move build` passes) — v1.73.0
- [x] First semantic git commit (edc68e5)

## Phase 1 — The Spike (Day 2: June 1–2)

- [x] Write walrus-spike.ts: upload mock text to Walrus Publisher
- [x] Parse blobId from upload response — `bJb3aHwiTsHAaa3B-Ra1dcyrnpDmgVXKgcPnI3RsTg0`
- [x] Read blob back from Walrus Aggregator via HTTP GET — 211 bytes verified
- [x] Route Sui RPC read through Tatum gateway to confirm connectivity — checkpoint 343886846
- [x] Validate full pipeline: Upload → Store blobId → Query via Tatum → Download ✅
- [x] Enhanced spike: Upload 3 AI data types (embeddings, fine-tuning data, model weights)
- [x] Enhanced spike: Verify downloads with SHA256 hash matching
- [x] Enhanced spike: Test 5 Tatum RPC methods (checkpoint, chain ID, protocol config, total txns, system object)
- [x] Enhanced spike: All 10 tests passed — Walrus 5/5, Tatum 5/5

## Phase 2 — Move Contracts & Frontend (Days 3-4: June 2-3)

- [x] Write `nexus_marketplace.move` (Marketplace, DatasetListing, DatasetAccess, ProviderCap)
- [x] Write `nexus_events.move` (event structs with constructors)
- [x] Write Move unit tests (happy paths + failure states)
- [x] `sui move test` passes — 7/7 tests passed
- [x] Initialize SvelteKit app with TypeScript
- [x] Implement Walrus client wrapper with upload/download/verify functions
- [x] Implement Sui/Tatum config with SuiClient initialization
- [x] Implement PTB builders for list_dataset, buy_dataset, delist_dataset
- [x] Implement MCP server with 5 tools (search, details, download, stats, verify)
- [x] Install frontend dependencies (@mysten/sui, @mysten/dapp-kit, @mysten/walrus)

## Phase 3 — AI Server (MCP) (Day 5: June 4)

- [x] Initialize Nexus MCP server with `@modelcontextprotocol/sdk`
- [x] Implement `search_nexus_datasets` tool
- [x] Implement `get_dataset_details` tool
- [x] Implement `get_walrus_blob` tool
- [x] Implement `get_marketplace_stats` tool
- [x] Implement `verify_dataset_integrity` tool
- [x] Route all Sui reads through Tatum gateway
- [ ] Compose with `@tatumio/blockchain-mcp` in client config
- [ ] Test: LLM agent queries marketplace state

## Phase 4 — Seed, Polish, Record (Day 6: June 5-6)

- [ ] Write `seed_marketplace.ts` (3 real datasets)
- [ ] Deploy Move contracts to Sui Testnet
- [ ] Deploy frontend to Vercel
- [ ] Polish UI animations and error states
- [ ] Record 2-3 min demo video per §17
- [ ] Final README polish
- [ ] Submit
