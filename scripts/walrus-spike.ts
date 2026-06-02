/**
 * walrus-spike.ts — Phase 1: The Spike
 *
 * Validates the two critical external dependencies before building anything:
 *   1. Walrus Publisher: Upload mock data → get blobId
 *   2. Walrus Aggregator: Download blob by blobId → verify content matches
 *   3. Tatum Sui RPC: Route a read through the gateway → confirm connectivity
 *
 * Uses raw HTTP fetch (ADR-002: HTTP API for spike, SDK for production).
 * Run: cd scripts && npm run spike
 *
 * Requires .env with TATUM_API_KEY at the repo root.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

// --- Configuration (§8.2, §8.1 verified endpoints) ---

const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
const TATUM_SUI_RPC = "https://sui-testnet.gateway.tatum.io";
const TATUM_API_KEY = process.env.TATUM_API_KEY;

// --- Utilities ---

function pass(step: string, detail: string): void {
  console.log(`  ✅ ${step}: ${detail}`);
}

function fail(step: string, detail: string): void {
  console.error(`  ❌ ${step}: ${detail}`);
}

// --- Step 1: Upload mock text to Walrus Publisher ---

interface WalrusNewlyCreated {
  newlyCreated: {
    blobObject: {
      blobId: string;
      id: string;
    };
    cost: number;
  };
}

interface WalrusAlreadyCertified {
  alreadyCertified: {
    blobId: string;
    endEpoch: number;
  };
}

type WalrusUploadResponse = WalrusNewlyCreated | WalrusAlreadyCertified;

async function stepUpload(): Promise<string | null> {
  console.log("\n📤 Step 1: Upload mock text to Walrus Publisher");
  console.log(`   Endpoint: PUT ${WALRUS_PUBLISHER}/v1/blobs`);

  const mockData =
    "timestamp,pair,price,volume\n" +
    "2026-01-01T00:00:00Z,USDC/USD,1.0001,42000000\n" +
    "2026-01-01T01:00:00Z,USDC/USD,0.9999,38000000\n" +
    "2026-01-01T02:00:00Z,USDT/USD,1.0002,55000000\n" +
    "2026-01-01T03:00:00Z,DAI/USD,0.9998,12000000\n";

  try {
    // §8.3: PUT <PUBLISHER>/v1/blobs, query params: epochs
    const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=1`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: Buffer.from(mockData, "utf-8"),
    });

    if (!res.ok) {
      const body = await res.text();
      fail("Upload", `HTTP ${res.status}: ${body}`);
      return null;
    }

    const json = (await res.json()) as WalrusUploadResponse;

    // §8.3: Response key field: response.newlyCreated.blobObject.blobId
    // Also handle alreadyCertified (if the same content was uploaded before)
    let blobId: string;
    if ("newlyCreated" in json) {
      blobId = json.newlyCreated.blobObject.blobId;
      pass("Upload", `New blob created. blobId = ${blobId}`);
    } else if ("alreadyCertified" in json) {
      blobId = json.alreadyCertified.blobId;
      pass(
        "Upload",
        `Blob already certified (same content). blobId = ${blobId}`
      );
    } else {
      fail("Upload", `Unexpected response shape: ${JSON.stringify(json)}`);
      return null;
    }

    return blobId;
  } catch (err) {
    fail("Upload", `Network error: ${(err as Error).message}`);
    return null;
  }
}

// --- Step 2: Read blob back from Walrus Aggregator ---

async function stepDownload(
  blobId: string,
  expectedContent: string
): Promise<boolean> {
  console.log("\n📥 Step 2: Read blob back from Walrus Aggregator");
  console.log(`   Endpoint: GET ${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);

  try {
    // §8.3: GET <AGGREGATOR>/v1/blobs/<BLOB_ID> (no auth required)
    const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);

    if (!res.ok) {
      const body = await res.text();
      fail("Download", `HTTP ${res.status}: ${body}`);
      return false;
    }

    const downloaded = await res.text();

    if (downloaded === expectedContent) {
      pass("Download", `Content matches! (${downloaded.length} bytes)`);
      return true;
    } else {
      fail(
        "Download",
        `Content mismatch!\n   Expected ${expectedContent.length} bytes, got ${downloaded.length} bytes`
      );
      console.log(
        `   First 100 chars received: ${downloaded.substring(0, 100)}`
      );
      return false;
    }
  } catch (err) {
    fail("Download", `Network error: ${(err as Error).message}`);
    return false;
  }
}

// --- Step 3: Route Sui RPC read through Tatum gateway ---

interface SuiRpcResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: { code: number; message: string };
}

async function stepTatumRpc(): Promise<boolean> {
  console.log("\n🔗 Step 3: Route Sui RPC read through Tatum gateway");
  console.log(`   Endpoint: POST ${TATUM_SUI_RPC}`);

  if (!TATUM_API_KEY) {
    fail(
      "Tatum RPC",
      "TATUM_API_KEY not found in .env — create .env from .env.example"
    );
    return false;
  }

  try {
    // §8.1: All requests require x-api-key header
    const res = await fetch(TATUM_SUI_RPC, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TATUM_API_KEY,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getLatestCheckpointSequenceNumber",
        params: [],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      fail("Tatum RPC", `HTTP ${res.status}: ${body}`);
      return false;
    }

    const json = (await res.json()) as SuiRpcResponse;

    if (json.error) {
      fail("Tatum RPC", `RPC error: ${json.error.message}`);
      return false;
    }

    pass(
      "Tatum RPC",
      `Connected! Latest checkpoint: ${json.result}`
    );
    return true;
  } catch (err) {
    fail("Tatum RPC", `Network error: ${(err as Error).message}`);
    return false;
  }
}

// --- Step 4: Full Pipeline Validation ---

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log("  🔮 Nexus — Phase 1 Spike: Infrastructure Validation");
  console.log("═══════════════════════════════════════════════════");

  const mockData =
    "timestamp,pair,price,volume\n" +
    "2026-01-01T00:00:00Z,USDC/USD,1.0001,42000000\n" +
    "2026-01-01T01:00:00Z,USDC/USD,0.9999,38000000\n" +
    "2026-01-01T02:00:00Z,USDT/USD,1.0002,55000000\n" +
    "2026-01-01T03:00:00Z,DAI/USD,0.9998,12000000\n";

  const results: boolean[] = [];

  // Step 1: Upload
  const blobId = await stepUpload();
  results.push(blobId !== null);

  // Step 2: Download (only if upload succeeded)
  if (blobId) {
    const downloadOk = await stepDownload(blobId, mockData);
    results.push(downloadOk);
  } else {
    console.log("\n⏭️  Step 2: Skipped (upload failed)");
    results.push(false);
  }

  // Step 3: Tatum RPC (independent of Walrus)
  const tatumOk = await stepTatumRpc();
  results.push(tatumOk);

  // --- Summary ---
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  📊 SPIKE RESULTS");
  console.log("═══════════════════════════════════════════════════");

  const labels = ["Walrus Upload", "Walrus Download", "Tatum Sui RPC"];
  let allPassed = true;

  for (let i = 0; i < results.length; i++) {
    const icon = results[i] ? "✅" : "❌";
    console.log(`  ${icon} ${labels[i]}`);
    if (!results[i]) allPassed = false;
  }

  console.log("");

  if (allPassed) {
    console.log("  🎉 ALL CHECKS PASSED — Infrastructure verified!");
    console.log("  ➡️  Safe to proceed to Phase 2: Move Contracts & Frontend");
  } else {
    console.log("  ⚠️  SOME CHECKS FAILED — Fix before proceeding.");
    console.log("  📖 See antigravity.md §20 for pivot triggers.");
  }

  console.log("═══════════════════════════════════════════════════\n");

  process.exit(allPassed ? 0 : 1);
}

main();
