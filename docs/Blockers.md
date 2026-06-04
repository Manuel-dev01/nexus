# Nexus — Blockers & Gaps (Triaged)

> Single source of truth for open issues, verified gaps, and what was fixed.
> Last updated: 2026-06-05 (Session 8c — B-8/B-9/B-10 cleanup; B-1/B-2/B-3 done by user).
> Severity: 🔴 demo/release-blocking · 🟠 important · 🟡 minor/polish · 🟢 fixed.

---

## Current deployment (Sui Testnet, chain `4c78adac`)

| Object | ID |
|--------|----|
| Package | `0x86208eab6fcdadc33273cc65fed9b43177d7c65105ef88134eb635652d258788` |
| Marketplace (shared) | `0xaea5cb73bb7d4b8a6cac69be6dbd7d736cf73ec62563ac87f125c4f0c45f30b2` |
| UpgradeCap | `0x9d50ae683b2b4fa63fa3e58b8a53b8cf775d63af4d1f4b9cb28ce0145b085300` |

> The earlier package `0xd4121a45…` / marketplace `0x7718f693…` are **dead** — superseded by the redeploy after the breaking struct change. Do not use them.

**Seeded datasets (new blob IDs):**

| Dataset | Category | Price | Walrus Blob ID |
|---------|----------|-------|----------------|
| GPT-2 Embedding Vectors | embeddings | 0.5 SUI | `K1Ib_CNCEr7rG9rOiPMYd3NGxiF9x4DtlLoHNJJjEy8` |
| Fine-Tuning Dataset | fine-tuning | 0.25 SUI | `aGir1MudixR_2MezEKRfKHzqwXkBzD1xd9iaFhamZQ0` |
| LoRA Adapter Weights | model-weights | 1.0 SUI | `foce6UR-SRib69uQJf9i6NCbve6fzGZmxbtCr9WzVV8` |

---

## Verified state (independently re-run against the new deployment)

| Area | Command | Result |
|------|---------|--------|
| Move unit tests | `sui move test` | **12/12 pass** (was 7, 3 stubbed) |
| Frontend typecheck | `npm run check` | **0 errors, 0 warnings** |
| Frontend build | `npx vite build` | pass |
| Contract E2E | `scripts/test-contracts.ts` | 11 pass / 6 skip — 3 listings on new pkg |
| MCP tools | `scripts/test-mcp.ts` | 7 pass / 1 skip — downloaded new LoRA blob |
| Walrus round-trip | `scripts/walrus-spike.ts` | upload + download + Tatum checkpoint pass |
| Scripts typecheck | `scripts` `tsc --noEmit` | pass |
| MCP build | `mcp-server` `tsc` | pass |
| Seed list PTB | dry-run | `success`, 2 objects, 1 `DatasetListed` event |
| **Buy PTB (live contract)** | dry-run | `success`, 3 objects, **`DatasetPurchased`** event |

---

## ✅ Demo-critical — completed by the user

- **B-1 · Vercel Authentication** — disabled in the dashboard (public URL loads). ✅
- **B-2 · Vercel env vars** — set to the new package/marketplace addresses + redeployed. ✅
- **B-3 · Demo video** — recorded against the current deployment. ✅

> Because B-2/B-3 are tied to the **current** package (`0x86208eab…`), the contract is intentionally **not** redeployed again. B-8 below is therefore handled as a source-only change.

---

## 🟢 Fixed

| ID | Fix | Verified by |
|----|-----|-------------|
| **B-4** | `buy_dataset` refunds overpayment from the **buyer's own coin** (not the treasury); provider paid exactly `price − fee`. | `test_buy_dataset_overpayment_refunds_from_payment` (fails on old contract) + live buy dry-run. **Redeployed.** |
| **B-5** | Duplicate-purchase prevention via `DatasetListing.purchasers` + `EAlreadyPurchased`; added `has_purchased()` view. | `test_double_purchase_fails`. **Redeployed.** |
| **B-6** | Frontend download gated behind on-chain `DatasetAccess` ownership (or provider); purchase unlocks it inline (replaced the `alert()`). Also fixed the buy PTB to split payment from `tx.gas` (the old `0x0` placeholder would have failed in the wallet). | `npm run check` + live buy dry-run; `hasPurchasedListing()` routed through Tatum. |
| **B-7** | Move suite rewritten to **12 real tests** incl. failure states (insufficient payment, double purchase, buy-delisted, non-provider delist, zero price) and full lifecycle. | `sui move test` 12/12. |
| **B-8** | Removed the dead `nexus_events.move` module (never imported/emitted); updated `test-contracts.ts` (dropped the module assertion) and docs. **Source-only** — the *currently deployed* package still contains the harmless module; it drops out on the next publish. | `sui move build`/`test` 12/12; `test-contracts.ts` 11/6. |
| **B-9** | Cleared all 5 frontend warnings → `npm run check` **0/0**: backdrop given `role`/`tabindex`/keyboard handler, CTA `href="#"` → real external link, upload `<label for="file-input">`, added `@types/node`. | `npm run check` 0 errors/0 warnings; `vite build` pass. |
| **B-10** | `scripts/` now typecheck cleanly via `"moduleDetection": "force"` (each file is a module → no global-scope redeclarations). | `tsc --noEmit` exit 0. |
| **F-1** | MCP server routes Sui reads through **Tatum** (was hardcoded to public fullnode); Tatum primary + fallback; startup logs the endpoint. | Startup log + `test-mcp.ts`. |
| **F-2** | Frontend TS errors 5 → 0. | `npm run check`. |
| **F-3** | `seed_marketplace.ts` repaired (programmatic keypair-signed PTB). Signs via public fullnode because the Tatum gateway doesn't expose `suix_getLatestSuiSystemState` needed for tx building. | Live re-seed: 3 listings created. |
| **F-4** | Homepage event query routed through Tatum. | `vite build`. |
| **F-5** | Docs hardened across README, `.env.example`, Deployment.md; this report. | — |

---

## What's left

**Nothing tracked is open.** All B-1 … B-10 plus F-1 … F-5 are resolved (B-1/2/3 by the user; the rest in code). The only standing caveat is cosmetic: the *currently deployed* testnet package still carries the now-removed `nexus_events` module (B-8) — harmless, and it disappears on any future publish.
