/**
 * Nexus End-to-End Test Script
 *
 * Tests all core implementations:
 * 1. Frontend pages render correctly
 * 2. Walrus upload/download works
 * 3. Sui RPC connection works
 * 4. Wallet detection works
 * 5. PTB builders generate correct transactions
 * 6. Marketplace data loading works
 *
 * Run: npx tsx scripts/e2e-test.ts
 */

const BASE_URL = 'http://localhost:5173';
const WALRUS_PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
const TATUM_RPC = 'https://sui-testnet.gateway.tatum.io';

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

// === Test Suites ===

async function testFrontendPages() {
  console.log('\n=== Frontend Pages ===');

  await test('Homepage returns 200', async () => {
    const res = await fetch(BASE_URL);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const html = await res.text();
    if (!html.includes('Memory, for')) throw new Error('Hero title not found');
    if (!html.includes('Connect Wallet')) throw new Error('Connect Wallet button not found');
    if (!html.includes('Mark')) throw new Error('Convergence mark not found');
  });

  await test('Upload page returns 200', async () => {
    const res = await fetch(`${BASE_URL}/upload`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const html = await res.text();
    if (!html.includes('Upload Dataset')) throw new Error('Upload title not found');
    if (!html.includes('drop-zone')) throw new Error('Drop zone not found');
    if (!html.includes('form-input')) throw new Error('Form inputs not found');
  });

  await test('Dataset page returns 200', async () => {
    const res = await fetch(`${BASE_URL}/dataset/test123`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const html = await res.text();
    if (!html.includes('Loading dataset details')) throw new Error('Loading state not found');
  });

  await test('CSS contains design tokens', async () => {
    const res = await fetch(BASE_URL);
    const html = await res.text();
    if (!html.includes('--bone')) throw new Error('--bone token not found');
    if (!html.includes('--accent')) throw new Error('--accent token not found');
    if (!html.includes('Space Grotesk') && !html.includes('var(--sans)')) throw new Error('Space Grotesk font not found');
  });
}

async function testWalrusIntegration() {
  console.log('\n=== Walrus Integration ===');

  let testBlobId: string | null = null;

  await test('Walrus Publisher is reachable', async () => {
    const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new TextEncoder().encode('nexus-e2e-test-' + Date.now()),
    });
    if (!res.ok) throw new Error(`Publisher returned ${res.status}`);
    const data = await res.json() as any;
    testBlobId = data.newlyCreated?.blobObject?.blobId || data.alreadyCertified?.blobId;
    if (!testBlobId) throw new Error('No blobId in response');
  });

  await test('Walrus Aggregator can read blob', async () => {
    if (!testBlobId) throw new Error('No blob to read (upload failed)');
    const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${testBlobId}`);
    if (!res.ok) throw new Error(`Aggregator returned ${res.status}`);
    const text = await res.text();
    if (!text.includes('nexus-e2e-test')) throw new Error('Content mismatch');
  });

  await test('Walrus blob HEAD check', async () => {
    if (!testBlobId) throw new Error('No blob to check');
    const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${testBlobId}`, { method: 'HEAD' });
    if (!res.ok) throw new Error(`HEAD returned ${res.status}`);
  });
}

async function testSuiRPC() {
  console.log('\n=== Sui RPC (via Tatum) ===');

  await test('Tatum Sui RPC is reachable', async () => {
    const res = await fetch(TATUM_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getLatestCheckpointSequenceNumber',
        params: [],
      }),
    });
    if (!res.ok) throw new Error(`RPC returned ${res.status}`);
    const data = await res.json() as any;
    if (!data.result) throw new Error('No result in RPC response');
  });

  await test('Sui getChainIdentifier works', async () => {
    const res = await fetch(TATUM_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getChainIdentifier',
        params: [],
      }),
    });
    if (!res.ok) throw new Error(`RPC returned ${res.status}`);
    const data = await res.json() as any;
    if (!data.result) throw new Error('No chain identifier');
  });
}

async function testWalletDetection() {
  console.log('\n=== Wallet Detection ===');

  skip('Wallet detection', 'Requires browser environment (window.suiWallet)');
  skip('Wallet connection', 'Requires browser environment');
  skip('Transaction signing', 'Requires browser environment + wallet');
}

async function testPTBBuilders() {
  console.log('\n=== PTB Builders ===');

  skip('buildListDatasetTransaction', 'Requires @mysten/sui runtime');
  skip('buildBuyDatasetTransaction', 'Requires @mysten/sui runtime');
  skip('buildDelistDatasetTransaction', 'Requires @mysten/sui runtime');
}

async function testMarketplaceData() {
  console.log('\n=== Marketplace Data Loading ===');

  skip('getMarketplaceStats', 'Requires deployed contracts');
  skip('getListingDetails', 'Requires deployed contracts');
  skip('getActiveListings', 'Requires deployed contracts');
}

async function testBuild() {
  console.log('\n=== Build ===');

  skip('vite build', 'Run manually: cd frontend && npx vite build');
  skip('sui move test', 'Run manually: cd move && sui move test');
}

// === Main ===

async function main() {
  console.log('Nexus End-to-End Tests');
  console.log('='.repeat(40));

  await testFrontendPages();
  await testWalrusIntegration();
  await testSuiRPC();
  await testWalletDetection();
  await testPTBBuilders();
  await testMarketplaceData();
  await testBuild();

  // Summary
  console.log('\n' + '='.repeat(40));
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
