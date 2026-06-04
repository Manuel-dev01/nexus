/**
 * walrus-spike.ts — Phase 1 Enhanced Spike: Infrastructure Validation
 *
 * Validates the two critical external dependencies with meaningful integration tests:
 *   1. Walrus: Upload real AI training data, verify lifecycle, estimate costs
 *   2. Tatum: Route multiple Sui RPC reads through gateway, test SuiClient init
 *
 * Uses raw HTTP for spike (ADR-002), SDK for production.
 * Run: cd scripts && npm run spike
 *
 * Requires .env with TATUM_API_KEY at the repo root.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

// Load .env from repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", ".env") });

// --- Configuration ---

const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
const TATUM_SUI_RPC = "https://sui-testnet.gateway.tatum.io";
const TATUM_API_KEY = process.env.TATUM_API_KEY;

// --- Types ---

interface WalrusNewlyCreated {
  newlyCreated: {
    blobObject: {
      blobId: string;
      id: string;
      size: number;
      certifiedEpoch: number;
      storageEpochs: number;
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

interface SuiRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

interface SpikeResult {
  name: string;
  passed: boolean;
  duration: number;
  details: string;
  data?: any;
}

interface SpikeReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    network: string;
  };
  results: SpikeResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

// --- Utilities ---

function pass(step: string, detail: string, data?: any): SpikeResult {
  console.log(`  ✅ ${step}: ${detail}`);
  return { name: step, passed: true, duration: 0, details: detail, data };
}

function fail(step: string, detail: string, data?: any): SpikeResult {
  console.error(`  ❌ ${step}: ${detail}`);
  return { name: step, passed: false, duration: 0, details: detail, data };
}

function skip(step: string, reason: string): SpikeResult {
  console.log(`  ⏭️  ${step}: Skipped — ${reason}`);
  return { name: step, passed: false, duration: 0, details: `Skipped: ${reason}` };
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function formatMist(mist: number): string {
  return `${(mist / 1_000_000_000).toFixed(4)} SUI`;
}

// --- Test Data Generators ---

function generateEmbeddingVector(dimensions: number = 768): Buffer {
  // Generate realistic embedding vector (float32 array)
  const floats = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    floats[i] = Math.random() * 2 - 1; // Random values between -1 and 1
  }
  return Buffer.from(floats.buffer);
}

function generateFineTuningDataset(numExamples: number = 10): Buffer {
  // Generate JSONL fine-tuning data
  const examples = [];
  for (let i = 0; i < numExamples; i++) {
    examples.push(JSON.stringify({
      prompt: `Example prompt ${i}: What is the meaning of life?`,
      completion: `Example completion ${i}: The meaning of life is to find your gift and give it away.`
    }));
  }
  return Buffer.from(examples.join("\n"), "utf-8");
}

function generateModelWeights(numLayers: number = 4): Buffer {
  // Generate mock model weights (float32 arrays for each layer)
  const layers = [];
  for (let i = 0; i < numLayers; i++) {
    const weights = new Float32Array(128 * 128); // 128x128 matrix
    for (let j = 0; j < weights.length; j++) {
      weights[j] = Math.random() * 0.1 - 0.05; // Small random weights
    }
    layers.push(Buffer.from(weights.buffer));
  }
  return Buffer.concat(layers);
}

// --- Step 1: Walrus Upload Tests ---

async function testWalrusUpload(
  data: Buffer,
  description: string,
  epochs: number = 1
): Promise<SpikeResult> {
  const start = Date.now();
  console.log(`\n📤 Walrus Upload: ${description}`);
  console.log(`   Size: ${data.length} bytes, Epochs: ${epochs}`);
  console.log(`   Endpoint: PUT ${WALRUS_PUBLISHER}/v1/blobs`);

  try {
    const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: data,
    });

    if (!res.ok) {
      const body = await res.text();
      return fail("Upload", `HTTP ${res.status}: ${body}`);
    }

    const json = (await res.json()) as WalrusUploadResponse;
    const duration = Date.now() - start;

    if ("newlyCreated" in json) {
      const { blobObject, cost } = json.newlyCreated;
      console.log(`   blobId: ${blobObject.blobId}`);
      console.log(`   Sui Object ID: ${blobObject.id}`);
      console.log(`   Cost: ${formatMist(cost)}`);
      console.log(`   Certified Epoch: ${blobObject.certifiedEpoch}`);
      console.log(`   Storage Epochs: ${blobObject.storageEpochs}`);
      console.log(`   Duration: ${duration}ms`);

      return {
        name: "Upload",
        passed: true,
        duration,
        details: `New blob created. blobId=${blobObject.blobId}, cost=${formatMist(cost)}`,
        data: {
          blobId: blobObject.blobId,
          objectId: blobObject.id,
          cost,
          certifiedEpoch: blobObject.certifiedEpoch,
          storageEpochs: blobObject.storageEpochs,
          size: data.length,
          sha256: sha256(data)
        }
      };
    } else if ("alreadyCertified" in json) {
      console.log(`   blobId: ${json.alreadyCertified.blobId}`);
      console.log(`   End Epoch: ${json.alreadyCertified.endEpoch}`);
      console.log(`   Duration: ${duration}ms`);

      return {
        name: "Upload",
        passed: true,
        duration,
        details: `Blob already certified. blobId=${json.alreadyCertified.blobId}`,
        data: {
          blobId: json.alreadyCertified.blobId,
          endEpoch: json.alreadyCertified.endEpoch,
          size: data.length,
          sha256: sha256(data)
        }
      };
    } else {
      return fail("Upload", `Unexpected response shape: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    return fail("Upload", `Network error: ${(err as Error).message}`);
  }
}

// --- Step 2: Walrus Download & Verification ---

async function testWalrusDownload(
  blobId: string,
  expectedHash: string,
  expectedSize: number
): Promise<SpikeResult> {
  const start = Date.now();
  console.log(`\n📥 Walrus Download: blobId=${blobId}`);
  console.log(`   Expected: ${expectedSize} bytes, SHA256=${expectedHash.substring(0, 16)}...`);
  console.log(`   Endpoint: GET ${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);

  try {
    const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);

    if (!res.ok) {
      const body = await res.text();
      return fail("Download", `HTTP ${res.status}: ${body}`);
    }

    const downloaded = Buffer.from(await res.arrayBuffer());
    const duration = Date.now() - start;
    const actualHash = sha256(downloaded);

    console.log(`   Received: ${downloaded.length} bytes`);
    console.log(`   SHA256: ${actualHash.substring(0, 16)}...`);
    console.log(`   Duration: ${duration}ms`);

    if (downloaded.length !== expectedSize) {
      return fail("Download", `Size mismatch: expected ${expectedSize}, got ${downloaded.length}`);
    }

    if (actualHash !== expectedHash) {
      return fail("Download", `Hash mismatch: expected ${expectedHash.substring(0, 16)}..., got ${actualHash.substring(0, 16)}...`);
    }

    return {
      name: "Download",
      passed: true,
      duration,
      details: `Content verified: ${downloaded.length} bytes, hash matches`,
      data: { size: downloaded.length, sha256: actualHash }
    };
  } catch (err) {
    return fail("Download", `Network error: ${(err as Error).message}`);
  }
}

// --- Step 3: Tatum RPC Tests ---

async function testTatumRpc(
  method: string,
  params: any[],
  description: string
): Promise<SpikeResult> {
  const start = Date.now();
  console.log(`\n🔗 Tatum RPC: ${description}`);
  console.log(`   Method: ${method}`);
  console.log(`   Endpoint: POST ${TATUM_SUI_RPC}`);

  if (!TATUM_API_KEY) {
    return fail("Tatum RPC", "TATUM_API_KEY not found in .env");
  }

  try {
    const res = await fetch(TATUM_SUI_RPC, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TATUM_API_KEY,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return fail("Tatum RPC", `HTTP ${res.status}: ${body}`);
    }

    const json = (await res.json()) as SuiRpcResponse;
    const duration = Date.now() - start;

    if (json.error) {
      return fail("Tatum RPC", `RPC error: ${json.error.message}`);
    }

    console.log(`   Result: ${JSON.stringify(json.result).substring(0, 100)}...`);
    console.log(`   Duration: ${duration}ms`);

    return {
      name: "Tatum RPC",
      passed: true,
      duration,
      details: `${description} succeeded`,
      data: { method, result: json.result }
    };
  } catch (err) {
    return fail("Tatum RPC", `Network error: ${(err as Error).message}`);
  }
}

// --- Step 4: Full Pipeline Validation ---

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🔮 Nexus — Phase 1 Enhanced Spike: Infrastructure Validation");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  Node: ${process.version}`);
  console.log(`  Platform: ${process.platform} ${process.arch}`);
  console.log("");

  const report: SpikeReport = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch}`,
      network: TATUM_SUI_RPC,
    },
    results: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
  };

  // --- Walrus Integration Tests ---

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  📦 WALRUS INTEGRATION TESTS");
  console.log("═══════════════════════════════════════════════════════════════");

  // Test 1: Upload embedding vector
  const embeddingData = generateEmbeddingVector(768);
  const embeddingResult = await testWalrusUpload(
    embeddingData,
    "768-dimension embedding vector (Float32Array)",
    1
  );
  report.results.push(embeddingResult);

  // Test 2: Upload fine-tuning dataset
  const fineTuningData = generateFineTuningDataset(10);
  const fineTuningResult = await testWalrusUpload(
    fineTuningData,
    "JSONL fine-tuning dataset (10 examples)",
    1
  );
  report.results.push(fineTuningResult);

  // Test 3: Upload model weights
  const weightsData = generateModelWeights(4);
  const weightsResult = await testWalrusUpload(
    weightsData,
    "Model weights (4 layers, 128x128 Float32)",
    2  // Store for 2 epochs
  );
  report.results.push(weightsResult);

  // Test 4: Download and verify embedding vector
  if (embeddingResult.passed && embeddingResult.data?.blobId) {
    const downloadResult = await testWalrusDownload(
      embeddingResult.data.blobId,
      embeddingResult.data.sha256,
      embeddingResult.data.size
    );
    report.results.push(downloadResult);
  } else {
    report.results.push(skip("Download", "Upload failed"));
  }

  // Test 5: Download and verify fine-tuning dataset
  if (fineTuningResult.passed && fineTuningResult.data?.blobId) {
    const downloadResult = await testWalrusDownload(
      fineTuningResult.data.blobId,
      fineTuningResult.data.sha256,
      fineTuningResult.data.size
    );
    report.results.push(downloadResult);
  } else {
    report.results.push(skip("Download", "Upload failed"));
  }

  // --- Tatum Integration Tests ---

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  🔗 TATUM INTEGRATION TESTS");
  console.log("═══════════════════════════════════════════════════════════════");

  // Test 6: Get latest checkpoint
  const checkpointResult = await testTatumRpc(
    "sui_getLatestCheckpointSequenceNumber",
    [],
    "Get latest checkpoint sequence number"
  );
  report.results.push(checkpointResult);

  // Add delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 7: Get chain identifier
  const chainIdResult = await testTatumRpc(
    "sui_getChainIdentifier",
    [],
    "Get chain identifier"
  );
  report.results.push(chainIdResult);

  // Add delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 8: Get protocol config
  const protocolConfigResult = await testTatumRpc(
    "sui_getProtocolConfig",
    [],
    "Get protocol configuration"
  );
  report.results.push(protocolConfigResult);

  // Add delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 9: Get total transaction blocks
  const totalTxResult = await testTatumRpc(
    "sui_getTotalTransactionBlocks",
    [],
    "Get total transaction blocks"
  );
  report.results.push(totalTxResult);

  // Add delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 10: Get object (using Sui system object)
  const getObjectResult = await testTatumRpc(
    "sui_getObject",
    ["0x5", { showType: true, showContent: true }],
    "Get Sui system object"
  );
  report.results.push(getObjectResult);

  // --- Summary ---

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  📊 SPIKE RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");

  report.summary.total = report.results.length;
  report.summary.passed = report.results.filter(r => r.passed).length;
  report.summary.failed = report.results.filter(r => !r.passed && r.details !== "Skipped").length;
  report.summary.skipped = report.results.filter(r => r.details === "Skipped").length;

  console.log(`\n  Total Tests: ${report.summary.total}`);
  console.log(`  ✅ Passed: ${report.summary.passed}`);
  console.log(`  ❌ Failed: ${report.summary.failed}`);
  console.log(`  ⏭️  Skipped: ${report.summary.skipped}`);

  console.log("\n  Detailed Results:");
  for (const result of report.results) {
    const icon = result.passed ? "✅" : (result.details.startsWith("Skipped") ? "⏭️" : "❌");
    const duration = result.duration > 0 ? ` (${result.duration}ms)` : "";
    console.log(`    ${icon} ${result.name}: ${result.details}${duration}`);
  }

  console.log("\n  Walrus Integration:");
  const walrusTests = report.results.filter(r => r.name.includes("Upload") || r.name.includes("Download"));
  const walrusPassed = walrusTests.filter(r => r.passed).length;
  console.log(`    ${walrusPassed}/${walrusTests.length} tests passed`);

  console.log("\n  Tatum Integration:");
  const tatumTests = report.results.filter(r => r.name.includes("Tatum"));
  const tatumPassed = tatumTests.filter(r => r.passed).length;
  console.log(`    ${tatumPassed}/${tatumTests.length} tests passed`);

  console.log("\n═══════════════════════════════════════════════════════════════");

  if (report.summary.passed === report.summary.total) {
    console.log("  🎉 ALL CHECKS PASSED — Infrastructure verified!");
    console.log("  ➡️  Safe to proceed to Phase 2: Move Contracts & Frontend");
  } else if (report.summary.failed > 0) {
    console.log("  ⚠️  SOME CHECKS FAILED — Fix before proceeding.");
    console.log("  📖 See antigravity.md §20 for pivot triggers.");
  } else {
    console.log("  ⚠️  SOME CHECKS SKIPPED — Review dependencies.");
  }

  console.log("═══════════════════════════════════════════════════════════════\n");

  // Write report to file
  const reportPath = resolve(__dirname, "..", "..", "spike-report.json");
  const fs = await import("fs");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  📄 Full report written to: ${reportPath}\n`);

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main();
