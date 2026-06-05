# Publishing the Nexus MCP Server to npm

Publishing `mcp-server/` to npm lets anyone run the Nexus tools with **zero clone**:
`npx -y nexus-mcp-server`. The package is already publish-ready — `dist/index.js` has a
`#!/usr/bin/env node` shebang, `package.json` declares a `bin`, `files`, `publishConfig`,
and a `prepublishOnly` that rebuilds. You just need an npm account and one command.

> **Heads-up (irreversible-ish):** a published version is permanent — you can't re-publish the
> same version number, and unpublish is only allowed within 72h (and discouraged). Do a dry run first.

---

## 1. Prerequisites
- An npm account → https://www.npmjs.com/signup
- Logged in locally:
  ```bash
  npm login
  npm whoami     # confirms you're logged in
  ```

## 2. Pick the package name
Unscoped names must be globally unique, so `nexus-mcp-server` may be taken. Check:
```bash
npm view nexus-mcp-server version    # "404" = available
```
If taken (or to be safe), **scope it to your username** in `mcp-server/package.json`:
```json
"name": "@your-npm-username/nexus-mcp-server"
```
The `bin` key (`nexus-mcp-server`) stays the same — that's the CLI command users get.
`publishConfig.access` is already `"public"` so scoped packages publish publicly + free.

## 3. Build & inspect (dry run)
```bash
cd mcp-server
npm install
npm run build                 # produces dist/ (prepublishOnly also runs this on publish)
npm publish --dry-run         # prints exactly what WOULD be uploaded — no upload
npm pack                      # writes a .tgz tarball you can open to inspect
```
Confirm the tarball contains `dist/` (with the shebang on `dist/index.js`) and `README.md`, and nothing secret (no `.env`, no `src/`).

## 4. Publish
```bash
cd mcp-server
npm publish                   # scoped + public works because of publishConfig.access
# (if a plain unscoped name and 2FA is on, npm may prompt for an OTP)
```

## 5. Verify it works from anywhere
```bash
npx -y nexus-mcp-server            # or: npx -y @your-username/nexus-mcp-server
# stderr should print:
#   Nexus MCP Server started
#   Sui RPC: Tatum gateway (...) with public-fullnode fallback
#   Server-side signing: disabled (...)
```

## 6. Tell users how to wire it
Once published, the MCP client config (see
[Deployment.md → Configure in an AI client](./Deployment.md#4-configure-in-an-ai-client-two-server-composition))
simplifies to `npx` — no path needed:
```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["-y", "nexus-mcp-server"],
      "env": {
        "TATUM_API_KEY": "<your-tatum-api-key>",
        "NEXUS_PACKAGE_ID": "0x2797464179d14bd6ac9463019abb2000d840fc33547b378372ed3b6fc6b393e7",
        "NEXUS_MARKETPLACE_ID": "0xac47e84574ce49163c02c2ea7f9e472aa45fcf64de599b97e8cac2e95f417430"
      }
    },
    "tatum": { "command": "npx", "args": ["-y", "@tatumio/blockchain-mcp"], "env": { "TATUM_API_KEY": "<your-tatum-api-key>" } }
  }
}
```
> To enable the agent to **sign purchases itself**, also set `NEXUS_ENABLE_SIGNING=true` and
> `SUI_PRIVATE_KEY=<dedicated low-balance testnet key>` (see API.md → `buy_dataset`). Leave these
> unset for a read-only/safe deployment.

## 7. Shipping updates later
```bash
cd mcp-server
npm version patch        # 1.0.0 -> 1.0.1 (use minor/major as appropriate)
npm publish
```

---

### Optional: GitHub Packages instead of npmjs
If you'd rather host on GitHub Packages, set `"name": "@Manuel-dev01/nexus-mcp-server"` and add
`"publishConfig": { "registry": "https://npm.pkg.github.com" }`, then `npm publish` with a GitHub
token that has `write:packages`. The npmjs path above is simpler for judges, since `npx` resolves it with no extra registry config.
