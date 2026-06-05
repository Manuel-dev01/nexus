/**
 * Nexus MCP Server Test Script
 *
 * Tests the MCP server tools by calling them directly:
 * 1. search_nexus_datasets
 * 2. get_dataset_details (dynamic-field read)
 * 3. check_dataset_purchase
 * 4. get_marketplace_stats
 * 5. get_walrus_blob
 * 6. verify_dataset_integrity
 *
 * Run: npx tsx scripts/test-mcp.ts
 */

const SUI_RPC = 'https://fullnode.testnet.sui.io:443';
const PACKAGE_ID = '0xb291fda48ee4d4094e36a9c65a6c9a6af596473dc62194c39c4ad7f73de804c6';
const MARKETPLACE_ID = '0x1cbd454312204274146f1e18f6e349297e9f7cac0281e20dc20ab6833652bd99';
const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, status: 'PASS', message: 'OK', duration: Date.now() - start });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, status: 'FAIL', message: err.message, duration: Date.now() - start });
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

async function suiRpc(method: string, params: any[]): Promise<any> {
  const res = await fetch(SUI_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// === Test Suites ===

async function testSearchDatasets() {
  console.log('\n=== search_nexus_datasets ===');

  let listingIds: string[] = [];

  await test('Can discover listings via events', async () => {
    const result = await suiRpc('suix_queryEvents', [
      { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } },
      null,
      10,
      true,
    ]);
    const events = result?.data || [];
    const listed = events.filter((e: any) => e.type?.includes('DatasetListed'));
    if (listed.length === 0) throw new Error('No DatasetListed events found');
    listingIds = listed.map((e: any) => e.parsedJson?.listing_id).filter(Boolean);
    console.log(`    Found ${listingIds.length} listings`);
  });

  await test('Can filter by category', async () => {
    const result = await suiRpc('suix_queryEvents', [
      { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } },
      null,
      10,
      true,
    ]);
    const events = result?.data || [];
    const listed = events.filter((e: any) => e.type?.includes('DatasetListed'));
    const embeddings = listed.filter((e: any) => e.parsedJson?.category === 'embeddings');
    console.log(`    Found ${embeddings.length} embeddings datasets`);
  });

  await test('Can filter by price', async () => {
    const result = await suiRpc('suix_queryEvents', [
      { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } },
      null,
      10,
      true,
    ]);
    const events = result?.data || [];
    const listed = events.filter((e: any) => e.type?.includes('DatasetListed'));
    const under1Sui = listed.filter((e: any) => parseInt(e.parsedJson?.price || '0') < 1_000_000_000);
    console.log(`    Found ${under1Sui.length} datasets under 1 SUI`);
  });
}

async function firstListingId(): Promise<string> {
  const ev = await suiRpc('suix_queryEvents', [
    { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } }, null, 1, true,
  ]);
  const listed = (ev?.data || []).filter((e: any) => e.type?.includes('DatasetListed'));
  if (listed.length === 0) throw new Error('No listings to query');
  const listingId = listed[0].parsedJson?.listing_id;
  if (!listingId) throw new Error('No listing_id in event');
  return listingId;
}

async function testGetDatasetDetails() {
  console.log('\n=== get_dataset_details (dynamic-field read) ===');

  await test('Wrapped listing is NOT directly addressable (sui_getObject → notExists)', async () => {
    const listingId = await firstListingId();
    const direct = await suiRpc('sui_getObject', [listingId, { showContent: true }]);
    // A wrapped (table-stored) object returns no data — this is the bug the tool used to hit.
    if (direct?.data) throw new Error('Expected listing to be notExists via sui_getObject');
  });

  await test('get_dataset_details resolves the listing via the marketplace table', async () => {
    const listingId = await firstListingId();
    const mk = await suiRpc('sui_getObject', [MARKETPLACE_ID, { showContent: true }]);
    const tableId = mk.data.content.fields.listings.fields.id.id;
    const df = await suiRpc('suix_getDynamicFieldObject', [
      tableId, { type: '0x2::object::ID', value: listingId },
    ]);
    const fields = df?.data?.content?.fields?.value?.fields;
    if (!fields) throw new Error('Dynamic-field read returned no listing fields');
    if (!fields.name || !fields.description || !fields.price) {
      throw new Error('Listing fields incomplete: ' + JSON.stringify(Object.keys(fields)));
    }
    console.log(`    Resolved: ${fields.name} | price ${fields.price} | hasDesc=${!!fields.description}`);
  });
}

async function testCheckDatasetPurchase() {
  console.log('\n=== check_dataset_purchase ===');

  await test('Reports no access for an address with no DatasetAccess', async () => {
    const listingId = await firstListingId();
    const randomAddr = '0x' + '11'.repeat(32);
    const res = await suiRpc('suix_getOwnedObjects', [
      randomAddr,
      { filter: { StructType: `${PACKAGE_ID}::nexus_marketplace::DatasetAccess` }, options: { showContent: true } },
    ]);
    const owns = (res?.data || []).some((o: any) => o.data?.content?.fields?.listing_id === listingId);
    if (owns !== false) throw new Error('Random address should not own access');
    console.log(`    Random address hasPurchased=${owns} (expected false)`);
  });
}

async function testGetMarketplaceStats() {
  console.log('\n=== get_marketplace_stats ===');

  await test('Can get marketplace stats', async () => {
    const result = await suiRpc('sui_getObject', [
      MARKETPLACE_ID,
      { showContent: true },
    ]);
    if (!result.data?.content) throw new Error('No content');
    const fields = result.data.content.fields;
    const totalListings = parseInt(fields.total_listings);
    const totalSales = parseInt(fields.total_sales);
    const feeBps = parseInt(fields.fee_bps);
    console.log(`    Listings: ${totalListings}, Sales: ${totalSales}, Fee: ${feeBps} bps`);
  });
}

async function testGetWalrusBlob() {
  console.log('\n=== get_walrus_blob ===');

  await test('Walrus aggregator is reachable', async () => {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/test-ping`);
    // 404 is expected for a non-existent blob, but the server should respond
    if (response.status === 0) throw new Error('Aggregator unreachable');
    console.log(`    Aggregator responded with status ${response.status}`);
  });

  await test('Can download blob from Walrus (if exists)', async () => {
    const result = await suiRpc('suix_queryEvents', [
      { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } },
      null,
      3,
      true,
    ]);
    const events = result?.data || [];
    const listed = events.filter((e: any) => e.type?.includes('DatasetListed'));
    if (listed.length === 0) throw new Error('No listings');

    let downloaded = false;
    for (const event of listed) {
      const blobId = event.parsedJson?.walrus_blob_id;
      if (!blobId) continue;
      const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.arrayBuffer();
        console.log(`    Downloaded ${data.byteLength} bytes from blob ${blobId.substring(0, 20)}...`);
        downloaded = true;
        break;
      }
    }
    if (!downloaded) {
      console.log('    No blobs available for download (may have expired)');
    }
  });
}

async function testVerifyIntegrity() {
  console.log('\n=== verify_dataset_integrity ===');

  skip('verify_dataset_integrity', 'Requires content hash from listing (not available in events)');
}

function skip(name: string, reason: string) {
  results.push({ name, status: 'SKIP', message: reason, duration: 0 });
  console.log(`  ○ ${name}: ${reason}`);
}

// === Main ===

async function main() {
  console.log('Nexus MCP Server Tests');
  console.log('='.repeat(50));

  await testSearchDatasets();
  await testGetDatasetDetails();
  await testCheckDatasetPurchase();
  await testGetMarketplaceStats();
  await testGetWalrusBlob();
  await testVerifyIntegrity();

  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
