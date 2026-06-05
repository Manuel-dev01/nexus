/**
 * seed_marketplace.ts — Deterministic Demo Seeder
 *
 * Pre-loads 3 AI datasets onto Walrus and registers them on Sui
 * so the marketplace UI is immediately populated during the demo video.
 *
 * Datasets:
 * 1. GPT-2 Embedding Vectors (768-dim, 10K vectors) — 0.5 SUI
 * 2. Fine-Tuning Dataset (100 prompt/completion pairs) — 0.25 SUI
 * 3. LoRA Adapter Weights (4-bit quantized) — 1.0 SUI
 *
 * Run: cd scripts && npm run seed
 * Requires: .env with TATUM_API_KEY and deployer wallet key
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from "@mysten/sui/jsonRpc";

// Load .env from repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

// === Configuration ===

const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const TATUM_SUI_RPC = "https://sui-testnet.gateway.tatum.io";
const TATUM_API_KEY = process.env.TATUM_API_KEY || "";
const PACKAGE_ID = process.env.NEXUS_PACKAGE_ID || "";
const MARKETPLACE_ID = process.env.NEXUS_MARKETPLACE_ID || "";
const DEPLOYER_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY || "";

// === Dataset Definitions ===

interface DatasetConfig {
  name: string;
  description: string;
  category: string;
  price: number; // in MIST
  generateData: () => Buffer;
}

const DATASETS: DatasetConfig[] = [
  {
    name: "GPT-2 Embedding Vectors",
    description: "768-dim embedding vectors for 10K words. Float32Array binary format.",
    category: "embeddings",
    price: 500_000_000, // 0.5 SUI
    generateData: () => {
      // Generate 100 x 768-dimensional Float32 vectors (smaller for demo)
      const numVectors = 100;
      const dimensions = 768;
      const buffer = Buffer.alloc(numVectors * dimensions * 4); // 4 bytes per float

      for (let i = 0; i < numVectors; i++) {
        for (let j = 0; j < dimensions; j++) {
          // Simulate realistic embedding values (normalized, centered around 0)
          const value = (Math.random() * 2 - 1) * 0.1;
          buffer.writeFloatLE(value, (i * dimensions + j) * 4);
        }
      }

      return buffer;
    },
  },
  {
    name: "Fine-Tuning Dataset (Alpaca Format)",
    description: "100 prompt/completion pairs for coding tasks. JSONL format.",
    category: "fine-tuning",
    price: 250_000_000, // 0.25 SUI
    generateData: () => {
      const examples = [
        {
          instruction: "Write a Python function to calculate fibonacci numbers",
          input: "",
          output:
            'def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)',
        },
        {
          instruction: "Create a TypeScript type for API responses",
          input: "The response should have status, data, and error fields",
          output:
            'type ApiResponse<T> = {\n  status: number;\n  data: T | null;\n  error: string | null;\n};',
        },
        {
          instruction: "Write a Rust function to reverse a string",
          input: "",
          output: 'fn reverse_string(s: &str) -> String {\n    s.chars().rev().collect()\n}',
        },
        {
          instruction: "Implement binary search in Python",
          input: "Search for target in sorted array",
          output:
            "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
        },
        {
          instruction: "Create a React hook for localStorage",
          input: "",
          output:
            "function useLocalStorage(key, initialValue) {\n  const [storedValue, setStoredValue] = useState(() => {\n    try {\n      const item = window.localStorage.getItem(key);\n      return item ? JSON.parse(item) : initialValue;\n    } catch (error) {\n      return initialValue;\n    }\n  });\n\n  const setValue = (value) => {\n    setStoredValue(value);\n    window.localStorage.setItem(key, JSON.stringify(value));\n  };\n\n  return [storedValue, setValue];\n}",
        },
      ];

      // Repeat examples to create 100 entries
      const expandedExamples = [];
      for (let i = 0; i < 20; i++) {
        for (const ex of examples) {
          expandedExamples.push({
            ...ex,
            instruction: `[${i * 5 + expandedExamples.length % 5 + 1}] ${ex.instruction}`,
          });
        }
      }

      return Buffer.from(expandedExamples.map((e) => JSON.stringify(e)).join("\n"));
    },
  },
  {
    name: "LoRA Adapter Weights (Llama-3 8B)",
    description: "LoRA adapters for code generation. Rank-16, SafeTensors format.",
    category: "model-weights",
    price: 1_000_000_000, // 1.0 SUI
    generateData: () => {
      // Simulate LoRA weights (rank-16 adapters for 2 layers)
      // Smaller for demo: rank=4, features=256
      const rank = 4;
      const features = 256;
      const numLayers = 2; // q_proj and v_proj

      // A matrix: [rank, features]
      // B matrix: [features, rank]
      const totalSize = (rank * features + features * rank) * 4 * numLayers;

      const buffer = Buffer.alloc(totalSize);
      let offset = 0;

      for (let layer = 0; layer < numLayers; layer++) {
        // A matrix (small random values)
        for (let i = 0; i < rank * features; i++) {
          const value = (Math.random() * 2 - 1) * 0.01;
          buffer.writeFloatLE(value, offset);
          offset += 4;
        }

        // B matrix (zeros, as is typical for LoRA initialization)
        for (let i = 0; i < features * rank; i++) {
          buffer.writeFloatLE(0, offset);
          offset += 4;
        }
      }

      return buffer;
    },
  },
];

// === Utility Functions ===

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function formatMist(mist: number): string {
  return `${(mist / 1_000_000_000).toFixed(4)} SUI`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// === Walrus Upload ===

async function uploadToWalrus(
  data: Buffer,
  epochs: number = 5
): Promise<{ blobId: string; cost: number }> {
  console.log(`   Uploading ${formatBytes(data.length)} to Walrus...`);

  const response = await fetch(
    `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      // Buffer is a Uint8Array subclass; pass a plain view so it satisfies BodyInit.
      body: new Uint8Array(data),
    }
  );

  if (!response.ok) {
    throw new Error(`Walrus upload failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as any;

  if (json.newlyCreated) {
    return {
      blobId: json.newlyCreated.blobObject.blobId,
      cost: json.newlyCreated.cost,
    };
  } else if (json.alreadyCertified) {
    return {
      blobId: json.alreadyCertified.blobId,
      cost: 0,
    };
  } else {
    throw new Error(`Unexpected Walrus response: ${JSON.stringify(json)}`);
  }
}

// === Sui Client ===

// NOTE: Building/signing a transaction with the SDK calls
// `suix_getLatestSuiSystemState` (for the reference gas price), which the Tatum
// gateway does not expose. So this one-time admin/seed tool signs via the public
// fullnode. The live *read* paths (frontend + MCP server) still route through
// Tatum, and the frontend's interactive signing goes through the user's wallet.
const SUI_FULLNODE_RPC = "https://fullnode.testnet.sui.io:443";

function createSuiClient(): SuiJsonRpcClient {
  const transport = new JsonRpcHTTPTransport({ url: SUI_FULLNODE_RPC });
  return new SuiJsonRpcClient({ transport, network: "testnet" });
}

// === Sui Transaction ===

/**
 * List a dataset by building a programmatic PTB and signing it with the
 * deployer keypair, executed through the Tatum gateway. This replaces the old
 * shell-out to `sui client ptb`, which could not encode the Option<String> /
 * Option<u64> parameters and required an interactively-configured CLI.
 */
