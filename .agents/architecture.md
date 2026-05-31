# Nexus — Architecture Decision Log

> This file records key architectural decisions. Updated per phase.

## ADR-001: Two-Server MCP Architecture (2026-05-31)

**Context:** The antigravity.md spec assumed custom tools could be registered inside `@tatumio/mcp-server`. Live verification confirmed the actual package (`@tatumio/blockchain-mcp`) is a closed, pre-built server with 14 fixed tools.

**Decision:** Build a separate Nexus MCP server using `@modelcontextprotocol/sdk` that exposes domain-specific tools. Compose both MCP servers in the AI client config.

**Consequences:**
- All Sui RPC calls from the Nexus MCP server are routed through Tatum's gateway (satisfies Tatum integration scoring)
- Clean, demo-ready tool names (`search_nexus_datasets`, `buy_dataset`)
- Requires managing two server processes in the demo

## ADR-002: Walrus HTTP API for Spike, SDK for Production (2026-05-31)

**Context:** Two approaches exist — raw HTTP via `fetch()` to publisher/aggregator, or the `@mysten/walrus` TypeScript SDK.

**Decision:** Use raw HTTP for the Phase 1 spike (simpler, fewer deps), transition to `@mysten/walrus` SDK for production frontend code.

**Consequences:**
- Spike script is self-contained and debuggable
- Production code gets proper error handling and type safety from the SDK

## ADR-003: Testnet-First, Mainnet-Ready (2026-05-31)

**Context:** Walrus Mainnet launched March 2025. Testnet is free.

**Decision:** Target Sui Testnet + Walrus Testnet for all development. Environment variables support switching to Mainnet.

**Consequences:**
- No real token costs during development
- Demo can show testnet (judges understand this is a hackathon prototype)

## System Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  SvelteKit  │────▶│  Tatum Sui RPC   │────▶│  Sui Testnet  │
│  Frontend   │     │  Gateway          │     │  (Contracts)  │
└──────┬──────┘     └──────────────────┘     └───────────────┘
       │
       │ Upload/Download
       ▼
┌──────────────┐
│   Walrus     │
│  Publisher / │
│  Aggregator  │
└──────────────┘

┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  AI Agent   │────▶│  Nexus MCP       │────▶│  Tatum RPC    │
│  (LLM)      │     │  Server          │     │  Gateway      │
│             │────▶│                  │────▶│               │
│             │     │  + Tatum MCP     │     │  + Walrus     │
│             │     │  (composed)      │     │  Aggregator   │
└─────────────┘     └──────────────────┘     └───────────────┘
```
