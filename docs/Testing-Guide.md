# Nexus — End-to-End Testing Guide

The canonical runbook to exercise **every layer** of Nexus start-to-finish: smart contracts → Walrus storage → Tatum RPC → MCP server (6 tools) → frontend → the full autonomous agent flow. Run it top to bottom; tick the boxes; log anything weird in §8.

Each step is tagged **[auto]** (a command, no human judgement) or **[manual]** (needs a browser, wallet, or MCP client).

> Verified green on 2026-06-05. Re-run any time — the expected outputs below are real.

---

## §0 · Setup & prerequisites

**Tools:** Node 18+, the Sui CLI (`sui`; on this machine it's `$USERPROFILE\bin\sui.exe`), and the **Sui Wallet** browser extension with **testnet SUI** (get it from [faucet.sui.io](https://faucet.sui.io/)). A Tatum API key is optional (everything falls back to the public fullnode without one).

**Install deps once:**
```bash
cd frontend     && npm install
cd ../scripts    && npm install
cd ../mcp-server && npm install
```

**Current deployment (Sui Testnet, chain `4c78adac`):**

| Thing | Value |
|------|-------|
| Package | `0x2797464179d14bd6ac9463019abb2000d840fc33547b378372ed3b6fc6b393e7` |
| Marketplace (shared) | `0xac47e84574ce49163c02c2ea7f9e472aa45fcf64de599b97e8cac2e95f417430` |
| Provider/seed wallet | `0x14c6ce9f17daec0d358b01becc22aeff722123634cddb88d911b8c40f98c37cb` |
| Tatum RPC | `https://sui-testnet.gateway.tatum.io` |
| Walrus publisher / aggregator | `…publisher.walrus-testnet.walrus.space` / `…aggregator.walrus-testnet.walrus.space` |

**Seeded datasets (live):**

| Name | Price | Listing ID | Walrus blob |
|------|-------|-----------|-------------|
| GPT-2 Embedding Vectors | 0.5 SUI | `0x94d1bd84b3f89294d8cf0e6439fb224e980d514ad6d3e8cf6d69de5b564c2e89` | `njQKp7aFXHLNd6PzKGcZYQEt9-UU2m3a9nASmIC8OU8` |
| Fine-Tuning Dataset | 0.25 SUI | `0x21e212efa54d5dfc3c144dfdfe0a41f4b9dfdddf6c75402a859726bac8645a0a` | `aGir1MudixR_2MezEKRfKHzqwXkBzD1xd9iaFhamZQ0` |
| LoRA Adapter Weights | 1.0 SUI | `0x61362a6818ecc49bc65d94bc7e189fb9559e77b41a10c3aff697746175a13f69` | `rusSEWN3gYhFC-FZicd9KU1BCXt-HIvT9gF1Yc-tIQo` |

> Listing IDs change whenever you re-seed. To get a fresh one, run `search_nexus_datasets` (§4) or copy it from a dataset page URL.

---

## §1 · Layer 1 — Smart contracts  [auto]

```bash
cd move && sui move test          # (Windows: & "$env:USERPROFILE\bin\sui.exe" move test)
```
**Expected — 12/12 pass**, including the failure-state guards:
```
[ PASS ] test_buy_dataset
[ PASS ] test_buy_dataset_overpayment_refunds_from_payment   # refund comes from buyer, not treasury
[ PASS ] test_buy_delisted_listing_fails
[ PASS ] test_buy_insufficient_payment_fails
[ PASS ] test_delist_by_non_provider_fails
[ PASS ] test_double_purchase_fails                          # EAlreadyPurchased
[ PASS ] test_full_lifecycle
[ PASS ] test_list_dataset(+_max_price/_zero_price_fails)
[ PASS ] test_marketplace_initialization
Test result: OK. Total tests: 12; passed: 12; failed: 0
```

Then verify the **deployed** contract on testnet:
```bash
cd ../scripts && npx tsx test-contracts.ts
```
**Expected — `Results: 11 passed, 0 failed, 6 skipped`** (the 6 skips are browser/wallet-only). Confirms: package + both… one module live, marketplace shared, fee = 200 bps, not paused, 3+ `DatasetListed` events queryable.

- [ ] `sui move test` → 12/12
- [ ] `test-contracts.ts` → 11 passed

---

## §2 · Layer 2 — Walrus storage  [auto]

```bash
cd scripts && npx tsx walrus-spike.ts
```
**Expected:** uploads a blob, reads it back byte-identical, and hits Tatum:
```
✅ Upload: New blob created. blobId = …
✅ Download: Content matches! (211 bytes)
✅ Tatum RPC: Connected! Latest checkpoint: …
🎉 ALL CHECKS PASSED
```
This is the decentralized-storage round-trip (upload → content-addressed blob → public read).

- [ ] Walrus upload + download round-trip passes

---

## §3 · Layer 3 — Tatum RPC gateway  [auto]

```bash
curl -s -X POST https://sui-testnet.gateway.tatum.io \
  -H "Content-Type: application/json" -H "x-api-key: <YOUR_TATUM_KEY>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"sui_getChainIdentifier","params":[]}'
```
**Expected:** `{"id":1,"jsonrpc":"2.0","result":"4c78adac"}` (testnet chain id).

Tatum also underpins `test-contracts.ts`, `walrus-spike.ts`, and the MCP server. The **frontend** uses a raw `fetch` (Tatum-preferred, public-fullnode fallback) — see §7 for why it can't use the SDK client through Tatum.

- [ ] Tatum returns chain id `4c78adac`

---

## §4 · Layer 4 — MCP server (the AI-agent layer)

### 4a. Automated tool suite  [auto]
```bash
cd scripts && npx tsx test-mcp.ts
```
**Expected — `Results: 9 passed, 0 failed, 1 skipped`.** Notably it proves `sui_getObject(listingId)` returns `notExists` (listings are wrapped) and that the dynamic-field read used by `get_dataset_details` works.

### 4b. Build & boot  [auto]
```bash
cd mcp-server && npx tsc && node dist/index.js
```
**Expected stderr:**
```
Nexus MCP Server started
Sui RPC: Tatum gateway (https://sui-testnet.gateway.tatum.io) with public-fullnode fallback
```
(Ctrl-C to stop; it speaks MCP over stdio, so there's nothing to "open".)

### 4c. Drive each tool with the MCP Inspector  [manual]
```bash
npx @modelcontextprotocol/inspector node mcp-server/dist/index.js
```
Opens a local web UI. Under **Tools**, call each with these real inputs and confirm the result:

| Tool | Example input | Expect |
|------|---------------|--------|
| `search_nexus_datasets` | `{ "category": "embeddings" }` | ≥1 dataset incl. GPT-2; grab a `listingId` from the result |
| `get_dataset_details` | `{ "listingId": "0x94d1bd84b3f89294d8cf0e6439fb224e980d514ad6d3e8cf6d69de5b564c2e89" }` | full metadata (name, description, price, `walrusBlobId`, `downloadUrl`) — **not** "Listing not found" |
| `check_dataset_purchase` | `{ "address": "0x000…000", "listingId": "0x94d1bd84…" }` | `{ "hasPurchased": false, "canDownload": false, … }` |
| `get_walrus_blob` | `{ "blobId": "njQKp7aFXHLNd6PzKGcZYQEt9-UU2m3a9nASmIC8OU8" }` | size + sha256 + base64 of the blob |
| `get_marketplace_stats` | `{}` | totalListings / totalSales / treasury / `platformFeePercent: 2` |
| `verify_dataset_integrity` | `{ "blobId": "njQKp7aF…", "expectedHash": "f242c9eac879a715ae7c91185bbddd7ce8f74be2f4b40a769c2c61cc073097ba" }` | `status: "VERIFIED"` |
| `buy_dataset` *(opt-in)* | `{ "listingId": "0x94d1bd84…" }` | with signing **off**: instructions to enable; with `NEXUS_ENABLE_SIGNING=true`+`SUI_PRIVATE_KEY`: `signed:true`, a tx `digest` + minted `accessId` |

Under **Resources**, open `marketplace://overview` → JSON marketplace snapshot.

> To test `buy_dataset` for real, restart the Inspector command with `NEXUS_ENABLE_SIGNING=true` and `SUI_PRIVATE_KEY=<a dedicated low-balance testnet key>` in the env. It executes an actual purchase (mints a `DatasetAccess`) — use a throwaway key.

- [ ] `test-mcp.ts` → 9 passed
- [ ] Server boots and logs the Tatum endpoint
- [ ] All 6 tools return sensible results in the Inspector
- [ ] `get_dataset_details` returns full metadata (regression check for the wrapped-object bug)

### 4d. (Optional) Real agent narrative in Claude Desktop  [manual]
Add the **two-server** config from [Deployment.md → Configure in an AI client](./Deployment.md#4-configure-in-an-ai-client-two-server-composition) (Nexus + `@tatumio/blockchain-mcp`), restart Claude Desktop, then ask in natural language: *"Search Nexus for an embeddings dataset under 1 SUI, show its details, and tell me if 0x14c6… already owns it."* The model should chain `search → details → check_dataset_purchase`.

---

## §5 · Layer 5 — Frontend  [manual: browser + wallet]

```bash
cd frontend && npm run dev      # http://localhost:5173
```
Also test the **deployed** site (`https://nexus-place.vercel.app`) — but only **after B-2** (re-set Vercel env vars to the addresses in §0 and redeploy), or the live build will query the dead package.

| # | Test | Verify | Guards against |
|---|------|--------|----------------|
| 1 | Marketplace loads | Grid shows the seeded datasets (names + prices) | F-6 (Tatum/CORS fetch) |
| 2 | Open a dataset card | Detail page loads full metadata — **no "Dataset not found"** | F-8 (wrapped listing) |
| 3 | External links | "View listing/transaction/provider on Suiscan" all open **real** pages (not "deleted") | F-9 (Suiscan links) |
| 4 | Connect wallet | Approve in Sui Wallet → shows name + truncated address; click to disconnect | — |
| 5 | Upload flow (`/upload`) | Drop a file → Walrus progress bar → wallet signs `list_dataset` → success shows a **Suiscan tx** link; new card appears on `/` | upload pipeline |
| 6 | Download gating | On a dataset you DON'T own, "Download" is labelled *(requires access)* and refuses without a `DatasetAccess` | B-6 (access gating) |
| 7 | Purchase flow | Click Purchase → wallet signs `buy_dataset` → "access unlocked" + Suiscan tx; Download now works | F-7 (wallet account), buy PTB |
| 8 | "View raw blob on Walrus" | Opens raw bytes (gibberish for binary) — **this is correct** | §7 note |
| 9 | Mobile | Resize / phone: burger menu opens overlay, links + wallet work | responsive |
| 10 | Error states | Disconnect wallet then try to buy → clear inline error, no crash | — |

---

## §6 · Layer 6 — The full autonomous flow (North Star)

End-to-end, the product's headline claim — *an AI agent buys its own memory*:

1. **Provider** uploads a dataset in the UI (§5 step 5) → Walrus blob + on-chain `DatasetListing`.
2. **Agent** (MCP, §4c/4d) `search_nexus_datasets` → finds it by metadata.
3. **Agent** `get_dataset_details` → reads price + `walrusBlobId`.
4. **Agent** `check_dataset_purchase` → confirms it doesn't already own it.
5. **Human/wallet** signs `buy_dataset` (the agent prepares; a wallet signs — server-side signing is the next stretch item). → `DatasetAccess` minted, fee to treasury, payout to provider.
6. **Agent** `get_walrus_blob` → downloads the raw data, `verify_dataset_integrity` → hash matches.

- [ ] The whole chain works without manual data shuttling between steps.

---

## §7 · Quirks & gotchas (seeded from real bugs — know these before they bite)

- **Stale Vercel env vars (B-2):** if the deployed site shows an empty/old marketplace, its `PUBLIC_NEXUS_*` env vars point at a **dead** package. Re-set to §0 values + redeploy.
- **Listings are wrapped:** never `sui_getObject(<listingId>)` — it returns `notExists`. Read via `suix_getDynamicFieldObject` on the marketplace `listings` table (`getListingFields`). The listing *ID* on Suiscan shows "deleted" for the same reason — link the **Field object** / **tx** instead.
- **Wallet must be connected before signing:** `signAndExecuteTransaction` needs the active account, else "Cannot read properties of undefined (reading 'address')".
- **Double purchase aborts (`EAlreadyPurchased`):** buying the same dataset twice from one wallet **fails by design** — that's correct, not a bug.
- **Overpayment** is refunded from the **buyer's own coin** (the treasury is never touched for refunds).
- **Walrus "view raw blob" = raw bytes:** the aggregator serves the literal file; binary shows as gibberish in a browser. Use the in-app **Download** button for a real file.
- **Seeding signs via the public fullnode**, not Tatum — the Tatum gateway doesn't expose `suix_getLatestSuiSystemState`, which the SDK needs to build a tx. (Read paths still go through Tatum.)
- **Frontend can't use the @mysten/sui SDK client through Tatum:** the SDK adds a `client-sdk-version` header Tatum's CORS rejects. The frontend uses a plain `fetch` instead — keep it that way.
- **Upload shows `simulated-…` tx** only if the contract env vars are empty; with the deployed config it's a real tx.
- **Tatum free tier rate-limits (HTTP 429)** under heavy back-to-back testing — pause a few seconds, or rely on the fullnode fallback.
- **Self-purchase is allowed:** the seed/provider wallet can buy its own listing (handy for testing the buy path).

---

## §8 · Results & readiness gate

| Layer | Status |
|-------|--------|
| 1 · Contracts (`move test`, `test-contracts`) | ☐ |
| 2 · Walrus round-trip | ☐ |
| 3 · Tatum RPC | ☐ |
| 4 · MCP server (suite + 6 tools) | ☐ |
| 5 · Frontend (local, + deployed after B-2) | ☐ |
| 6 · Full autonomous flow | ☐ |

**When something breaks:** note the layer + exact step + console/RPC output here, fix, then **re-run that layer** before moving on. Update [docs/Blockers.md](./Blockers.md) if it's a real defect.

**Green-light for stretch work** (MCP server-side `buy_dataset` signing, encrypted previews, multi-token) once §1–§6 all pass on both local and the deployed (post-B-2) site.
