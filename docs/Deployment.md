# Nexus Deployment Guide

> ### ⚠️ Two manual blockers before the live demo
> The deployed frontend will not be publicly reachable until **both** of these are done in the Vercel dashboard — neither can be set from code:
> 1. **Deployment Protection → disable "Vercel Authentication"** (otherwise the URL shows a Vercel login wall).
> 2. **Set `PUBLIC_NEXUS_PACKAGE_ID` and `PUBLIC_NEXUS_MARKETPLACE_ID`** to the current IDs (below) and **redeploy the frontend**. ⚠️ **Required if env vars were set before a redeploy** — they would point at a now-dead package. The source has updated hardcoded fallbacks, so the app loads, but stale Vercel env vars override them.
>
> See [Required Vercel Dashboard Settings](#required-vercel-dashboard-settings) below. Full open-issue list: [Blockers.md](./Blockers.md).

## Prerequisites

- Node.js 18+
- Sui CLI v1.73.0+ (testnet)
- Sui wallet with testnet SUI
- Tatum API key — **optional for the frontend** (it falls back to Tatum's anonymous tier / hardcoded config), but **required for the MCP server**, which routes all Sui reads through the Tatum gateway with the public fullnode only as a fallback.

## Contract Deployment

### 1. Build Contracts
```bash
cd move
sui move build
```

### 2. Deploy to Testnet
```bash
sui client publish --gas-budget 100000000
```

### 3. Record Addresses
After deployment, note:
- **Package ID** — from publish output
- **Marketplace ID** — shared object created by `init`
- **UpgradeCap ID** — for future upgrades

### 4. Update .env
```bash
# frontend/.env
PUBLIC_NEXUS_PACKAGE_ID=<package-id>
PUBLIC_NEXUS_MARKETPLACE_ID=<marketplace-id>
```

## Frontend Deployment

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in:
- `PUBLIC_TATUM_RPC_URL` — Tatum Sui RPC endpoint
- `PUBLIC_TATUM_API_KEY` — Tatum API key
- `PUBLIC_NEXUS_PACKAGE_ID` — Deployed package ID
- `PUBLIC_NEXUS_MARKETPLACE_ID` — Marketplace object ID

### 3. Build
```bash
npx vite build
```

### 4. Deploy to Vercel
```bash
# Deploy from frontend directory
cd frontend
vercel --prod
```

**Vercel Configuration:**
- Uses `adapter-static` (outputs to `build/` directory)
- `vercel-build.sh` script handles npm install + build
- `framework: null` in vercel.json to prevent Vercel's SvelteKit preset from overriding build command

**Required Vercel Dashboard Settings:**
1. **Framework Preset** → "Other" (not SvelteKit)
2. **Build Command** → `bash vercel-build.sh`
3. **Output Directory** → `frontend/build`
4. **Install Command** → `echo skip`
5. **Deployment Protection** → Disable "Vercel Authentication"

**Environment Variables (set in Vercel Dashboard):**
| Name | Value | Required? |
|------|-------|-----------|
| `PUBLIC_NEXUS_PACKAGE_ID` | `0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6` | required if any were set pre-redeploy |
| `PUBLIC_NEXUS_MARKETPLACE_ID` | `0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99` | required if any were set pre-redeploy |
| `PUBLIC_TATUM_API_KEY` | your Tatum API key | optional (enables frontend→Tatum) |

Notes:
- Contract addresses are hardcoded in `frontend/src/lib/sui/config.ts` as fallbacks, so the app loads even with NO env vars set. But a Vercel env var, once set, **overrides** the fallback — so if it holds a stale (dead) address, the app breaks until you update it and redeploy.
- **`PUBLIC_TATUM_API_KEY`**: if set, the frontend routes its read RPC through the Tatum gateway; if unset, it automatically falls back to the public Sui fullnode (the app works either way). The frontend uses a plain `fetch` for RPC — **not** the `@mysten/sui` SDK client — because the SDK adds a `client-sdk-version` request header that the Tatum gateway's CORS policy blocks in the browser.

## MCP Server Deployment

### 1. Install Dependencies
```bash
cd mcp-server
npm install
```

### 2. Build
```bash
npx tsc
```

### 3. Run
```bash
node dist/index.js
```

### 4. Configure in an AI client (two-server composition)

Nexus uses **two MCP servers side by side**: the custom **Nexus** server (domain tools) and Tatum's stock **`@tatumio/blockchain-mcp`** (generic chain data). Add both to your client's MCP config (e.g. Claude Desktop `claude_desktop_config.json`, Cursor, or any MCP client):

```json
{
  "mcpServers": {
    "nexus": {
      "command": "node",
      "args": ["/absolute/path/to/nexus/mcp-server/dist/index.js"],
      "env": {
        "TATUM_API_KEY": "<your-tatum-api-key>",
        "TATUM_RPC_URL": "https://sui-testnet.gateway.tatum.io",
        "NEXUS_PACKAGE_ID": "0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6",
        "NEXUS_MARKETPLACE_ID": "0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99",
        "WALRUS_AGGREGATOR_URL": "https://aggregator.walrus-testnet.walrus.space"
      }
    },
    "tatum": {
      "command": "npx",
      "args": ["-y", "@tatumio/blockchain-mcp"],
      "env": { "TATUM_API_KEY": "<your-tatum-api-key>" }
    }
  }
}
```

**Nexus server env vars** (all optional — hardcoded defaults exist; `TATUM_API_KEY` makes reads go through Tatum vs the public fullnode fallback): `TATUM_API_KEY`, `TATUM_RPC_URL`, `NEXUS_PACKAGE_ID`, `NEXUS_MARKETPLACE_ID`, `WALRUS_AGGREGATOR_URL`.

**Nexus tools exposed:** `search_nexus_datasets`, `get_dataset_details`, `check_dataset_purchase`, `get_walrus_blob`, `get_marketplace_stats`, `verify_dataset_integrity` (+ the `marketplace://overview` resource).

**Agent flow:** the LLM calls `search_nexus_datasets` → `get_dataset_details` → optionally `check_dataset_purchase` → presents the listing + price (a wallet signs the actual `buy_dataset` PTB) → `get_walrus_blob` to ingest the data.

## Testnet Deployment Status

**Deployed:** 2026-06-04

| Component | ID/URL |
|-----------|--------|
| Package | `0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6` |
| Marketplace | `0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99` |
| Chain ID | `4c78adac` (testnet) |
| Sui RPC | `https://sui-testnet.gateway.tatum.io` |
| Walrus Publisher | `https://publisher.walrus-testnet.walrus.space` |
| Walrus Aggregator | `https://aggregator.walrus-testnet.walrus.space` |

## Verification

### Verify Contracts
```bash
# Check package exists
sui client object <package-id>

# Check marketplace
sui client object <marketplace-id>

# Run unit tests
cd move && sui move test
```

### Verify Frontend
```bash
cd frontend
npx vite build
npx vite preview
```

### Verify MCP Server
```bash
cd mcp-server
npx tsc --noEmit
npx tsx ../scripts/test-mcp.ts
```

## Troubleshooting

### "Package already published"
Remove `Published.toml` or use `--pubfile-path` for a new file.

### "Object not found"
Ensure you're on the correct network (testnet) and the object ID is correct.

### "Insufficient gas"
Request testnet SUI from the [Sui Faucet](https://faucet.sui.io/).

### Walrus upload fails
Check network connectivity. Corporate firewalls may block `*.walrus.space`.

### MCP server won't start
Ensure `@modelcontextprotocol/sdk` is installed:
```bash
cd mcp-server && npm install
```
