# Nexus — Blockers & Gaps (Triaged)

> Single source of truth for open issues, verified gaps, and what was fixed.
> Last updated: 2026-06-05 (Session 8h — MCP `get_dataset_details` fix + full docs reconciliation).
> Severity: 🔴 demo/release-blocking · 🟠 important · 🟡 minor/polish · 🟢 fixed.

---

## Current deployment (Sui Testnet, chain `4c78adac`)

| Object | ID |
|--------|----|
| Package | `0x2797464179d14bd6ac9463019abb2000d840fc33547b378372ed3b6fc6b393e7` |
| Marketplace (shared) | `0xac47e84574ce49163c02c2ea7f9e472aa45fcf64de599b97e8cac2e95f417430` |
| UpgradeCap | `0x88f150e0aecb13a61800d0a1c554a45fd7681b614053079b520a194540ddb02f` |

> **Dead packages (do not use):** `0xd4121a45…` (original), `0x86208eab…` (B-4/B-5 fix, still carried `nexus_events`), and `0xb291fda4…` (single-module clean redeploy, SUI-only). All superseded by **`0x2797464…`** — the current package, which is generic over the payment coin type (`Coin<T>`, multi-token) and adds Seal access control (`seal_approve` + `seal_policy_id`).

**Seeded datasets (new blob IDs):**

| Dataset | Category | Price | Walrus Blob ID |
|---------|----------|-------|----------------|
| GPT-2 Embedding Vectors | embeddings | 0.5 SUI | `njQKp7aFXHLNd6PzKGcZYQEt9-UU2m3a9nASmIC8OU8` |
| Fine-Tuning Dataset | fine-tuning | 0.25 SUI | `aGir1MudixR_2MezEKRfKHzqwXkBzD1xd9iaFhamZQ0` |
| LoRA Adapter Weights | model-weights | 1.0 SUI | `rusSEWN3gYhFC-FZicd9KU1BCXt-HIvT9gF1Yc-tIQo` |

---

> Full step-by-step test runbook for every layer: **[docs/Testing-Guide.md](./Testing-Guide.md)**.

## Verified state (independently re-run against the new deployment)

| Area | Command | Result |
|------|---------|--------|
| Move unit tests | `sui move test` | **12/12 pass** (was 7, 3 stubbed) |
| Frontend typecheck | `npm run check` | **0 errors, 0 warnings** |
| Frontend build | `npx vite build` | pass |
| Contract E2E | `scripts/test-contracts.ts` | 11 pass / 6 skip — 3 listings on new pkg |
| MCP tools (7) | `scripts/test-mcp.ts` | **9 pass / 1 skip** (6 read tools); `buy_dataset` is opt-in/custodial, dry-run verified |
| Walrus round-trip | `scripts/walrus-spike.ts` | upload + download + Tatum checkpoint pass |
| Scripts typecheck | `scripts` `tsc --noEmit` | pass |
| MCP build | `mcp-server` `tsc` | pass |
| Seed list PTB | dry-run | `success`, 2 objects, 1 `DatasetListed` event |
| **Buy PTB (live contract)** | dry-run | `success`, 3 objects, **`DatasetPurchased`** event |

---

## 🔴 Demo-critical — action needed after the clean redeploy

The Session 8d redeploy changed the package + marketplace addresses, so the earlier B-2/B-3 work must be refreshed against the new IDs:

- **B-1 · Vercel Authentication** — deployment-independent; stays disabled. ✅
- **B-2 · Vercel env vars** — ⚠️ **RE-SET REQUIRED** (they point at the dead `0x86208eab…`). Update in the dashboard, then redeploy the frontend:
  - `PUBLIC_NEXUS_PACKAGE_ID=0x2797464179d14bd6ac9463019abb2000d840fc33547b378372ed3b6fc6b393e7`
  - `PUBLIC_NEXUS_MARKETPLACE_ID=0xac47e84574ce49163c02c2ea7f9e472aa45fcf64de599b97e8cac2e95f417430`
