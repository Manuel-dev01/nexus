<script lang="ts">
  import { goto } from '$app/navigation';
  import { uploadToWalrus, estimateUploadCost, formatCost, formatFileSize } from '$lib/walrus/client';
  import { buildListDatasetTransaction, getSuiClient, PACKAGE_ID, MARKETPLACE_ID } from '$lib/sui/config';

  let file: File | null = null;
  let name = '';
  let description = '';
  let category = 'embeddings';
  let priceSui = 0.1;
  let uploading = false;
  let progress = 0;
  let error: string | null = null;
  let success = false;

  const categories = [
    { value: 'embeddings', label: 'Embeddings' },
    { value: 'fine-tuning', label: 'Fine-Tuning' },
    { value: 'model-weights', label: 'Model Weights' },
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

  async function handleSubmit() {
    if (!file || !name || !description || priceSui <= 0) {
      error = 'Please fill in all fields and select a file';
      return;
    }

    uploading = true;
    error = null;
    progress = 0;

    try {
      // Step 1: Upload to Walrus
      const walrusResult = await uploadToWalrus(file, 5, (p) => {
        progress = p.percentage * 0.5; // First 50% is Walrus upload
      });

      progress = 50;

      // Step 2: List on Sui
      // Note: This requires wallet connection (dapp-kit)
      // For now, we'll show the transaction details
      const priceMist = Math.floor(priceSui * 1_000_000_000);

      // In production, this would use dapp-kit to sign the transaction
      // const tx = buildListDatasetTransaction({
      //   marketplaceId: MARKETPLACE_ID,
      //   name,
      //   description,
      //   category,
      //   walrusBlobId: walrusResult.blobId,
      //   sizeBytes: file.size,
      //   price: priceMist,
      //   contentHash: walrusResult.sha256,
      //   storageEpochs: 5,
      //   clockId: '0x6',
      // });

      progress = 100;
      success = true;

      // Show success with blob ID
      console.log('Upload successful!', {
        blobId: walrusResult.blobId,
        cost: walrusResult.cost,
        sha256: walrusResult.sha256,
      });

    } catch (err) {
      error = err instanceof Error ? err.message : 'Upload failed';
      console.error('Upload error:', err);
    } finally {
      uploading = false;
    }
  }

  let estimatedCost = $derived(file ? estimateUploadCost(file.size, 5) : 0);
</script>

<svelte:head>
  <title>Upload Dataset — Nexus</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <!-- Header -->
    <div class="mb-8">
      <a href="/" class="text-blue-400 hover:text-blue-300 mb-4 inline-block">
        ← Back to Marketplace
      </a>
      <h1 class="text-4xl font-bold text-white">Upload Dataset</h1>
      <p class="text-gray-400 mt-2">
        Upload your AI training data to Walrus decentralized storage and list it for sale.
      </p>
    </div>

    {#if success}
      <!-- Success State -->
      <div class="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center">
        <svg class="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="text-2xl font-bold text-white mb-2">Upload Successful!</h2>
        <p class="text-gray-400 mb-6">
          Your dataset has been uploaded to Walrus. Connect your wallet to list it on the marketplace.
        </p>
        <div class="flex justify-center gap-4">
          <button
            onclick={() => { success = false; file = null; name = ''; description = ''; }}
            class="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Upload Another
          </button>
          <a
            href="/"
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            View Marketplace
          </a>
        </div>
      </div>

    {:else}
      <!-- Upload Form -->
      <form onsubmit={e => { e.preventDefault(); handleSubmit(); }} class="space-y-8">
        <!-- File Upload -->
        <div>
          <label class="block text-white font-medium mb-4">Dataset File</label>
          <div
            ondrop={handleDrop}
            ondragover={handleDragOver}
            class="border-2 border-dashed border-white/20 hover:border-blue-500 rounded-xl p-12 text-center cursor-pointer transition-colors"
            onclick={() => document.getElementById('file-input')?.click()}
          >
            {#if file}
              <div class="text-white">
                <svg class="w-12 h-12 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="text-lg font-medium">{file.name}</p>
                <p class="text-gray-400 mt-1">{formatFileSize(file.size)}</p>
              </div>
            {:else}
              <svg class="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p class="text-gray-400">
                Drag and drop your file here, or click to browse
              </p>
              <p class="text-gray-500 text-sm mt-2">
                Supports any file format (CSV, JSONL, Parquet, SafeTensors, etc.)
              </p>
            {/if}
          </div>
          <input
            id="file-input"
            type="file"
            onchange={handleFileSelect}
            class="hidden"
          />
        </div>

        <!-- Dataset Details -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="name" class="block text-white font-medium mb-2">Name</label>
            <input
              id="name"
              type="text"
              bind:value={name}
              placeholder="e.g., GPT-2 Embedding Vectors"
              class="w-full bg-white/10 border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          <div>
            <label for="category" class="block text-white font-medium mb-2">Category</label>
            <select
              id="category"
              bind:value={category}
              class="w-full bg-white/10 border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {#each categories as cat}
                <option value={cat.value}>{cat.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label for="description" class="block text-white font-medium mb-2">Description</label>
          <textarea
            id="description"
            bind:value={description}
            rows="4"
            placeholder="Describe your dataset, its format, and potential use cases..."
            class="w-full bg-white/10 border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          ></textarea>
        </div>

        <div>
          <label for="price" class="block text-white font-medium mb-2">
            Price (SUI)
            <span class="text-gray-400 font-normal">— 2% platform fee</span>
          </label>
          <input
            id="price"
            type="number"
            bind:value={priceSui}
            min="0.01"
            step="0.01"
            class="w-full bg-white/10 border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {#if file}
            <p class="text-gray-500 text-sm mt-2">
              Estimated storage cost: {formatCost(estimatedCost)}
            </p>
          {/if}
        </div>

        <!-- Error Message -->
        {#if error}
          <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p class="text-red-400">{error}</p>
          </div>
        {/if}

        <!-- Progress Bar -->
        {#if uploading}
          <div>
            <div class="flex justify-between text-sm text-gray-400 mb-2">
              <span>Uploading to Walrus...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div class="w-full bg-white/10 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style="width: {progress}%"
              ></div>
            </div>
          </div>
        {/if}

        <!-- Submit Button -->
        <button
          type="submit"
          disabled={uploading || !file || !name || !description || priceSui <= 0}
          class="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {#if uploading}
            Uploading...
          {:else}
            Upload & List Dataset
          {/if}
        </button>

        <!-- Wallet Connection Note -->
        <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p class="text-yellow-400 text-sm">
            <strong>Note:</strong> To complete the listing, you'll need to connect your Sui wallet
            and sign the transaction. Wallet integration will be enabled after deployment.
          </p>
        </div>
      </form>
    {/if}
  </div>
</div>
