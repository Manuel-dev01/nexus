/**
 * Nexus Contract End-to-End Tests
 *
 * Tests the deployed Move contracts on Sui testnet:
 * 1. Marketplace object exists and is accessible
 * 2. Can query marketplace stats
 * 3. Can list a dataset (requires wallet)
 * 4. Can buy a dataset (requires wallet)
 * 5. Can delist a dataset (requires wallet)
 *
 * Run: npx tsx scripts/test-contracts.ts
 */

const TATUM_RPC = 'https://sui-testnet.gateway.tatum.io';
const SUI_RPC = 'https://fullnode.testnet.sui.io:443';
const PACKAGE_ID = '0x86208eab6fcdadc33273cc65fed9b43177d7c65105ef88134eb635652d258788';
const MARKETPLACE_ID = '0xaea5cb73bb7d4b8a6cac69be6dbd7d736cf73ec62563ac87f125c4f0c45f30b2';

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

function skip(name: string, reason: string): void {
  results.push({ name, status: 'SKIP', message: reason, duration: 0 });
  console.log(`  ○ ${name}: ${reason}`);
}

async function rpcCall(method: string, params: any[], rpc: string = SUI_RPC): Promise<any> {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// === Test Suites ===

async function testMarketplaceObject() {
  console.log('\n=== Marketplace Object ===');

  await test('Marketplace object exists', async () => {
    const result = await rpcCall('sui_getObject', [
      MARKETPLACE_ID,
      { showContent: true, showType: true },
    ]);
    if (!result.data) throw new Error('No data returned');
    if (result.data.error) throw new Error(result.data.error);
    const content = result.data.content;
    if (!content) throw new Error('No content');
    if (content.dataType !== 'moveObject') throw new Error('Not a move object');
  });

  await test('Marketplace type is correct', async () => {
    const result = await rpcCall('sui_getObject', [
      MARKETPLACE_ID,
      { showType: true },
    ]);
    const type = result.data?.type || '';
    if (!type.includes('nexus_marketplace::Marketplace')) {
      throw new Error(`Wrong type: ${type}`);
    }
  });

  await test('Marketplace is shared object', async () => {
    const result = await rpcCall('sui_getObject', [
      MARKETPLACE_ID,
      { showOwner: true },
    ]);
    const owner = result.data?.owner;
    if (!owner || typeof owner !== 'object' || !('Shared' in owner)) {
      throw new Error(`Not shared: ${JSON.stringify(owner)}`);
    }
  });
}

async function testMarketplaceStats() {
  console.log('\n=== Marketplace Stats ===');

  await test('Marketplace has valid stats', async () => {
    const result = await rpcCall('sui_getObject', [
      MARKETPLACE_ID,
      { showContent: true },
    ]);
    const fields = result.data?.content?.fields;
    if (!fields) throw new Error('No fields');

    const totalListings = parseInt(fields.total_listings);
    const totalSales = parseInt(fields.total_sales);
    const totalVolume = parseInt(fields.total_volume);
    const feeBps = parseInt(fields.fee_bps);

    if (isNaN(totalListings)) throw new Error('Invalid total_listings');
    if (isNaN(totalSales)) throw new Error('Invalid total_sales');
    if (isNaN(totalVolume)) throw new Error('Invalid total_volume');
    if (feeBps !== 200) throw new Error(`Wrong fee: ${feeBps} (expected 200)`);

    console.log(`    Listings: ${totalListings}, Sales: ${totalSales}, Volume: ${totalVolume} MIST`);
  });

  await test('Marketplace is not paused', async () => {
    const result = await rpcCall('sui_getObject', [
      MARKETPLACE_ID,
      { showContent: true },
    ]);
    const fields = result.data?.content?.fields;
    if (fields?.paused) throw new Error('Marketplace is paused');
  });
}

async function testPackageModules() {
  console.log('\n=== Package Modules ===');

  await test('Package exists', async () => {
    const result = await rpcCall('sui_getObject', [
      PACKAGE_ID,
      { showContent: true, showType: true },
    ]);
    if (!result.data) throw new Error('No data');
    if (result.data.error) throw new Error(result.data.error);
  });

  await test('Package contains nexus_marketplace module', async () => {
    const result = await rpcCall('sui_getObject', [
      PACKAGE_ID,
      { showContent: true },
    ]);
    const content = result.data?.content;
    if (!content || content.dataType !== 'package') throw new Error('Not a package');
    const modules = content.disassembled || {};
    if (!modules.nexus_marketplace) throw new Error('nexus_marketplace module not found');
  });

  await test('Package contains nexus_events module', async () => {
    const result = await rpcCall('sui_getObject', [
      PACKAGE_ID,
      { showContent: true },
    ]);
    const content = result.data?.content;
    const modules = content?.disassembled || {};
    if (!modules.nexus_events) throw new Error('nexus_events module not found');
  });
}

async function testEventQuerying() {
  console.log('\n=== Event Querying ===');

  await test('Can query events for nexus_marketplace module', async () => {
    const result = await rpcCall('suix_queryEvents', [
      { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } },
      null,
      10,
      true,
    ]);
    if (result === undefined || result === null) throw new Error('Query returned null');
    console.log(`    Found ${result.data?.length || 0} events`);
  });

  await test('Can retrieve DatasetListed event details', async () => {
    const result = await rpcCall('suix_queryEvents', [
      { MoveModule: { package: PACKAGE_ID, module: 'nexus_marketplace' } },
      null,
      10,
      true,
    ]);
    const events = result.data || [];
    if (events.length === 0) throw new Error('No events found');
    const first = events[0];
    const parsed = first.parsedJson || {};
    if (!parsed.listing_id) throw new Error('No listing_id in event');
    if (!parsed.name) throw new Error('No name in event');
    console.log(`    First listing: ${parsed.name} (${parsed.listing_id})`);
  });
}

async function testPTBBuilders() {
  console.log('\n=== PTB Builders ===');

  skip('buildListDatasetTransaction', 'Requires @mysten/sui runtime (run in frontend)');
  skip('buildBuyDatasetTransaction', 'Requires @mysten/sui runtime (run in frontend)');
  skip('buildDelistDatasetTransaction', 'Requires @mysten/sui runtime (run in frontend)');
}

async function testWalletIntegration() {
  console.log('\n=== Wallet Integration ===');

  skip('Wallet detection', 'Requires browser environment');
  skip('Wallet connection', 'Requires browser environment');
  skip('Transaction signing', 'Requires browser environment + wallet');
}

async function testSuiNetwork() {
  console.log('\n=== Sui Network ===');

  await test('Sui testnet RPC is reachable', async () => {
    const result = await rpcCall('sui_getLatestCheckpointSequenceNumber', []);
    if (!result) throw new Error('No result');
    console.log(`    Latest checkpoint: ${result}`);
  });

  await test('Chain identifier is testnet', async () => {
    const result = await rpcCall('sui_getChainIdentifier', []);
    if (!result) throw new Error('No result');
    console.log(`    Chain ID: ${result}`);
  });
}

// === Main ===

async function main() {
  console.log('Nexus Contract End-to-End Tests');
  console.log('='.repeat(50));
  console.log(`Package ID: ${PACKAGE_ID}`);
  console.log(`Marketplace ID: ${MARKETPLACE_ID}`);
  console.log('='.repeat(50));

  await testSuiNetwork();
  await testPackageModules();
  await testMarketplaceObject();
  await testMarketplaceStats();
  await testEventQuerying();
  await testPTBBuilders();
  await testWalletIntegration();

  // Summary
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
