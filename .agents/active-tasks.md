# Nexus — Active Development Backlog

> Updated: 2026-05-31 | Current Phase: 0 (Verify & Scaffold)

## Phase 0 — Verify & Scaffold (Day 1: May 31)

- [x] Verify Walrus HTTP API endpoints & response shapes
- [x] Verify Tatum MCP package name & tool registration model
- [x] Verify Tatum Sui RPC gateway endpoints & auth
- [x] Flag divergences from antigravity.md spec
- [x] Update antigravity.md with verified infrastructure
- [/] Scaffold complete repository structure
- [ ] Create .gitignore, .env.example, README.md
- [ ] Populate .agents/ context files
- [ ] Initialize Move project (`sui move build` passes)
- [ ] First semantic git commit

## Phase 1 — The Spike (Day 2: June 1)

- [ ] Write walrus-spike.ts: upload mock text to Walrus Publisher
- [ ] Parse blobId from upload response
- [ ] Read blob back from Walrus Aggregator via HTTP GET
- [ ] Route Sui RPC read through Tatum gateway to confirm connectivity
- [ ] Validate full pipeline: Upload → Store blobId → Query via Tatum → Download

## Phase 2 — Move Contracts & Frontend (Days 3-4: June 2-3)

- [ ] Write `nexus_marketplace.move` (Marketplace, DatasetListing, DatasetAccess)
- [ ] Write `nexus_events.move` (event emission)
- [ ] Write Move unit tests (happy paths + failure states)
- [ ] `sui move test` passes
- [ ] Initialize SvelteKit app
- [ ] Build `/` marketplace hub
- [ ] Build `/upload` provider portal with Walrus integration
- [ ] Build `/dataset/[id]` detail page
- [ ] Wallet connection via `@mysten/dapp-kit`
- [ ] End-to-end: Upload → List → Buy → Download via browser

## Phase 3 — AI Server (MCP) (Day 5: June 4)

- [ ] Initialize Nexus MCP server with `@modelcontextprotocol/sdk`
- [ ] Implement `search_nexus_datasets` tool
- [ ] Implement `get_walrus_blob` tool (read-only)
- [ ] Route all Sui reads through Tatum gateway
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
