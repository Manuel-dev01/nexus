<script lang="ts">
  import { page } from '$app/state';
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

  let listingId = $derived(page.params.id);

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
</script>

<svelte:head>
  <title>{dataset?.name || 'Dataset'} — Nexus</title>
</svelte:head>

<div class="section">
  <div class="container">
    <a href="/" class="back-link">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Marketplace
    </a>

    {#if loading}
      <div style="text-align: center; padding: 96px 0;">
        <p style="font-family: var(--mono); color: var(--dim);">Loading dataset details...</p>
      </div>

    {:else if error && !dataset}
      <div style="text-align: center; padding: 96px 0;">
        <div class="alert alert--error" style="max-width: 400px; margin: 0 auto;">
          <p>{error}</p>
          <a href="/" class="btn btn--ghost btn--sm" style="margin-top: 16px;">Back to Marketplace</a>
        </div>
      </div>

    {:else if dataset}
      <div class="detail-grid">
        <!-- Main Content -->
        <div style="display: flex; flex-direction: column; gap: var(--sp-5);">
          <!-- Header Card -->
          <div class="detail-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-4);">
              <span class="dataset-card__tag">{dataset.category}</span>
              <span style="font-family: var(--mono); font-size: 12px; color: var(--faint);">
                {dataset.purchaseCount} {dataset.purchaseCount === 1 ? 'purchase' : 'purchases'}
              </span>
            </div>

            <h1 class="detail-card__title">{dataset.name}</h1>
            <p style="font-family: var(--mono); font-size: 14px; color: var(--dim); line-height: 1.65;">
              {dataset.description}
            </p>
          </div>

          <!-- Technical Details -->
          <div class="detail-card">
            <h2 style="font-family: var(--sans); font-weight: 600; font-size: var(--text-xl); letter-spacing: -0.02em; margin-bottom: var(--sp-5);">
              Technical Details
            </h2>
            <div class="detail-meta">
              <div class="detail-meta__item">
                <div class="detail-meta__label">Size</div>
                <div class="detail-meta__value">{formatFileSize(dataset.sizeBytes)}</div>
              </div>
              <div class="detail-meta__item">
                <div class="detail-meta__label">Listed</div>
                <div class="detail-meta__value">{formatDate(dataset.listedAt)}</div>
              </div>
              <div class="detail-meta__item">
                <div class="detail-meta__label">Provider</div>
                <div class="detail-meta__value">{truncateAddress(dataset.provider)}</div>
              </div>
              <div class="detail-meta__item">
                <div class="detail-meta__label">Storage Epochs</div>
                <div class="detail-meta__value">{dataset.storageEpochs || 'N/A'}</div>
              </div>
            </div>

            <div style="margin-top: var(--sp-5); padding-top: var(--sp-5); border-top: 1px solid var(--line-soft);">
              <div class="detail-meta__label">Walrus Blob ID</div>
              <div style="font-family: var(--mono); font-size: 11.5px; color: var(--fg); background: var(--bone); padding: 12px; border-radius: var(--r-sm); border: 1px solid var(--line-soft); margin-top: 6px; word-break: break-all;">
                {dataset.walrusBlobId}
              </div>
            </div>

            {#if dataset.contentHash}
              <div style="margin-top: var(--sp-4);">
                <div class="detail-meta__label">Content Hash (SHA256)</div>
                <div style="font-family: var(--mono); font-size: 11.5px; color: var(--fg); background: var(--bone); padding: 12px; border-radius: var(--r-sm); border: 1px solid var(--line-soft); margin-top: 6px; word-break: break-all;">
                  {dataset.contentHash}
                </div>
              </div>
            {/if}
          </div>

          <!-- Verification -->
          {#if dataset.contentHash}
            <div class="detail-card">
              <h2 style="font-family: var(--sans); font-weight: 600; font-size: var(--text-xl); letter-spacing: -0.02em; margin-bottom: var(--sp-3);">
                Integrity Verification
              </h2>
              <p style="font-family: var(--mono); font-size: 13px; color: var(--dim); margin-bottom: var(--sp-5);">
                Verify that the downloaded content matches the original hash.
              </p>

              <button onclick={handleVerify} disabled={verifying} class="btn btn--ghost">
                {verifying ? 'Verifying...' : 'Verify Integrity'}
              </button>

              {#if verificationResult}
                <div style="margin-top: var(--sp-5); padding: var(--sp-4); border-radius: var(--r-md); border: 1px solid {verificationResult.verified ? 'var(--accent)' : '#fecaca'}; background: {verificationResult.verified ? 'var(--accent-soft)' : '#fef2f2'};">
                  <p style="font-family: var(--mono); font-size: 13px; font-weight: 500; color: {verificationResult.verified ? 'var(--accent-deep)' : '#991b1b'}; margin-bottom: 4px;">
                    {verificationResult.verified ? 'Verified' : 'Mismatch'}
                  </p>
                  <p style="font-family: var(--mono); font-size: 11px; color: var(--dim); word-break: break-all;">
                    {verificationResult.sha256}
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Sidebar -->
        <div class="sidebar-card">
          <div class="sidebar-card__price">
            {formatSui(dataset.price).replace(' SUI', '')}
            <span class="sidebar-card__price-unit">SUI</span>
          </div>
          <div class="sidebar-card__status">{dataset.active ? 'Available' : 'Sold'}</div>

          {#if dataset.active}
            <button onclick={handlePurchase} disabled={purchasing} class="btn btn--primary" style="width: 100%; justify-content: center; margin-bottom: 10px;">
              {purchasing ? 'Processing...' : 'Purchase Dataset'}
            </button>
            <button onclick={handleDownload} disabled={downloading} class="btn btn--ghost" style="width: 100%; justify-content: center;">
              {downloading ? 'Downloading...' : 'Download from Walrus'}
            </button>
          {:else}
            <button onclick={handleDownload} disabled={downloading} class="btn btn--primary" style="width: 100%; justify-content: center;">
              {downloading ? 'Downloading...' : 'Download Dataset'}
            </button>
          {/if}

          {#if error}
            <div class="alert alert--error" style="margin-top: var(--sp-4);">
              {error}
            </div>
          {/if}

          <div class="sidebar-card__rows">
            <div class="sidebar-card__row">
              <span>Platform Fee</span>
              <span>2%</span>
            </div>
            <div class="sidebar-card__row">
              <span>Provider Receives</span>
              <span>{formatSui(Math.floor(dataset.price * 0.98))}</span>
            </div>
            <div class="sidebar-card__row">
              <span>Storage</span>
              <span>Walrus Testnet</span>
            </div>
          </div>

          <!-- External Links -->
          <div style="margin-top: var(--sp-5); padding-top: var(--sp-5); border-top: 1px solid var(--line-soft);">
            <div style="font-family: var(--mono); font-size: 11px; color: var(--faint); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: var(--sp-3);">
              External Links
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <a
                href="https://aggregator.walrus-testnet.walrus.space/v1/blobs/{dataset.walrusBlobId}"
                target="_blank"
                rel="noopener noreferrer"
                style="font-family: var(--mono); font-size: 12.5px; color: var(--accent-deep);"
              >
                View on Walrus Aggregator &rarr;
              </a>
              <a
                href="https://suiexplorer.com/object/{dataset.id}?network=testnet"
                target="_blank"
                rel="noopener noreferrer"
                style="font-family: var(--mono); font-size: 12.5px; color: var(--accent-deep);"
              >
                View on Sui Explorer &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
