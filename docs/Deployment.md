# Nexus Deployment Guide

## Prerequisites

- Node.js 18+
- Sui CLI v1.73.0+ (testnet)
- Sui wallet with testnet SUI
- Tatum API key (optional, for RPC)

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

### 4. Deploy to Vercel/Netlify
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod
```

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
| Package | `0xd4121a4525729f9319db53d66967f0669a5eff6603009d346befe9bac5b74816` |
| Marketplace | `0x7718f693693cac1637a972ae9a6cf14fdacb0d275a8c8b1aef34eb4b4dae1bce` |
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
