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

  let dataset: Dataset | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let purchasing = $state(false);
  let downloading = $state(false);
  let verifying = $state(false);
  let verificationResult: { verified: boolean; sha256: string } | null = $state(null);

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
      const blob = new Blob([result.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dataset.name.replace(/\s+/g, '_').toLowerCase();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      verificationResult = { verified: result.verified, sha256: result.sha256 };
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
      verificationResult = { verified, sha256: dataset.contentHash };
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
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function getCategoryBadge(category: string): string {
    switch (category) {
      case 'embeddings': return 'badge-embeddings';
      case 'fine-tuning': return 'badge-fine-tuning';
      case 'model-weights': return 'badge-model-weights';
      default: return 'badge-embeddings';
    }
  }
</script>

<svelte:head>
  <title>{dataset?.name || 'Dataset'} — Nexus</title>
</svelte:head>

<div class="gradient-bg min-h-screen overflow-x-hidden">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
    <!-- Back Link -->
    <a href="/" class="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors mb-8">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Marketplace
    </a>

    {#if loading}
      <div class="text-center py-32">
        <div class="inline-block w-12 h-12 border-2 border-nexus-500/30 border-t-nexus-500 rounded-full animate-spin mb-4"></div>
        <p class="text-slate-500">Loading dataset details...</p>
      </div>

    {:else if error && !dataset}
      <div class="text-center py-32">
        <div class="glass rounded-2xl p-8 max-w-md mx-auto">
          <p class="text-red-400 mb-6">{error}</p>
          <a href="/" class="btn-primary text-sm">Back to Marketplace</a>
        </div>
      </div>

    {:else if dataset}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Header Card -->
          <div class="glass rounded-2xl p-8">
            <div class="flex items-start justify-between mb-6">
              <span class="{getCategoryBadge(dataset.category)}">{dataset.category}</span>
              <span class="text-xs text-slate-600">
                {dataset.purchaseCount} {dataset.purchaseCount === 1 ? 'purchase' : 'purchases'}
              </span>
            </div>

            <h1 class="text-3xl font-bold tracking-tight mb-4">{dataset.name}</h1>
            <p class="text-slate-400 leading-relaxed">{dataset.description}</p>
          </div>

          <!-- Technical Details -->
          <div class="glass rounded-2xl p-8">
            <h2 class="text-xl font-semibold mb-6">Technical Details</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div class="text-xs text-slate-600 uppercase tracking-wider mb-1">Size</div>
                <div class="text-white font-mono">{formatFileSize(dataset.sizeBytes)}</div>
              </div>
              <div>
                <div class="text-xs text-slate-600 uppercase tracking-wider mb-1">Listed</div>
                <div class="text-white">{formatDate(dataset.listedAt)}</div>
              </div>
              <div>
                <div class="text-xs text-slate-600 uppercase tracking-wider mb-1">Provider</div>
                <div class="text-white font-mono text-sm">{truncateAddress(dataset.provider)}</div>
              </div>
              <div>
                <div class="text-xs text-slate-600 uppercase tracking-wider mb-1">Storage Epochs</div>
                <div class="text-white">{dataset.storageEpochs || 'N/A'}</div>
              </div>
              <div class="sm:col-span-2">
                <div class="text-xs text-slate-600 uppercase tracking-wider mb-1">Walrus Blob ID</div>
                <div class="text-white font-mono text-xs break-all bg-white/5 rounded-lg p-3 mt-1">
                  {dataset.walrusBlobId}
                </div>
              </div>
              {#if dataset.contentHash}
                <div class="sm:col-span-2">
                  <div class="text-xs text-slate-600 uppercase tracking-wider mb-1">Content Hash (SHA256)</div>
                  <div class="text-white font-mono text-xs break-all bg-white/5 rounded-lg p-3 mt-1">
                    {dataset.contentHash}
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Verification -->
          {#if dataset.contentHash}
            <div class="glass rounded-2xl p-8">
              <h2 class="text-xl font-semibold mb-3">Integrity Verification</h2>
              <p class="text-slate-500 text-sm mb-6">Verify that the downloaded content matches the original hash.</p>

              <button onclick={handleVerify} disabled={verifying} class="btn-secondary text-sm">
                {verifying ? 'Verifying...' : 'Verify Integrity'}
              </button>

              {#if verificationResult}
                <div class="mt-6 p-4 rounded-xl {verificationResult.verified ? 'bg-walrus-500/10 border border-walrus-500/20' : 'bg-red-500/10 border border-red-500/20'}">
                  <div class="flex items-center gap-2 mb-2">
                    {#if verificationResult.verified}
                      <svg class="w-5 h-5 text-walrus-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="text-walrus-400 font-medium">Verified</span>
                    {:else}
                      <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="text-red-400 font-medium">Mismatch</span>
                    {/if}
                  </div>
                  <p class="text-slate-500 text-xs font-mono break-all">{verificationResult.sha256}</p>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Purchase Card -->
          <div class="glass rounded-2xl p-6 sticky top-24">
            <div class="text-center mb-8">
              <div class="text-4xl font-bold gradient-text mb-2">{formatSui(dataset.price)}</div>
              <div class="text-slate-500 text-sm">{dataset.active ? 'Available' : 'Sold'}</div>
            </div>

            {#if dataset.active}
              <button onclick={handlePurchase} disabled={purchasing} class="w-full btn-primary !py-4 mb-3 disabled:opacity-50 disabled:cursor-not-allowed">
                {purchasing ? 'Processing...' : 'Purchase Dataset'}
              </button>
              <button onclick={handleDownload} disabled={downloading} class="w-full btn-secondary !py-4 disabled:opacity-50 disabled:cursor-not-allowed">
                {downloading ? 'Downloading...' : 'Download from Walrus'}
              </button>
            {:else}
              <button onclick={handleDownload} disabled={downloading} class="w-full btn-primary !py-4 !bg-walrus-600 hover:!bg-walrus-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {downloading ? 'Downloading...' : 'Download Dataset'}
              </button>
            {/if}

            {#if error}
              <div class="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p class="text-red-400 text-sm">{error}</p>
              </div>
            {/if}

            <div class="mt-8 pt-6 border-t border-white/5 space-y-3 text-sm">
              <div class="flex justify-between text-slate-500">
                <span>Platform Fee</span>
                <span>2%</span>
              </div>
              <div class="flex justify-between text-slate-500">
                <span>Provider Receives</span>
                <span>{formatSui(Math.floor(dataset.price * 0.98))}</span>
              </div>
              <div class="flex justify-between text-slate-500">
                <span>Storage</span>
                <span>Walrus Testnet</span>
              </div>
            </div>
          </div>

          <!-- Links Card -->
          <div class="glass rounded-2xl p-6">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">External Links</h3>
            <div class="space-y-3">
              <a
                href="https://aggregator.walrus-testnet.walrus.space/v1/blobs/{dataset.walrusBlobId}"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-sm text-nexus-400 hover:text-nexus-300 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on Walrus Aggregator
              </a>
              <a
                href="https://suiexplorer.com/object/{dataset.id}?network=testnet"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-sm text-nexus-400 hover:text-nexus-300 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on Sui Explorer
              </a>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
