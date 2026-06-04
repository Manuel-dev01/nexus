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
      const walrusResult = await uploadToWalrus(file, 5, (p) => {
        progress = p.percentage * 0.5;
      });

      progress = 50;

      const priceMist = Math.floor(priceSui * 1_000_000_000);

      progress = 100;
      success = true;

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

<div class="gradient-bg min-h-screen">
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
    <!-- Header -->
    <div class="mb-12">
      <a href="/" class="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors mb-6">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Marketplace
      </a>
      <h1 class="text-4xl font-bold tracking-tight mb-3">Upload Dataset</h1>
      <p class="text-slate-500 text-lg">
        Store your AI training data on Walrus and list it for sale on Sui.
      </p>
    </div>

    {#if success}
      <!-- Success State -->
      <div class="glass rounded-2xl p-12 text-center">
        <div class="w-20 h-20 rounded-full bg-walrus-500/10 flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-walrus-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold mb-3">Upload Successful!</h2>
        <p class="text-slate-400 mb-8 max-w-md mx-auto">
          Your dataset has been uploaded to Walrus. Connect your wallet to list it on the marketplace.
        </p>
        <div class="flex justify-center gap-4">
          <button
            onclick={() => { success = false; file = null; name = ''; description = ''; }}
            class="btn-secondary text-sm"
          >
            Upload Another
          </button>
          <a href="/" class="btn-primary text-sm">
            View Marketplace
          </a>
        </div>
      </div>

    {:else}
      <!-- Upload Form -->
      <form onsubmit={e => { e.preventDefault(); handleSubmit(); }} class="space-y-8">
        <!-- File Upload -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-3">Dataset File</label>
          <div
            ondrop={handleDrop}
            ondragover={handleDragOver}
            onclick={() => document.getElementById('file-input')?.click()}
            class="glass rounded-2xl p-12 text-center cursor-pointer hover:border-nexus-500/30 transition-colors duration-200"
          >
            {#if file}
              <div class="flex flex-col items-center">
                <div class="w-14 h-14 rounded-xl bg-nexus-500/10 flex items-center justify-center mb-4">
                  <svg class="w-7 h-7 text-nexus-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p class="text-white font-medium mb-1">{file.name}</p>
                <p class="text-slate-500 text-sm">{formatFileSize(file.size)}</p>
              </div>
            {:else}
              <div class="flex flex-col items-center">
                <div class="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <svg class="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p class="text-slate-400 mb-1">Drag and drop your file here</p>
                <p class="text-slate-600 text-sm">or click to browse</p>
              </div>
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
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label for="name" class="block text-sm font-medium text-slate-300 mb-3">Name</label>
            <input
              id="name"
              type="text"
              bind:value={name}
              placeholder="GPT-2 Embedding Vectors"
              class="input-field"
            />
          </div>

          <div>
            <label for="category" class="block text-sm font-medium text-slate-300 mb-3">Category</label>
            <select id="category" bind:value={category} class="input-field">
              {#each categories as cat}
                <option value={cat.value}>{cat.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label for="description" class="block text-sm font-medium text-slate-300 mb-3">Description</label>
          <textarea
            id="description"
            bind:value={description}
            rows="4"
            placeholder="Describe your dataset, its format, and potential use cases..."
            class="input-field resize-none"
          ></textarea>
        </div>

        <div>
          <label for="price" class="block text-sm font-medium text-slate-300 mb-3">
            Price (SUI)
            <span class="text-slate-600 font-normal ml-2">2% platform fee</span>
          </label>
          <input
            id="price"
            type="number"
            bind:value={priceSui}
            min="0.01"
            step="0.01"
            class="input-field"
          />
          {#if file}
            <p class="text-slate-600 text-xs mt-2 font-mono">
              Estimated storage cost: {formatCost(estimatedCost)}
            </p>
          {/if}
        </div>

        <!-- Error Message -->
        {#if error}
          <div class="glass rounded-xl p-4 border-red-500/20">
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        {/if}

        <!-- Progress Bar -->
        {#if uploading}
          <div>
            <div class="flex justify-between text-sm text-slate-500 mb-2">
              <span>Uploading to Walrus...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div class="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-nexus-500 to-tatum-500 rounded-full transition-all duration-300"
                style="width: {progress}%"
              ></div>
            </div>
          </div>
        {/if}

        <!-- Submit Button -->
        <button
          type="submit"
          disabled={uploading || !file || !name || !description || priceSui <= 0}
          class="w-full btn-primary !py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {#if uploading}
            <span class="flex items-center justify-center gap-2">
              <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Uploading...
            </span>
          {:else}
            Upload and List Dataset
          {/if}
        </button>

        <!-- Wallet Note -->
        <div class="glass rounded-xl p-4">
          <p class="text-slate-500 text-sm">
            <strong class="text-slate-400">Note:</strong> To complete the listing, you will need to connect your Sui wallet and sign the transaction. Wallet integration will be enabled after deployment.
          </p>
        </div>
      </form>
    {/if}
  </div>
</div>
