# Nexus — Active Development Backlog

> Updated: 2026-06-05 | Current Phase: Code complete + docs reconciled (Session 8h). Only user actions remain (B-2 Vercel env re-set + redeploy, B-3 video, submit). Live status: `docs/Blockers.md`.

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
- [x] Implement `check_dataset_purchase` tool (Session 8h — 6 tools total)
- [x] Fix `get_dataset_details` to read wrapped listings via dynamic field (Session 8h)
- [x] Route all Sui reads through Tatum gateway
- [x] Compose with `@tatumio/blockchain-mcp` in client config — documented in docs/Deployment.md (Session 8h)
- [x] Test: MCP tool suite (`test-mcp` 9/1); live agent flow validated via dry-run

## Phase 4 — Seed, Polish, Record (Day 6: June 5-6)

- [x] Write `seed_marketplace.ts` (3 real datasets) — repaired in Session 8, verified via on-chain dry-run
- [x] Deploy Move contracts to Sui Testnet — redeployed Session 8 (package `0xb291…`, marketplace `0x1cbd…`) after the B-4/B-5 contract fixes; re-seeded with 3 datasets
- [x] Deploy frontend to Vercel (⚠️ pending dashboard: disable auth + set env vars)
- [x] Polish UI animations and error states
- [ ] Record 2-3 min demo video per §17
- [ ] Final README polish
- [ ] Submit

## Session 8 (a–h) — Verify, Fix, Redeploy, Reconcile (June 4–5)

- [x] Independent E2E verification of all suites
- [x] MCP server reads routed through Tatum; `get_dataset_details` fixed (dynamic field); +`check_dataset_purchase` (8h)
- [x] Frontend: TS errors fixed; raw-`fetch` `rpc()` (Tatum + fullnode fallback, dodges SDK/CORS); dynamic-field listing reads; wallet account fix; download gating; Suiscan links
- [x] Contract: `buy_dataset` refund fix + double-buy prevention; **redeployed** clean (package `0xb291…`, marketplace `0x1cbd…`); 12 Move tests; re-seeded
- [x] All docs reconciled to current reality (8h); `docs/Blockers.md` is the status SoT
- [ ] **Open (user):** B-2 re-set Vercel env to new addresses + redeploy frontend; B-3 verify demo video; submit — see `docs/Blockers.md`
