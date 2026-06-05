<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getListingFields, formatAmount, coinSymbol, readCoinType, bytesFieldToHex, getAccessObjectForListing, PACKAGE_ID, MARKETPLACE_ID, buildBuyDatasetTransaction, hasPurchasedListing, explorerTx, explorerObject, explorerAccount } from '$lib/sui/config';
  import { downloadFromWalrus, verifyBlob, formatFileSize } from '$lib/walrus/client';
  import { detectWallets, connectWallet, signAndExecuteTransaction, signPersonalMessage, truncateAddress, type WalletInfo } from '$lib/wallet/store';
  // Seal is loaded ON DEMAND (dynamic import below) — eager import broke hydration.

  interface Dataset {
    id: string;
    name: string;
    description: string;
    category: string;
    walrusBlobId: string;
    sizeBytes: number;
    price: number;
    coinType: string;
    encrypted: boolean;
    sealPolicyHex: string;
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
  // Access gating: true once we've confirmed the connected wallet owns a
  // DatasetAccess (or is the provider) for this listing.
  let hasAccess = $state(false);
  // Why access is (or isn't) granted — drives the explanatory note + labels.
  // 'provider' = you listed it · 'purchased' = you own a DatasetAccess · null = locked.
  let accessReason: 'provider' | 'purchased' | null = $state(null);
  // The wallet address currently authorized in the browser (no prompt). Lets us
  // reflect access state on load instead of only after a click.
  let connectedAddress: string | null = $state(null);
  // Provider of an ENCRYPTED dataset: they own the listing but can't decrypt
  // without their own DatasetAccess, so the download stays gated for them.
  let providerOfEncrypted = $state(false);
  let purchaseSuccess: string | null = $state(null);
  // On-chain references for Suiscan links (the listing ID itself is wrapped and
  // not directly viewable — these point at the live object + its transaction).
  let listingObjectId: string | null = $state(null);
  let listingTxDigest: string | null = $state(null);

  // vector<u8> seal_policy_id arrives as a base64 string or number[]; non-empty = encrypted.
  function sealPolicyNonEmpty(seal: unknown): boolean {
    if (Array.isArray(seal)) return seal.length > 0;
    if (typeof seal === 'string') return seal.length > 0;
    return false;
  }

  let listingId = $derived(page.params.id);

  onMount(async () => {
    await loadDataset();
  });

  async function loadDataset() {
    loading = true;
    error = null;

    // Narrow the route param (string | undefined) to a concrete id before use.
    const id = listingId;
    if (!id) {
      error = 'No dataset ID provided in the URL.';
      loading = false;
      return;
    }

    try {
      // Listings live inside the marketplace table — fetch via dynamic field,
      // not sui_getObject (which returns notExists for wrapped objects).
      const listing = await getListingFields(MARKETPLACE_ID, id);

      if (!listing) {
        throw new Error('Dataset not found');
      }

      const fields = listing.fields;
      listingObjectId = listing.objectId;
      listingTxDigest = listing.lastTxDigest;

      dataset = {
        id,
        name: fields.name,
        description: fields.description,
        category: fields.category,
        walrusBlobId: fields.walrus_blob_id,
        sizeBytes: parseInt(fields.size_bytes),
        price: parseInt(fields.price),
        coinType: readCoinType(fields.coin_type),
        encrypted: sealPolicyNonEmpty(fields.seal_policy_id),
        sealPolicyHex: bytesFieldToHex(fields.seal_policy_id),
        provider: fields.provider,
        active: fields.active,
        listedAt: parseInt(fields.listed_at),
        purchaseCount: parseInt(fields.purchase_count),
        contentHash: fields.content_hash,
        storageEpochs: fields.storage_epochs ? parseInt(fields.storage_epochs) : null,
      };

      // Reflect access state up-front (no wallet prompt) so the buttons/notes are
      // accurate on load rather than only revealing the gate after a click.
      await refreshAccess();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load dataset';
      console.error('Error loading dataset:', err);
    } finally {
      loading = false;
    }
  }

  /**
   * Determine whether the already-authorized wallet holds access to this listing,
   * WITHOUT triggering a fresh connect prompt. Reads the adapter's restored
   * accounts; if none, access stays locked until the user acts.
   */
  async function refreshAccess() {
    if (!dataset) return;
    const wallets = detectWallets();
    const addr = (wallets[0]?.adapter as any)?.accounts?.[0]?.address ?? null;
    connectedAddress = addr;
    providerOfEncrypted = false;

    if (!addr) {
      hasAccess = false;
      accessReason = null;
      return;
    }
    if (addr === dataset.provider) {
      // Provider can download their own *unencrypted* blob; an encrypted one still
      // needs a DatasetAccess to decrypt, so keep it gated and explain why.
      if (dataset.encrypted) {
        hasAccess = false;
        accessReason = null;
        providerOfEncrypted = true;
      } else {
        hasAccess = true;
        accessReason = 'provider';
      }
      return;
    }
    const owns = await hasPurchasedListing(addr, dataset.id);
    hasAccess = owns;
    accessReason = owns ? 'purchased' : null;
  }

  async function handlePurchase() {
    if (!dataset) return;
    purchasing = true;
    error = null;

    try {
      // Check wallet
      const wallets = detectWallets();
      if (wallets.length === 0) {
        throw new Error('No Sui wallet detected. Please install Sui Wallet browser extension.');
      }

      let wallet: WalletInfo;
      try {
        wallet = wallets[0];
        await connectWallet(wallet);
      } catch (err: any) {
        throw new Error(`Wallet connection failed: ${err.message}`);
      }

      if (!PACKAGE_ID || !MARKETPLACE_ID) {
        throw new Error('Smart contracts not deployed yet. Please deploy contracts first.');
      }

      // Build purchase PTB
      const tx = buildBuyDatasetTransaction({
        marketplaceId: MARKETPLACE_ID,
        listingId: dataset.id,
        paymentAmount: dataset.price,
        coinType: dataset.coinType,
        clockId: '0x6',
      });

      // Sign and execute
      const result = await signAndExecuteTransaction(wallet, tx);

      // Purchase mints a DatasetAccess to the buyer — unlock the download now and
      // record that access came from a purchase (drives the explanatory note).
      hasAccess = true;
      accessReason = 'purchased';
      connectedAddress = (wallet.adapter as any)?.accounts?.[0]?.address ?? connectedAddress;
      purchaseSuccess = result.digest || result.transactionDigest || 'confirmed';
    } catch (err: any) {
      error = err.message || 'Purchase failed';
      console.error('Purchase error:', err);
    } finally {
      purchasing = false;
    }
  }

  async function handleDownload() {
    if (!dataset) return;
    downloading = true;
    error = null;
    try {
      // Access gate: require an on-chain DatasetAccess for this listing (or be the
      // provider). Encrypted datasets also need the wallet to sign a Seal SessionKey.
      const wallets = detectWallets();
      if (wallets.length === 0) {
        throw new Error('Connect a Sui wallet to download — access is gated by your on-chain DatasetAccess.');
      }
      const wallet = wallets[0];
      const address = await connectWallet(wallet);
      connectedAddress = address;
      const isProvider = address === dataset.provider;
      const owns = isProvider || (await hasPurchasedListing(address, dataset.id));
      if (!owns) {
        hasAccess = false;
        accessReason = null;
        throw new Error('Purchase required: no DatasetAccess for this listing was found in your wallet. Buy the dataset to unlock the download.');
      }
      hasAccess = true;
      accessReason = isProvider ? 'provider' : 'purchased';

      // Download the (possibly encrypted) bytes from Walrus. content_hash is over
      // the stored bytes, so integrity verification holds for ciphertext too.
      const result = await downloadFromWalrus(dataset.walrusBlobId, dataset.contentHash || undefined);
      let bytes: Uint8Array = new Uint8Array(result.data);

      // Seal-encrypted: decrypt with a wallet-signed SessionKey + seal_approve proof.
      if (dataset.encrypted) {
        if (isProvider) {
          throw new Error('This dataset is encrypted; decryption requires a DatasetAccess (purchase it to decrypt).');
        }
        const accessId = await getAccessObjectForListing(address, dataset.id);
        if (!accessId) throw new Error('No DatasetAccess object found to authorize decryption.');
        const { sealDecrypt } = await import('$lib/seal/client');
        bytes = await sealDecrypt({
          ciphertext: bytes,
          identityHex: dataset.sealPolicyHex,
          accessObjectId: accessId,
          address,
          signPersonalMessage: (msg) => signPersonalMessage(wallet, msg),
        });
      }

      const blob = new Blob([bytes as BlobPart]);
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
            {formatAmount(dataset.price, dataset.coinType).split(' ')[0]}
            <span class="sidebar-card__price-unit">{coinSymbol(dataset.coinType)}</span>
          </div>
          <div class="sidebar-card__status">{dataset.active ? 'Available' : 'Sold'}</div>
          {#if dataset.encrypted}
            <div style="font-family: var(--mono); font-size: 11px; color: var(--accent-deep); margin-top: 6px;">
              🔒 Seal-encrypted — decryption unlocks on purchase
            </div>
          {/if}

          {#if dataset.active}
            {#if hasAccess}
              <!-- Access confirmed → the buy button is redundant; lead with download. -->
              <button onclick={handleDownload} disabled={downloading} class="btn btn--primary" style="width: 100%; justify-content: center;">
                {downloading ? 'Downloading...' : dataset.encrypted ? 'Decrypt & Download' : 'Download from Walrus'}
              </button>
            {:else}
              <button onclick={handlePurchase} disabled={purchasing} class="btn btn--primary" style="width: 100%; justify-content: center; margin-bottom: 10px;">
                {purchasing ? 'Processing...' : 'Purchase Dataset'}
              </button>
              <button onclick={handleDownload} disabled={downloading} class="btn btn--ghost" style="width: 100%; justify-content: center;">
                {downloading ? 'Checking access...' : 'Download (requires purchase)'}
              </button>
            {/if}
          {:else}
            <button onclick={handleDownload} disabled={downloading || !hasAccess} class="btn btn--primary" style="width: 100%; justify-content: center;">
              {downloading ? 'Downloading...' : hasAccess ? (dataset.encrypted ? 'Decrypt & Download' : 'Download Dataset') : 'Delisted — access required'}
            </button>
          {/if}

          {#if hasAccess && accessReason}
            <div style="font-family: var(--mono); font-size: 11.5px; color: var(--accent-deep); margin-top: 10px; text-align: center;">
              {accessReason === 'provider'
                ? 'You listed this dataset — download is enabled for the provider.'
                : 'You own access to this dataset.'}
            </div>
          {:else if dataset.active}
            <div style="font-family: var(--mono); font-size: 11.5px; color: var(--faint); margin-top: 10px; text-align: center;">
              {#if providerOfEncrypted}
                You listed this encrypted dataset — decryption still requires a DatasetAccess. Purchase it to decrypt.
              {:else if connectedAddress}
                Purchase mints an on-chain DatasetAccess that unlocks the download.
              {:else}
                Connect your wallet to check access, or purchase to unlock the download.
              {/if}
            </div>
          {/if}

          {#if purchaseSuccess}
            <div class="alert" style="margin-top: var(--sp-4); border: 1px solid var(--accent); background: var(--accent-soft); color: var(--accent-deep); font-family: var(--mono); font-size: 12px; word-break: break-all;">
              Purchase confirmed — access unlocked.<br />
              <a href={explorerTx(purchaseSuccess)} target="_blank" rel="noopener noreferrer" style="color: var(--accent-deep); text-decoration: underline;">
                View transaction on Suiscan &rarr;
              </a>
            </div>
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
              <span>{formatAmount(Math.floor(dataset.price * 0.98), dataset.coinType)}</span>
            </div>
            <div class="sidebar-card__row">
              <span>Storage</span>
              <span>Walrus</span>
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
                View raw blob on Walrus &rarr;
              </a>
              {#if listingObjectId}
                <a
                  href={explorerObject(listingObjectId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style="font-family: var(--mono); font-size: 12.5px; color: var(--accent-deep);"
                >
                  View listing on Suiscan &rarr;
                </a>
              {/if}
              {#if listingTxDigest}
                <a
                  href={explorerTx(listingTxDigest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style="font-family: var(--mono); font-size: 12.5px; color: var(--accent-deep);"
                >
                  View transaction on Suiscan &rarr;
                </a>
              {/if}
              <a
                href={explorerAccount(dataset.provider)}
                target="_blank"
                rel="noopener noreferrer"
                style="font-family: var(--mono); font-size: 12.5px; color: var(--accent-deep);"
              >
                View provider on Suiscan &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
