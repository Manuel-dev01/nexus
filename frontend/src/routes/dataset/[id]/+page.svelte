<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { getSuiClient, formatSui, PACKAGE_ID } from '$lib/sui/config';
  import { downloadFromWalrus, verifyBlob, formatFileSize } from '$lib/walrus/client';

  interface Dataset {
    id: string;
    name: string;
    description: string;
    category: string;
    walrusBlobId: string;
    sizeBytes: number;
    price: number;
    provider: string;
    active: boolean;
    listedAt: number;
    purchaseCount: number;
    contentHash: string | null;
    storageEpochs: number | null;
  }

  let dataset: Dataset | null = null;
  let loading = true;
  let error: string | null = null;
  let purchasing = false;
  let downloading = false;
  let verifying = false;
  let verificationResult: { verified: boolean; sha256: string } | null = null;

  let listingId = $derived($page.params.id);

  onMount(async () => {
    await loadDataset();
  });

  async function loadDataset() {
    loading = true;
    error = null;

    try {
      const client = getSuiClient();

      const result = await client.getObject({
        id: listingId,
        options: {
          showContent: true,
          showOwner: true,
        },
      });

      if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
        throw new Error('Dataset not found');
      }

      const fields = result.data.content.fields as any;

      dataset = {
        id: listingId,
        name: fields.name,
        description: fields.description,
        category: fields.category,
        walrusBlobId: fields.walrus_blob_id,
        sizeBytes: parseInt(fields.size_bytes),
        price: parseInt(fields.price),
        provider: fields.provider,
        active: fields.active,
        listedAt: parseInt(fields.listed_at),
        purchaseCount: parseInt(fields.purchase_count),
        contentHash: fields.content_hash,
        storageEpochs: fields.storage_epochs ? parseInt(fields.storage_epochs) : null,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load dataset';
      console.error('Error loading dataset:', err);
    } finally {
      loading = false;
    }
  }

  async function handlePurchase() {
    if (!dataset) return;

    purchasing = true;
    error = null;

    try {
      // In production, this would use dapp-kit to sign the transaction
      // const tx = buildBuyDatasetTransaction({
      //   marketplaceId: MARKETPLACE_ID,
      //   listingId: dataset.id,
      //   paymentCoinId: selectedCoinId,
      //   paymentAmount: dataset.price,
      //   clockId: '0x6',
      // });

      alert('Purchase functionality requires wallet connection. Will be enabled after deployment.');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Purchase failed';
    } finally {
      purchasing = false;
    }
  }

  async function handleDownload() {
    if (!dataset) return;

    downloading = true;
    error = null;

    try {
      const result = await downloadFromWalrus(dataset.walrusBlobId, dataset.contentHash || undefined);

      // Create download link
      const blob = new Blob([result.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dataset.name.replace(/\s+/g, '_').toLowerCase();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      verificationResult = {
        verified: result.verified,
        sha256: result.sha256,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Download failed';
    } finally {
      downloading = false;
    }
  }

  async function handleVerify() {
    if (!dataset?.contentHash) return;

    verifying = true;
    verificationResult = null;

    try {
      const verified = await verifyBlob(dataset.walrusBlobId, dataset.contentHash);
      verificationResult = {
        verified,
        sha256: dataset.contentHash,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Verification failed';
    } finally {
      verifying = false;
    }
  }

  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getCategoryColor(category: string): string {
    switch (category) {
      case 'embeddings': return 'bg-blue-100 text-blue-800';
      case 'fine-tuning': return 'bg-green-100 text-green-800';
      case 'model-weights': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<svelte:head>
  <title>{dataset?.name || 'Dataset'} — Nexus</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <!-- Back Link -->
    <a href="/" class="text-blue-400 hover:text-blue-300 mb-8 inline-block">
      ← Back to Marketplace
    </a>

    {#if loading}
      <!-- Loading State -->
      <div class="text-center py-20">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p class="text-gray-400">Loading dataset details...</p>
      </div>

    {:else if error && !dataset}
      <!-- Error State -->
      <div class="text-center py-20">
        <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md mx-auto">
          <p class="text-red-400 mb-4">{error}</p>
          <a href="/" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Back to Marketplace
          </a>
        </div>
      </div>

    {:else if dataset}
      <!-- Dataset Details -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Header -->
          <div class="bg-white/5 border border-white/10 rounded-xl p-8">
            <div class="flex items-start justify-between mb-4">
              <span class="px-3 py-1 text-sm font-medium rounded-full {getCategoryColor(dataset.category)}">
                {dataset.category}
              </span>
              <span class="text-gray-500 text-sm">
                {dataset.purchaseCount} {dataset.purchaseCount === 1 ? 'purchase' : 'purchases'}
              </span>
            </div>

            <h1 class="text-3xl font-bold text-white mb-4">{dataset.name}</h1>
            <p class="text-gray-300 leading-relaxed">{dataset.description}</p>
          </div>

          <!-- Technical Details -->
          <div class="bg-white/5 border border-white/10 rounded-xl p-8">
            <h2 class="text-xl font-semibold text-white mb-6">Technical Details</h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div class="text-gray-500 text-sm mb-1">Size</div>
                <div class="text-white font-medium">{formatFileSize(dataset.sizeBytes)}</div>
              </div>

              <div>
                <div class="text-gray-500 text-sm mb-1">Listed</div>
                <div class="text-white font-medium">{formatDate(dataset.listedAt)}</div>
              </div>

              <div>
                <div class="text-gray-500 text-sm mb-1">Provider</div>
                <div class="text-white font-medium font-mono">{truncateAddress(dataset.provider)}</div>
              </div>

              <div>
                <div class="text-gray-500 text-sm mb-1">Storage Epochs</div>
                <div class="text-white font-medium">{dataset.storageEpochs || 'N/A'}</div>
              </div>

              <div class="sm:col-span-2">
                <div class="text-gray-500 text-sm mb-1">Walrus Blob ID</div>
                <div class="text-white font-mono text-sm break-all bg-white/5 rounded-lg p-3">
                  {dataset.walrusBlobId}
                </div>
              </div>

              {#if dataset.contentHash}
                <div class="sm:col-span-2">
                  <div class="text-gray-500 text-sm mb-1">Content Hash (SHA256)</div>
                  <div class="text-white font-mono text-sm break-all bg-white/5 rounded-lg p-3">
                    {dataset.contentHash}
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Verification Section -->
          {#if dataset.contentHash}
            <div class="bg-white/5 border border-white/10 rounded-xl p-8">
              <h2 class="text-xl font-semibold text-white mb-4">Integrity Verification</h2>
              <p class="text-gray-400 mb-4">
                Verify that the downloaded content matches the original hash.
              </p>

              <button
                onclick={handleVerify}
                disabled={verifying}
                class="px-6 py-2 bg-white/10 hover:bg-white/20 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {verifying ? 'Verifying...' : 'Verify Integrity'}
              </button>

              {#if verificationResult}
                <div class="mt-4 p-4 rounded-lg {verificationResult.verified ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}">
                  <div class="flex items-center gap-2">
                    {#if verificationResult.verified}
                      <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="text-green-400 font-medium">Verified</span>
                    {:else}
                      <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="text-red-400 font-medium">Mismatch</span>
                    {/if}
                  </div>
                  <p class="text-gray-400 text-sm mt-2 font-mono">
                    SHA256: {verificationResult.sha256}
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Purchase Card -->
          <div class="bg-white/5 border border-white/10 rounded-xl p-6 sticky top-6">
            <div class="text-center mb-6">
              <div class="text-4xl font-bold text-white mb-2">
                {formatSui(dataset.price)}
              </div>
              <div class="text-gray-500">
                {dataset.active ? 'Available' : 'Sold'}
              </div>
            </div>

            {#if dataset.active}
              <button
                onclick={handlePurchase}
                disabled={purchasing}
                class="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors mb-4"
              >
                {purchasing ? 'Processing...' : 'Purchase Dataset'}
              </button>

              <button
                onclick={handleDownload}
                disabled={downloading}
                class="w-full py-4 bg-white/10 hover:bg-white/20 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {downloading ? 'Downloading...' : 'Download from Walrus'}
              </button>
            {:else}
              <button
                onclick={handleDownload}
                disabled={downloading}
                class="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {downloading ? 'Downloading...' : 'Download Dataset'}
              </button>
            {/if}

            <!-- Error Message -->
            {#if error}
              <div class="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p class="text-red-400 text-sm">{error}</p>
              </div>
            {/if}

            <!-- Info -->
            <div class="mt-6 space-y-3 text-sm">
              <div class="flex justify-between text-gray-500">
                <span>Platform Fee</span>
                <span>2%</span>
              </div>
              <div class="flex justify-between text-gray-500">
                <span>Provider Receives</span>
                <span>{formatSui(Math.floor(dataset.price * 0.98))}</span>
              </div>
              <div class="flex justify-between text-gray-500">
                <span>Storage</span>
                <span>Walrus Testnet</span>
              </div>
            </div>
          </div>

          <!-- Actions Card -->
          <div class="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 class="text-white font-medium mb-4">Actions</h3>
            <div class="space-y-3">
              <a
                href="https://aggregator.walrus-testnet.walrus.space/v1/blobs/{dataset.walrusBlobId}"
                target="_blank"
                rel="noopener noreferrer"
                class="block text-blue-400 hover:text-blue-300 text-sm"
              >
                View on Walrus Aggregator →
              </a>
              <a
                href="https://suiexplorer.com/object/{dataset.id}?network=testnet"
                target="_blank"
                rel="noopener noreferrer"
                class="block text-blue-400 hover:text-blue-300 text-sm"
              >
                View on Sui Explorer →
              </a>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