- **B-3 · Demo video** — ⚠️ **VERIFY**: the app UI is unchanged (same dataset names/prices), so a recording of the *flow* is still valid. Re-record only if your video shows a specific on-chain address, object, or Walrus blob ID (those changed).

---

## 🟢 Fixed

| ID | Fix | Verified by |
|----|-----|-------------|
| **B-4** | `buy_dataset` refunds overpayment from the **buyer's own coin** (not the treasury); provider paid exactly `price − fee`. | `test_buy_dataset_overpayment_refunds_from_payment` (fails on old contract) + live buy dry-run. **Redeployed.** |
| **B-5** | Duplicate-purchase prevention via `DatasetListing.purchasers` + `EAlreadyPurchased`; added `has_purchased()` view. | `test_double_purchase_fails`. **Redeployed.** |
| **B-6** | Frontend download gated behind on-chain `DatasetAccess` ownership (or provider); purchase unlocks it inline (replaced the `alert()`). Also fixed the buy PTB to split payment from `tx.gas` (the old `0x0` placeholder would have failed in the wallet). | `npm run check` + live buy dry-run; `hasPurchasedListing()` routed through Tatum. |
| **B-7** | Move suite rewritten to **12 real tests** incl. failure states (insufficient payment, double purchase, buy-delisted, non-provider delist, zero price) and full lifecycle. | `sui move test` 12/12. |
| **B-8** | Removed the dead `nexus_events.move` module (never imported/emitted); updated `test-contracts.ts` and docs. **Clean-redeployed** (Session 8d) so the on-chain package now has exactly one module (`nexus_marketplace`) — source and chain match, no leftover module. | Publish `objectChanges.modules = ["nexus_marketplace"]`; `sui move test` 12/12; `test-contracts.ts` 11/6. |
| **B-9** | Cleared all 5 frontend warnings → `npm run check` **0/0**: backdrop given `role`/`tabindex`/keyboard handler, CTA `href="#"` → real external link, upload `<label for="file-input">`, added `@types/node`. | `npm run check` 0 errors/0 warnings; `vite build` pass. |
| **B-10** | `scripts/` now typecheck cleanly via `"moduleDetection": "force"` (each file is a module → no global-scope redeclarations). | `tsc --noEmit` exit 0. |
| **F-1** | MCP server routes Sui reads through **Tatum** (was hardcoded to public fullnode); Tatum primary + fallback; startup logs the endpoint. | Startup log + `test-mcp.ts`. |
| **F-2** | Frontend TS errors 5 → 0. | `npm run check`. |
| **F-3** | `seed_marketplace.ts` repaired (programmatic keypair-signed PTB). Signs via public fullnode because the Tatum gateway doesn't expose `suix_getLatestSuiSystemState` needed for tx building. | Live re-seed: 3 listings created. |
| **F-4** | Homepage event query routed through Tatum. | `vite build`. |
| **F-5** | Docs hardened across README, `.env.example`, Deployment.md; this report. | — |
| **F-6** | **Marketplace "Failed to fetch" fixed.** The `@mysten/sui` SDK adds a `client-sdk-version` header Tatum's CORS blocks; the frontend now reads via a plain-`fetch` `rpc()` (Tatum-preferred + public-fullnode fallback). Replaced all SDK reads. | `npm run check` 0/0; live `rpc()` shape check (3 listings). |
| **F-7** | **Upload/purchase "reading 'address'" fixed.** `signAndExecuteTransaction` passed `account: undefined`; now passes the connected `wallet.adapter.accounts[0]`. | `npm run check`; flow review. |
| **F-8** | **"Dataset not found" on detail page fixed.** Listings are wrapped in the marketplace table (`sui_getObject` → notExists); now read via `suix_getDynamicFieldObject` (`getListingFields`). | Live: all 4 listings resolve; non-existent id → null. |
| **F-9** | **Explorer links → Suiscan, verified live.** Listing links pointed at the wrapped ID (showed "deleted") on deprecated `suiexplorer.com`; now link the live Field object + transaction + provider on Suiscan. | On-chain: package/marketplace/Field/tx all LIVE. |
| **F-10** | **MCP `get_dataset_details` wrapped-object bug fixed** (same as F-8) + new **`check_dataset_purchase`** tool (proof-of-purchase). | `test-mcp` 9/1 (proves `sui_getObject` fails, dynamic-field read succeeds). |

