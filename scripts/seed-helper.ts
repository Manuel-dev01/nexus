/**
 * seed-helper.ts — Helper to list a single dataset via Sui CLI
 * Usage: npx tsx seed-helper.ts <name> <desc> <category> <blobId> <size> <price>
 */

import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

const PACKAGE_ID = process.env.NEXUS_PACKAGE_ID || "";
const MARKETPLACE_ID = process.env.NEXUS_MARKETPLACE_ID || "";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 6) {
    console.error("Usage: npx tsx seed-helper.ts <name> <desc> <category> <blobId> <size> <price>");
    process.exit(1);
  }

  const [name, desc, category, blobId, size, price] = args;

  console.log(`Listing dataset: ${name}`);
  console.log(`  Category: ${category}`);
  console.log(`  Blob ID: ${blobId}`);
  console.log(`  Size: ${size}`);
  console.log(`  Price: ${price}`);

  // Use sui client call with JSON args
  const argsJson = JSON.stringify([
    MARKETPLACE_ID,
    name,
    desc,
    category,
    blobId,
    size,
    price,
    null,  // content_hash (Option<String>)
    null,  // storage_epochs (Option<u64>)
    "0x6"  // clock
  ]);

  const cmd = `sui client call --package ${PACKAGE_ID} --module nexus_marketplace --function list_dataset --args-json '${argsJson}' --gas-budget 100000000 --json`;

  try {
    console.log(`\nExecuting transaction...`);
    const output = execSync(cmd, { encoding: "utf-8", timeout: 120000 });
    const result = JSON.parse(output);

    if (result.digest) {
      console.log(`\n✅ Success!`);
      console.log(`  Transaction: ${result.digest}`);
      console.log(`  Explorer: https://suiscan.xyz/testnet/tx/${result.digest}`);
    } else {
      console.log(`\nResult: ${output}`);
    }
  } catch (err: any) {
    console.error(`\n❌ Failed: ${err.message}`);
    if (err.stderr) console.error(err.stderr);
    process.exit(1);
  }
}

main();
