# Nexus Deployment Guide

> ### ⚠️ Two manual blockers before the live demo
> The deployed frontend will not be publicly reachable until **both** of these are done in the Vercel dashboard — neither can be set from code:
> 1. **Deployment Protection → disable "Vercel Authentication"** (otherwise the URL shows a Vercel login wall).
> 2. **Set `PUBLIC_NEXUS_PACKAGE_ID` and `PUBLIC_NEXUS_MARKETPLACE_ID`** env vars (recommended; the app also has hardcoded fallbacks, so it loads without them, but set them for prod clarity).
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
| Name | Value |
|------|-------|
| `PUBLIC_NEXUS_PACKAGE_ID` | `0x86208eab6fcdadc33273cc65fed9b43177d7c65105ef88134eb635652d258788` |
| `PUBLIC_NEXUS_MARKETPLACE_ID` | `0xaea5cb73bb7d4b8a6cac69be6dbd7d736cf73ec62563ac87f125c4f0c45f30b2` |

Note: Contract addresses are also hardcoded in `frontend/src/lib/sui/config.ts` as fallbacks.

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

### 4. Configure in AI Client
Add to MCP client config:
```json
{
  "mcpServers": {
    "nexus": {
      "command": "node",
      "args": ["path/to/nexus/mcp-server/dist/index.js"],
      "env": {
        "TATUM_API_KEY": "<tatum-api-key>",
        "TATUM_RPC_URL": "https://sui-testnet.gateway.tatum.io",
        "NEXUS_PACKAGE_ID": "<package-id>",
        "NEXUS_MARKETPLACE_ID": "<marketplace-id>"
      }
    }
  }
}
```

## Testnet Deployment Status

**Deployed:** 2026-06-04

| Component | ID/URL |
|-----------|--------|
| Package | `0x86208eab6fcdadc33273cc65fed9b43177d7c65105ef88134eb635652d258788` |
| Marketplace | `0xaea5cb73bb7d4b8a6cac69be6dbd7d736cf73ec62563ac87f125c4f0c45f30b2` |
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
