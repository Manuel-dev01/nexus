# Nexus — Blockers & Gaps (Triaged)

> Single source of truth for open issues, verified gaps, and what was fixed.
> Last updated: 2026-06-05 (Session 8h — MCP `get_dataset_details` fix + full docs reconciliation).
> Severity: 🔴 demo/release-blocking · 🟠 important · 🟡 minor/polish · 🟢 fixed.

---

## Current deployment (Sui Testnet, chain `4c78adac`)

| Object | ID |
|--------|----|
| Package | `0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6` |
| Marketplace (shared) | `0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99` |
| UpgradeCap | `0x1e83efd34871a1965df1de5908ac335aa0d0c4dfe77352de8ede4987f20a21f6` |

> **Dead packages (do not use):** `0xd4121a45…` (original) and `0x86208eab…` (the B-4/B-5 fix deploy, which still carried the `nexus_events` module). Both are superseded by `0xb291fda4…`, whose bytecode now exactly matches the cleaned source (single `nexus_marketplace` module).

**Seeded datasets (new blob IDs):**

| Dataset | Category | Price | Walrus Blob ID |
|---------|----------|-------|----------------|
| GPT-2 Embedding Vectors | embeddings | 0.5 SUI | `BBCZfBAb6FI8zHOHa7ztwPBUHvcIJd3X9TARW7RVX8w` |
| Fine-Tuning Dataset | fine-tuning | 0.25 SUI | `aGir1MudixR_2MezEKRfKHzqwXkBzD1xd9iaFhamZQ0` |
| LoRA Adapter Weights | model-weights | 1.0 SUI | `Zkw-aZCSW8EMuZHmXh_fq-J3qlVnQcPEj9t9M46WOeQ` |

---

> Full step-by-step test runbook for every layer: **[docs/Testing-Guide.md](./Testing-Guide.md)**.

## Verified state (independently re-run against the new deployment)

| Area | Command | Result |
|------|---------|--------|
| Move unit tests | `sui move test` | **12/12 pass** (was 7, 3 stubbed) |
| Frontend typecheck | `npm run check` | **0 errors, 0 warnings** |
| Frontend build | `npx vite build` | pass |
| Contract E2E | `scripts/test-contracts.ts` | 11 pass / 6 skip — 3 listings on new pkg |
| MCP tools (6) | `scripts/test-mcp.ts` | **9 pass / 1 skip** — incl. dynamic-field `get_dataset_details` + `check_dataset_purchase` |
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
  - `PUBLIC_NEXUS_PACKAGE_ID=0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6`
  - `PUBLIC_NEXUS_MARKETPLACE_ID=0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99`
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

**Everything in code/contracts/docs is done.** The only open items are user dashboard actions + submission.

### Done ✅
- [x] **Contracts** — deployed `0xb291fda4…`; `buy_dataset` refund fix + double-buy prevention; `has_purchased` view; single `nexus_marketplace` module; **12/12 Move tests**; 3 datasets seeded.
- [x] **Frontend** — marketplace/detail load (raw-`fetch` `rpc()`, Tatum + fullnode fallback); dynamic-field listing reads; wallet signing; download gated by `DatasetAccess`; Suiscan links (verified live); `npm run check` 0/0; builds.
- [x] **MCP server** — **6 tools** (incl. `check_dataset_purchase`); `get_dataset_details` reads via dynamic field; Tatum-routed; `test-mcp` 9/1; two-server client config documented.
- [x] **Docs** — README, API.md, Architecture.md, Deployment.md, CLAUDE.md, active-tasks all reconciled to the current package, single module, dynamic-field reads, and 6-tool MCP.
- [x] **B-1** Vercel Authentication disabled.
- [x] **B-3** demo flow recorded (verify per below).

### ⚠️ User action (required)
- [ ] **B-2** — set the two Vercel env vars to the **current** IDs and **redeploy the frontend** (they may point at the dead `0x86208eab…`):
  - `PUBLIC_NEXUS_PACKAGE_ID=0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6`
  - `PUBLIC_NEXUS_MARKETPLACE_ID=0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99`
  - *(Also redeploy regardless — the latest frontend bug-fixes only go live on a new deploy.)*
- [ ] **B-3 verify** — confirm the demo video shows no old address/object/blob (re-record only if it does).
- [ ] **Submit** — public repo + 2–3 min video (Definition of Done, CLAUDE.md §22).

### 🔭 Stretch / out-of-MVP (explicitly not blocking — CLAUDE.md §19)
- [ ] MCP server signing the `buy_dataset` PTB itself (needs server-side key custody).
- [ ] Encrypted dataset previews; multi-token payments.