async function listDatasetOnSui(
  client: SuiJsonRpcClient,
  keypair: Ed25519Keypair,
  dataset: DatasetConfig,
  walrusBlobId: string,
  sizeBytes: number,
  contentHash: string
): Promise<string> {
  console.log(`   Listing on Sui marketplace...`);

  const tx = new Transaction();
  // Seed datasets are SUI-priced and unencrypted (empty seal_policy_id).
  tx.moveCall({
    target: `${PACKAGE_ID}::nexus_marketplace::list_dataset`,
    typeArguments: ["0x2::sui::SUI"],
    arguments: [
      tx.object(MARKETPLACE_ID),
      tx.pure.string(dataset.name),
      tx.pure.string(dataset.description),
      tx.pure.string(dataset.category),
      tx.pure.string(walrusBlobId),
      tx.pure.u64(sizeBytes),
      tx.pure.u64(dataset.price),
      tx.pure.option("string", contentHash),
      tx.pure.option("u64", null),
      tx.pure.vector("u8", []), // seal_policy_id ([] = not encrypted)
      tx.object("0x6"), // Sui system Clock
    ],
  });
  tx.setGasBudget(100_000_000);

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Transaction failed: ${JSON.stringify(result.effects?.status)}`
    );
  }

  return result.digest;
}

// === Main Seeder ===

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🌱 Nexus Marketplace Seeder");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Validate environment
  if (!TATUM_API_KEY) {
    console.error("❌ TATUM_API_KEY not found in .env");
    process.exit(1);
  }

  if (!PACKAGE_ID) {
    console.error("❌ NEXUS_PACKAGE_ID not found in .env");
    console.error("   Deploy contracts first: cd move && sui client publish");
    process.exit(1);
  }

  if (!MARKETPLACE_ID) {
    console.error("❌ NEXUS_MARKETPLACE_ID not found in .env");
    console.error("   Deploy contracts first and update .env");
    process.exit(1);
  }

  if (!DEPLOYER_PRIVATE_KEY) {
    console.error("❌ DEPLOYER_PRIVATE_KEY not found in .env");
    console.error("   Add your wallet private key to .env");
    process.exit(1);
  }

  // Initialize keypair from private key (bech32 format) and Tatum-backed client
  const keypair = Ed25519Keypair.fromSecretKey(DEPLOYER_PRIVATE_KEY);
  const deployerAddress = keypair.toSuiAddress();
  const client = createSuiClient();

  console.log(`  Deployer: ${deployerAddress}`);
  console.log(`  Package: ${PACKAGE_ID}`);
  console.log(`  Marketplace: ${MARKETPLACE_ID}\n`);

  // Seed each dataset
  const results: Array<{
    name: string;
    blobId: string;
    txDigest: string;
    cost: number;
  }> = [];

  for (let i = 0; i < DATASETS.length; i++) {
    const dataset = DATASETS[i];
    console.log(`\n📦 Dataset ${i + 1}/${DATASETS.length}: ${dataset.name}`);
    console.log(`   Category: ${dataset.category}`);
    console.log(`   Price: ${formatMist(dataset.price)}`);

    // Generate data
    const data = dataset.generateData();
    const hash = sha256(data);
    console.log(`   Size: ${formatBytes(data.length)}`);
    console.log(`   SHA256: ${hash.substring(0, 16)}...`);

    // Upload to Walrus
    const { blobId, cost } = await uploadToWalrus(data);
    console.log(`   ✅ Uploaded to Walrus`);
    console.log(`   blobId: ${blobId}`);
    console.log(`   Cost: ${formatMist(cost)}`);

    // List on Sui
    const txDigest = await listDatasetOnSui(
      client,
      keypair,
      dataset,
      blobId,
      data.length,
      hash
    );
    console.log(`   ✅ Listed on Sui`);
    console.log(`   Tx: ${txDigest}`);

    results.push({ name: dataset.name, blobId, txDigest, cost });
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  📊 SEED RESULTS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const result of results) {
    console.log(`  ✅ ${result.name}`);
    console.log(`     blobId: ${result.blobId}`);
    console.log(`     Tx: ${result.txDigest}`);
    console.log("");
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🎉 Marketplace seeded successfully!");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
