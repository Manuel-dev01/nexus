<script lang="ts">
  import { uploadToWalrus, estimateUploadCost, formatCost, formatFileSize } from '$lib/walrus/client';
  import { buildListDatasetTransaction, PACKAGE_ID, MARKETPLACE_ID, explorerTx, TOKENS, SUI_COIN_TYPE, tokenByType } from '$lib/sui/config';
  import { signAndExecuteTransaction } from '$lib/wallet/store';
  import { walletConn } from '$lib/wallet/connection.svelte';
  // Seal (@mysten/seal) is a heavy crypto lib loaded ON DEMAND via dynamic import
  // below — importing it eagerly broke this route's hydration in the browser.

  let file: File | null = $state(null);
  let encrypt = $state(false);
  let name = $state('');
  let description = $state('');
  let category = $state('embeddings');
  let priceSui = $state(0.1);
  let coinType = $state(SUI_COIN_TYPE);
  let uploading = $state(false);
  let progress = $state(0);
  let statusMessage = $state('');
  let error: string | null = $state(null);
  let success = $state(false);
  let txDigest: string | null = $state(null);

  // Required fields still missing — mirrors the submit button's disabled condition
  // so we can tell the user exactly why the button is disabled.
  let missingFields = $derived(
    [
      !file && 'a file',
      !name.trim() && 'a name',
      !description.trim() && 'a description',
      !(priceSui > 0) && 'a price greater than 0',
    ].filter(Boolean) as string[]
  );

  const categories = [
    { value: 'embeddings', label: 'Embeddings' },
    { value: 'fine-tuning', label: 'Fine-Tuning' },
    { value: 'model-weights', label: 'Model Weights' },
    { value: 'language', label: 'Language' },
    { value: 'vision', label: 'Vision' },
  ];

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      file = input.files[0];
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      file = event.dataTransfer.files[0];
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  /** Explicit, visible wallet connection (used by the gate below). */
  async function handleConnect() {
    try {
      await walletConn.connect();
    } catch (err) {
      console.error('Connect failed:', err);
    }
  }

  async function handleSubmit() {
    // `|| !file` is redundant (missingFields already covers it) but narrows `file`
    // to non-null for TypeScript across the awaits below.
    if (missingFields.length > 0 || !file) {
      error = `Please add ${missingFields.join(', ')} before uploading.`;
      return;
    }

    // Require an explicit wallet connection BEFORE uploading to Walrus, so we
    // never upload and then fail at the signing step.
    if (!walletConn.connected || !walletConn.wallet) {
      error = 'Connect your wallet first to list a dataset.';
      return;
    }

    uploading = true;
    error = null;
    progress = 0;
    txDigest = null;

    try {
      // Step 0 (optional): Seal-encrypt before upload. The random identity becomes
      // the listing's seal_policy_id; only owners of a matching DatasetAccess decrypt.
      let uploadTarget: File = file;
      let sealPolicyId: number[] = [];
      if (encrypt) {
        statusMessage = 'Encrypting with Seal (key servers)...';
        const { sealEncrypt, newSealIdentity } = await import('$lib/seal/client');
        const identity = newSealIdentity();
        sealPolicyId = identity.bytes;
        const plain = new Uint8Array(await file.arrayBuffer());
        const cipher = await sealEncrypt(plain, identity.hex);
        uploadTarget = new File([cipher as BlobPart], file.name + '.seal', { type: 'application/octet-stream' });
      }

      // Step 1: Upload to Walrus (the ciphertext when encrypted)
      statusMessage = 'Uploading file to Walrus decentralized storage...';
      const walrusResult = await uploadToWalrus(uploadTarget, 5, (p) => {
        progress = p.percentage * 0.4; // 0-40%
      });

      progress = 40;
      statusMessage = 'File uploaded to Walrus. Preparing Sui transaction...';

      // Step 2: Use the already-connected wallet (connection is required above).
      // Re-read + guard so TypeScript narrows it to non-null across the awaits.
      const wallet = walletConn.wallet;
      if (!wallet) throw new Error('Wallet disconnected — please reconnect and try again.');

      progress = 50;
      statusMessage = 'Building listing transaction...';

      // Step 3: Build PTB — price is in the selected token's smallest unit.
      const priceMist = Math.floor(priceSui * 10 ** tokenByType(coinType).decimals);

      if (!PACKAGE_ID || !MARKETPLACE_ID) {
        // If contracts not deployed, simulate the listing
        statusMessage = 'Contracts not deployed yet. Simulating listing...';
        progress = 100;
        success = true;
        txDigest = 'simulated-' + Date.now();
        console.log('Simulated listing:', {
          blobId: walrusResult.blobId,
          name,
          description,
          category,
          priceMist,
          sha256: walrusResult.sha256,
        });
        return;
      }

      const tx = buildListDatasetTransaction({
        marketplaceId: MARKETPLACE_ID,
        name,
        description,
        category,
        walrusBlobId: walrusResult.blobId,
        sizeBytes: file.size,
        price: priceMist,
        contentHash: walrusResult.sha256,
        storageEpochs: 5,
        coinType,
        sealPolicyId,
        clockId: '0x6', // Sui system clock
      });

      progress = 60;
      statusMessage = 'Please sign the transaction in your wallet...';

      // Step 4: Sign and execute
      const result = await signAndExecuteTransaction(wallet, tx);

      progress = 90;
      statusMessage = 'Transaction confirmed! Finalizing...';

      txDigest = result.digest || result.transactionDigest || null;
      progress = 100;
      success = true;

      console.log('Listing successful!', {
        digest: txDigest,
        blobId: walrusResult.blobId,
        cost: walrusResult.cost,
        sha256: walrusResult.sha256,
      });
    } catch (err: any) {
      error = err.message || 'Upload failed';
      console.error('Upload error:', err);
    } finally {
      uploading = false;
    }
  }

  let estimatedCost = $derived.by(() => {
    const f = file;
    return f ? estimateUploadCost(f.size, 5) : 0;
  });