---

## ✅ "What's left" — consolidated checklist

**All contracts + backend + infra are done and verified.** Remaining work is the **frontend UI for the two stretch features** (the on-chain primitives are already deployed) plus user dashboard actions + submission.

### Done ✅
- [x] **Contracts** — deployed `0x2797464…`; generic **`buy_dataset<T>` / `list_dataset<T>` (multi-token)**; **Seal access control** (`seal_approve` + `seal_policy_id` + `encrypted` flag); refund-from-buyer + double-buy prevention; `has_purchased`; single `nexus_marketplace` module; **15/15 Move tests**; 3 datasets re-seeded.
- [x] **Frontend (core)** — marketplace/detail load (raw-`fetch` `rpc()`, Tatum + fullnode fallback); dynamic-field listing reads; wallet signing; download gated by `DatasetAccess`; Suiscan links (verified live); `npm run check` 0/0; builds. PTB builders are token-/Seal-aware (`coinType`, `sealPolicyId`).
- [x] **MCP server** — **7 tools** (adds opt-in custodial `buy_dataset`); `get_dataset_details` via dynamic field; Tatum-routed; `test-mcp` 9/1; npm-publish-ready; two-server client config documented.
- [x] **Docs** — README, API.md, Architecture.md, Deployment.md, Testing-Guide.md, Publishing-MCP.md reconciled to the current package + dynamic-field reads (multi-token/Seal frontend docs land with that UI).
- [x] **B-1** Vercel Authentication disabled.
- [x] **B-3** demo flow recorded (verify per below).

### ⚠️ User action (required)
- [ ] **B-2** — set the two Vercel env vars to the **current** IDs and **redeploy the frontend** (they may point at the dead `0x86208eab…`):
  - `PUBLIC_NEXUS_PACKAGE_ID=0x2797464179d14bd6ac9463019abb2000d840fc33547b378372ed3b6fc6b393e7`
  - `PUBLIC_NEXUS_MARKETPLACE_ID=0xac47e84574ce49163c02c2ea7f9e472aa45fcf64de599b97e8cac2e95f417430`
  - *(Also redeploy regardless — the latest frontend bug-fixes only go live on a new deploy.)*
- [ ] **B-3 verify** — confirm the demo video shows no old address/object/blob (re-record only if it does).
- [ ] **Submit** — public repo + 2–3 min video (Definition of Done, CLAUDE.md §22).

### 🔭 Stretch / out-of-MVP (CLAUDE.md §19)
- [x] **MCP server signs `buy_dataset` itself** — opt-in `buy_dataset` tool (custodial key, `NEXUS_ENABLE_SIGNING`); signs via fullnode; dry-run verified (`DatasetPurchased` + `DatasetAccess`). Default-off/safe.
- [x] **MCP server publish-ready for npm** — `bin`/shebang/`files`/`publishConfig` set; guide in [Publishing-MCP.md](./Publishing-MCP.md). *(Actual `npm publish` needs your npm login.)*
- [x] **Multi-token payments — contract** — `Coin<T>`-generic `list_dataset<T>`/`buy_dataset<T>`; listing stores `coin_type`; deployed in `0x2797464…`; `buy_dataset<SUI>` dry-run success. **Frontend UI (currency picker/display, pay-in-token) ⏳ in progress.**
- [x] **Encrypted previews — contract** — Seal access control via `seal_approve(id, &DatasetAccess)` + per-listing `seal_policy_id` + `encrypted` event flag; deployed + tested (15/15). **Frontend Seal encrypt-on-upload / decrypt-on-download (SessionKey + key servers) ⏳ in progress — needs browser+wallet testing.**
