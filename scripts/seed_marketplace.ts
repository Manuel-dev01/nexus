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

// === Data Generators ===
// These synthesize realistic dataset *files* — the bytes are genuinely stored on
// Walrus (real blob IDs, real RedStuff erasure coding) and shaped like the real
// thing (embedding tensors, image pixel arrays, instruction pairs, adapter
// weights). Content is representative rather than the original corpora.

function float32Buffer(rows: number, dim: number, scale = 0.1): Buffer {
  const buf = Buffer.alloc(rows * dim * 4);
  for (let i = 0; i < rows * dim; i++) {
    buf.writeFloatLE((Math.random() * 2 - 1) * scale, i * 4);
  }
  return buf;
}

function uint8Buffer(bytes: number): Buffer {
  const buf = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

function jsonlBuffer(records: unknown[]): Buffer {
  return Buffer.from(records.map((r) => JSON.stringify(r)).join("\n"));
}

function jsonBuffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value, null, 2));
}

function csvBuffer(header: string[], rows: (string | number)[][]): Buffer {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")].concat(rows.map((r) => r.map(cell).join(",")));
  return Buffer.from(lines.join("\n"));
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
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

  // ===================== Expanded catalog (all categories) =====================

  // ---- Language ----
  {
    name: "IMDB Movie Review Sentiment",
    description: "2,000 labeled movie reviews (positive/negative) for sentiment classification. CSV: text,label.",
    category: "language",
    price: 150_000_000, // 0.15 SUI
    generateData: () => {
      const subj = ["The film", "This movie", "The sequel", "The cast", "The screenplay", "The cinematography", "The soundtrack", "The plot"];
      const pos = ["was absolutely brilliant", "kept me hooked till the end", "is an instant classic", "exceeded every expectation", "was beautifully crafted"];
      const neg = ["was a complete letdown", "dragged on far too long", "felt lazy and uninspired", "wasted a great premise", "put me to sleep"];
      const rows: (string | number)[][] = [];
      for (let i = 0; i < 2000; i++) {
        const positive = Math.random() > 0.5;
        const text = `${pick(subj, i)} ${positive ? pick(pos, i) : pick(neg, i)}${positive ? ", I'd watch it again." : ", I want my time back."}`;
        rows.push([text, positive ? "positive" : "negative"]);
      }
      return csvBuffer(["text", "label"], rows);
    },
  },
  {
    name: "CoNLL-2003 Named Entity Recognition",
    description: "1,200 tokenized sentences with BIO named-entity tags (PER/ORG/LOC/MISC). JSONL.",
    category: "language",
    price: 200_000_000, // 0.2 SUI
    generateData: () => {
      const sents = [
        { tokens: ["Satya", "Nadella", "leads", "Microsoft", "in", "Seattle"], ner_tags: ["B-PER", "I-PER", "O", "B-ORG", "O", "B-LOC"] },
        { tokens: ["The", "United", "Nations", "met", "in", "Geneva"], ner_tags: ["O", "B-ORG", "I-ORG", "O", "O", "B-LOC"] },
        { tokens: ["Apple", "released", "the", "Vision", "Pro", "in", "California"], ner_tags: ["B-ORG", "O", "O", "B-MISC", "I-MISC", "O", "B-LOC"] },
      ];
      const recs: unknown[] = [];
      for (let i = 0; i < 1200; i++) recs.push(pick(sents, i));
      return jsonlBuffer(recs);
    },
  },
  {
    name: "WMT English-German Translation Pairs",
    description: "1,500 parallel EN->DE sentence pairs for machine translation. JSONL: {en, de}.",
    category: "language",
    price: 250_000_000, // 0.25 SUI
    generateData: () => {
      const pairs = [
        { en: "Good morning, how are you?", de: "Guten Morgen, wie geht es dir?" },
        { en: "The weather is nice today.", de: "Das Wetter ist heute schön." },
        { en: "Where is the train station?", de: "Wo ist der Bahnhof?" },
        { en: "I would like a cup of coffee.", de: "Ich hätte gerne eine Tasse Kaffee." },
      ];
      const recs: unknown[] = [];
      for (let i = 0; i < 1500; i++) recs.push(pick(pairs, i));
      return jsonlBuffer(recs);
    },
  },
  {
    name: "SQuAD v2 Question Answering",
    description: "900 reading-comprehension examples with context, question and answer spans. JSON.",
    category: "language",
    price: 300_000_000, // 0.3 SUI
    generateData: () => {
      const context = "Walrus is a decentralized storage network that uses RedStuff erasure coding to store large binary blobs across many nodes.";
      const qas = [
        { question: "What encoding does Walrus use?", answer: "RedStuff erasure coding" },
        { question: "What does Walrus store?", answer: "large binary blobs" },
      ];
      const items: unknown[] = [];
      for (let i = 0; i < 900; i++) {
        const qa = pick(qas, i);
        items.push({ id: `squad-${i}`, context, question: qa.question, answers: [qa.answer] });
      }
      return jsonBuffer({ version: "v2.0", data: items });
    },
  },

  // ---- Vision ----
  {
    name: "MNIST Handwritten Digits (4k subset)",
    description: "4,000 grayscale 28x28 digit images in raw uint8 layout, each followed by a label byte.",
    category: "vision",
    price: 200_000_000, // 0.2 SUI
    generateData: () => uint8Buffer(4000 * (28 * 28 + 1)),
  },
  {
    name: "CIFAR-10 Image Batch (1.2k subset)",
    description: "1,200 RGB 32x32 images in raw uint8 (CHW) with a class label byte each.",
    category: "vision",
    price: 350_000_000, // 0.35 SUI
    generateData: () => uint8Buffer(1200 * (3 * 32 * 32 + 1)),
  },
  {
    name: "COCO Object Detection Annotations",
    description: "1,000 bounding-box annotations (category, bbox, area) in COCO-style JSON.",
    category: "vision",
    price: 400_000_000, // 0.4 SUI
    generateData: () => {
      const cats = ["person", "car", "dog", "bicycle", "chair", "bottle"];
      const anns: unknown[] = [];
      for (let i = 0; i < 1000; i++) {
        const x = Math.floor(Math.random() * 500);
        const y = Math.floor(Math.random() * 400);
        const w = Math.floor(Math.random() * 120) + 20;
        const h = Math.floor(Math.random() * 120) + 20;
        anns.push({ id: i, image_id: Math.floor(i / 3), category: pick(cats, i), bbox: [x, y, w, h], area: w * h, iscrowd: 0 });
      }
      return jsonBuffer({ categories: cats, annotations: anns });
    },
  },
  {
    name: "CLIP ViT-B/32 Image Embeddings",
    description: "1,500 x 512-dim CLIP image embeddings (Float32, little-endian).",
    category: "vision",
    price: 500_000_000, // 0.5 SUI
    generateData: () => float32Buffer(1500, 512),
  },

  // ---- Embeddings ----
  {
    name: "Sentence-BERT MiniLM Embeddings",
    description: "2,500 x 384-dim sentence embeddings (all-MiniLM-L6-v2 shape, Float32).",
    category: "embeddings",
    price: 300_000_000, // 0.3 SUI
    generateData: () => float32Buffer(2500, 384),
  },
  {
    name: "OpenAI text-embedding-3-small Vectors",
    description: "800 x 1536-dim text embeddings (Float32, little-endian).",
    category: "embeddings",
    price: 450_000_000, // 0.45 SUI
    generateData: () => float32Buffer(800, 1536),
  },

  // ---- Fine-Tuning ----
  {
    name: "OpenAssistant ChatML Conversations",
    description: "1,000 multi-turn chat conversations in ChatML role/content format. JSONL.",
    category: "fine-tuning",
    price: 250_000_000, // 0.25 SUI
    generateData: () => {
      const convos = [
        [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Explain erasure coding." },
          { role: "assistant", content: "Erasure coding splits data into fragments with redundancy so the original can be rebuilt from a subset." },
        ],
        [
          { role: "system", content: "You are a coding assistant." },
          { role: "user", content: "Reverse a list in Python." },
          { role: "assistant", content: "Use lst[::-1] or lst.reverse()." },
        ],
      ];
      const recs: unknown[] = [];
      for (let i = 0; i < 1000; i++) recs.push({ messages: pick(convos, i) });
      return jsonlBuffer(recs);
    },
  },
  {
    name: "Glaive Function-Calling Examples",
    description: "800 tool-use examples pairing a user query with a structured function call. JSONL.",
    category: "fine-tuning",
    price: 300_000_000, // 0.3 SUI
    generateData: () => {
      const ex = [
        { query: "What's the weather in Paris?", function_call: { name: "get_weather", arguments: { city: "Paris" } } },
        { query: "Convert 100 USD to EUR", function_call: { name: "convert_currency", arguments: { amount: 100, from: "USD", to: "EUR" } } },
      ];
      const recs: unknown[] = [];
      for (let i = 0; i < 800; i++) recs.push(pick(ex, i));
      return jsonlBuffer(recs);
    },
  },
  {
    name: "CNN/DailyMail Summarization Pairs",
    description: "600 article->summary pairs for abstractive summarization. JSONL: {article, summary}.",
    category: "fine-tuning",
    price: 280_000_000, // 0.28 SUI
    generateData: () => {
      const recs: unknown[] = [];
      for (let i = 0; i < 600; i++) {
        recs.push({
          article: `Report ${i}: Researchers announced a new decentralized storage benchmark today, citing improved durability and lower cost across distributed nodes.`,
          summary: "New decentralized storage benchmark shows better durability and lower cost.",
        });
      }
      return jsonlBuffer(recs);
    },
  },

  // ---- Model Weights ----
  {
    name: "LoRA Adapter (Mistral-7B Instruct)",
    description: "Rank-16 LoRA adapters for four attention projections (Float32 A/B matrices).",
    category: "model-weights",
    price: 800_000_000, // 0.8 SUI
    generateData: () => float32Buffer(4 * 16 * 2, 2048, 0.01),
  },
  {
    name: "TinyLlama Q4_K_M Quantized Weights",
    description: "~3 MB of quantized transformer weights in raw byte layout (GGUF-style block quantization).",
    category: "model-weights",
    price: 600_000_000, // 0.6 SUI
    generateData: () => uint8Buffer(3 * 1024 * 1024),
  },
  {
    name: "DPO Reward Model Head (Llama-3)",
    description: "Reward-model scoring head weights from DPO training (Float32).",
    category: "model-weights",
    price: 700_000_000, // 0.7 SUI
    generateData: () => float32Buffer(2048, 256, 0.02),
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

// === Idempotency ===

/**
 * Fetch the names of datasets already listed on-chain (via DatasetListed events)
 * so the seeder can skip duplicates. Makes the script safe to re-run and to
 * extend with new datasets without re-listing the existing ones.
 */
async function getExistingListingNames(): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    const res = await fetch(SUI_FULLNODE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveModule: { package: PACKAGE_ID, module: "nexus_marketplace" } },
          null,
          1000,
          true,
        ],
      }),
    });
    const json = (await res.json()) as any;
    for (const ev of json.result?.data || []) {
      if (ev.type?.includes("DatasetListed") && ev.parsedJson?.name) {
        names.add(ev.parsedJson.name);
      }
    }
  } catch (err) {
    console.warn("   ⚠️  Could not fetch existing listings (will not skip duplicates):", err);
  }
  return names;
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
      tx.pure.option("u64", 5), // storage_epochs (matches the Walrus upload)
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

  // Idempotency: skip any dataset whose name is already listed on-chain, so this
  // script can be re-run / extended without creating duplicate listings.
  const existingNames = await getExistingListingNames();
  console.log(`  ${existingNames.size} dataset(s) already on-chain — those will be skipped.\n`);

  // Seed each dataset
  const results: Array<{
    name: string;
    blobId: string;
    txDigest: string;
    cost: number;
  }> = [];
  let skipped = 0;

  for (let i = 0; i < DATASETS.length; i++) {
    const dataset = DATASETS[i];

    if (existingNames.has(dataset.name)) {
      console.log(`\n⏭️  ${i + 1}/${DATASETS.length} Skipping (already listed): ${dataset.name}`);
      skipped++;
      continue;
    }

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

  console.log(`  Added ${results.length} new listing(s), skipped ${skipped} existing.`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🎉 Marketplace seeded successfully!");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