</script>

<svelte:head>
  <title>Upload Dataset — Nexus</title>
</svelte:head>

<div class="section">
  <div class="container" style="max-width: 720px;">
    <!-- Header -->
    <a href="/" class="back-link">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Marketplace
    </a>

    <h1 style="font-family: var(--sans); font-weight: 600; font-size: var(--text-3xl); letter-spacing: -0.032em; margin-bottom: 8px;">
      Upload Dataset
    </h1>
    <p style="font-family: var(--mono); font-size: 15px; color: var(--dim); margin-bottom: var(--sp-7);">
      Store your AI training data on Walrus and list it for sale on Sui.
    </p>

    {#if success}
      <!-- Success State -->
      <div class="detail-card" style="text-align: center; padding: var(--sp-8);">
        <div style="color: var(--accent); margin-bottom: var(--sp-4);">
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 style="font-family: var(--sans); font-weight: 600; font-size: var(--text-2xl); margin-bottom: var(--sp-3);">
          Dataset Listed!
        </h2>
        <p style="font-family: var(--mono); font-size: 14px; color: var(--dim); margin-bottom: var(--sp-4); max-width: 440px; margin-left: auto; margin-right: auto;">
          Your dataset has been uploaded to Walrus and listed on the Sui marketplace.
        </p>
        {#if txDigest}
          <p style="font-family: var(--mono); font-size: 12px; color: var(--faint); margin-bottom: var(--sp-6); word-break: break-all;">
            {#if txDigest.startsWith('simulated')}
              TX: {txDigest}
            {:else}
              <a href={explorerTx(txDigest)} target="_blank" rel="noopener noreferrer" style="color: var(--accent-deep); text-decoration: underline;">
                View transaction on Suiscan &rarr;
              </a>
            {/if}
          </p>
        {/if}
        <div style="display: flex; justify-content: center; gap: var(--sp-4);">
          <button
            class="btn btn--ghost"
            onclick={() => { success = false; file = null; name = ''; description = ''; txDigest = null; }}
          >
            Upload Another
          </button>
          <a href="/" class="btn btn--primary">View Marketplace</a>
        </div>
      </div>

    {:else}
      <!-- Upload Form -->
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div class="upload-form">
          <!-- File Upload -->
          <div class="form-group">
            <label class="form-label" for="file-input">Dataset File</label>
            <div
              role="button"
              tabindex="0"
              ondrop={handleDrop}
              ondragover={handleDragOver}
              onclick={() => document.getElementById('file-input')?.click()}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('file-input')?.click(); }}
              class="drop-zone"
            >
              {#if file}
                <div style="color: var(--accent);">
                  <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto var(--sp-3);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p class="drop-zone__text" style="color: var(--fg); font-weight: 500;">{file.name}</p>
                <p class="drop-zone__hint">{formatFileSize(file.size)}</p>
              {:else}
                <div class="drop-zone__icon">
                  <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto var(--sp-3);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p class="drop-zone__text">Drag and drop your file here</p>
                <p class="drop-zone__hint">or click to browse</p>
              {/if}
            </div>
            <input id="file-input" type="file" onchange={handleFileSelect} style="display: none;" />
          </div>

          <!-- Name & Category -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5);">
            <div class="form-group">
              <label for="name" class="form-label">Name</label>
              <input id="name" type="text" bind:value={name} placeholder="GPT-2 Embedding Vectors" class="form-input" />
            </div>
            <div class="form-group">
              <label for="category" class="form-label">Category</label>
              <select id="category" bind:value={category} class="form-input">
                {#each categories as cat}
                  <option value={cat.value}>{cat.label}</option>
                {/each}
              </select>
            </div>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="description" class="form-label">Description</label>
            <textarea id="description" bind:value={description} rows="4" placeholder="Describe your dataset, its format, and potential use cases..." class="form-input"></textarea>
          </div>

          <!-- Price + Currency -->
          <div class="form-group">
            <label for="price" class="form-label">
              Price <span style="color: var(--faint); font-size: 11px;">2% platform fee</span>
            </label>
            <div style="display: grid; grid-template-columns: 1fr auto; gap: var(--sp-3);">
              <input id="price" type="number" bind:value={priceSui} min="0.000001" step="0.01" class="form-input" />
              <select bind:value={coinType} aria-label="Currency" class="form-input" style="min-width: 96px;">
                {#each TOKENS as t}
                  <option value={t.coinType}>{t.symbol}</option>
                {/each}
              </select>
            </div>
            {#if file}
              <p style="font-family: var(--mono); font-size: 11.5px; color: var(--faint); margin-top: 6px;">
                Estimated storage cost: {formatCost(estimatedCost)}
              </p>
            {/if}
          </div>

          <!-- Encryption (Seal) -->
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" bind:checked={encrypt} />
              <span class="form-label" style="margin: 0;">🔒 Encrypt with Seal</span>
            </label>
            <p style="font-family: var(--mono); font-size: 11.5px; color: var(--faint); margin-top: 6px;">
              {#if encrypt}
                Encrypted client-side before upload — the decryption key is released on-chain only to addresses that purchase access.
              {:else}
                Off: the dataset is stored as-is and publicly readable from Walrus.
              {/if}
            </p>
          </div>

          <!-- Error -->
          {#if error}
            <div class="alert alert--error" style="margin-bottom: var(--sp-5);">
              {error}
            </div>
          {/if}

          <!-- Progress -->
          {#if uploading}
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; font-family: var(--mono); font-size: 12.5px; color: var(--dim); margin-bottom: 8px;">
                <span>{statusMessage}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div class="progress">
                <div class="progress__bar" style="width: {progress}%"></div>
              </div>
            </div>
          {/if}

          <!-- Submit — connection is an explicit step before uploading/listing. -->
          {#if !walletConn.connected}
            <button
              type="button"
              onclick={handleConnect}
              disabled={walletConn.connecting}
              class="btn btn--primary"
              style="width: 100%; justify-content: center; padding: 16px 24px;"
            >
              {walletConn.connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
            <p style="font-family: var(--mono); font-size: 12px; color: var(--faint); text-align: center; margin-top: 10px;">
              Connect your Sui wallet to upload to Walrus and list on Sui.
            </p>
          {:else}
            <button
              type="submit"
              disabled={uploading || missingFields.length > 0}
              class="btn btn--primary"
              style="width: 100%; justify-content: center; padding: 16px 24px; opacity: {uploading || missingFields.length > 0 ? 0.6 : 1}; cursor: {uploading || missingFields.length > 0 ? 'not-allowed' : 'pointer'};"
            >
              {#if uploading}
                {statusMessage || 'Processing...'}
              {:else}
                Upload and List Dataset
              {/if}
            </button>
            {#if !uploading && missingFields.length > 0}
              <p style="font-family: var(--mono); font-size: 12px; color: var(--accent-deep); text-align: center; margin-top: 10px;">
                Add {missingFields.join(', ')} to enable upload.
              </p>
            {/if}
          {/if}

          <!-- Note -->
          <div style="margin-top: var(--sp-5); padding: var(--sp-4); background: var(--bone-alt); border-radius: var(--r-md); border: 1px solid var(--line-soft);">
            <p style="font-family: var(--mono); font-size: 12.5px; color: var(--dim);">
              <strong style="color: var(--fg);">How it works:</strong> Your file is uploaded to Walrus decentralized storage using RedStuff erasure coding.
              A Sui transaction then creates a DatasetListing object linking the blob ID to your price.
              Buyers pay in the listing's token to receive a DatasetAccess token granting download rights
              (and, for encrypted datasets, the Seal decryption key).
            </p>
          </div>
        </div>
      </form>
    {/if}
  </div>
</div>
