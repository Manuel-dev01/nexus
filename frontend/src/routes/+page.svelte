<script lang="ts">
  import { onMount } from 'svelte';
  import { getSuiClient, MARKETPLACE_ID, PACKAGE_ID, formatSui } from '$lib/sui/config';
  import { downloadFromWalrus, formatFileSize } from '$lib/walrus/client';

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
    purchaseCount: number;
  }

  let datasets: Dataset[] = [];
  let loading = true;
  let error: string | null = null;
  let filterCategory = 'all';
  let sortBy = 'price-asc';

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'embeddings', label: 'Embeddings' },
    { value: 'fine-tuning', label: 'Fine-Tuning' },
    { value: 'model-weights', label: 'Model Weights' },
  ];

  onMount(async () => {
    await loadDatasets();
  });

  async function loadDatasets() {
    loading = true;
    error = null;

    try {
      const client = getSuiClient();

      // Get marketplace object
      const marketplace = await client.getObject({
        id: MARKETPLACE_ID,
        options: { showContent: true },
      });

      if (!marketplace.data?.content || marketplace.data.content.dataType !== 'moveObject') {
        throw new Error('Failed to fetch marketplace');
      }

      const fields = marketplace.data.content.fields as any;
      const listingsTableId = fields.listings.fields.id.id;

      // Get all listings
      const dynamicFields = await client.getDynamicFields({
        parentId: listingsTableId,
      });

      const loadedDatasets: Dataset[] = [];

      for (const field of dynamicFields.data) {
        const listingId = field.objectId;
        const listingObj = await client.getObject({
          id: listingId,
          options: { showContent: true },
        });

        if (!listingObj.data?.content || listingObj.data.content.dataType !== 'moveObject') {
          continue;
        }

        const listingFields = listingObj.data.content.fields as any;

        if (!listingFields.active) continue;

        loadedDatasets.push({
          id: listingId,
          name: listingFields.name,
          description: listingFields.description,
          category: listingFields.category,
          walrusBlobId: listingFields.walrus_blob_id,
          sizeBytes: parseInt(listingFields.size_bytes),
          price: parseInt(listingFields.price),
          provider: listingFields.provider,
          active: listingFields.active,
          purchaseCount: parseInt(listingFields.purchase_count),
        });
      }

      datasets = loadedDatasets;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load datasets';
      console.error('Error loading datasets:', err);
    } finally {
      loading = false;
    }
  }

  let filteredDatasets = $derived(
    datasets
      .filter((d) => filterCategory === 'all' || d.category === filterCategory)
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'size-asc') return a.sizeBytes - b.sizeBytes;
        if (sortBy === 'size-desc') return b.sizeBytes - a.sizeBytes;
        if (sortBy === 'popular') return b.purchaseCount - a.purchaseCount;
        return 0;
      })
  );

  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
  <title>Nexus — AI Dataset Marketplace</title>
  <meta name="description" content="Decentralized marketplace for AI training datasets stored on Walrus" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
  <!-- Hero Section -->
  <div class="relative overflow-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div class="text-center">
        <h1 class="text-5xl font-bold text-white mb-6">
          Nexus
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            AI Dataset Marketplace
          </span>
        </h1>
        <p class="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
          The first fully decentralized marketplace where AI agents can autonomously
          purchase and ingest their own long-term memory.
        </p>
        <div class="flex justify-center gap-4">
          <a
            href="/upload"
            class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Upload Dataset
          </a>
          <a
            href="#datasets"
            class="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
          >
            Browse Datasets
          </a>
        </div>
      </div>
    </div>

    <!-- Background decoration -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
    </div>
  </div>

  <!-- Stats Bar -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
        <div>
          <div class="text-3xl font-bold text-white">{datasets.length}</div>
          <div class="text-gray-400">Datasets</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-white">
            {datasets.reduce((sum, d) => sum + d.sizeBytes, 0) > 0
              ? formatFileSize(datasets.reduce((sum, d) => sum + d.sizeBytes, 0))
              : '0 Bytes'}
          </div>
          <div class="text-gray-400">Total Data</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-white">
            {datasets.reduce((sum, d) => sum + d.purchaseCount, 0)}
          </div>
          <div class="text-gray-400">Purchases</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-white">100%</div>
          <div class="text-gray-400">Decentralized</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Datasets Section -->
  <div id="datasets" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <!-- Filters -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <h2 class="text-3xl font-bold text-white">Available Datasets</h2>

      <div class="flex flex-wrap gap-4">
        <select
          bind:value={filterCategory}
          class="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {#each categories as cat}
            <option value={cat.value}>{cat.label}</option>
          {/each}
        </select>

        <select
          bind:value={sortBy}
          class="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="size-asc">Size: Small to Large</option>
          <option value="size-desc">Size: Large to Small</option>
          <option value="popular">Most Popular</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    {#if loading}
      <div class="text-center py-20">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p class="text-gray-400">Loading datasets from blockchain...</p>
      </div>

    <!-- Error State -->
    {:else if error}
      <div class="text-center py-20">
        <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md mx-auto">
          <p class="text-red-400 mb-4">{error}</p>
          <button
            onclick={loadDatasets}
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>

    <!-- Empty State -->
    {:else if filteredDatasets.length === 0}
      <div class="text-center py-20">
        <div class="bg-white/5 border border-white/10 rounded-lg p-8 max-w-md mx-auto">
          <svg class="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p class="text-gray-400 mb-2">No datasets found</p>
          <p class="text-gray-500 text-sm">
            {filterCategory !== 'all'
              ? 'Try changing the filter or check back later'
              : 'Be the first to upload a dataset!'}
          </p>
        </div>
      </div>

    <!-- Dataset Grid -->
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each filteredDatasets as dataset}
          <a
            href="/dataset/{dataset.id}"
            class="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-6 transition-all duration-200"
          >
            <!-- Category Badge -->
            <div class="flex justify-between items-start mb-4">
              <span class="px-3 py-1 text-xs font-medium rounded-full {getCategoryColor(dataset.category)}">
                {dataset.category}
              </span>
              <span class="text-gray-500 text-sm">
                {dataset.purchaseCount} {dataset.purchaseCount === 1 ? 'sale' : 'sales'}
              </span>
            </div>

            <!-- Title & Description -->
            <h3 class="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
              {dataset.name}
            </h3>
            <p class="text-gray-400 text-sm mb-4 line-clamp-2">
              {dataset.description.substring(0, 150)}{dataset.description.length > 150 ? '...' : ''}
            </p>

            <!-- Metadata -->
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-500">
                {formatFileSize(dataset.sizeBytes)}
              </span>
              <span class="text-blue-400 font-semibold">
                {formatSui(dataset.price)}
              </span>
            </div>

            <!-- Provider -->
            <div class="mt-4 pt-4 border-t border-white/10">
              <span class="text-gray-500 text-xs">
                Provider: {truncateAddress(dataset.provider)}
              </span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>

  <!-- How It Works Section -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10">
    <h2 class="text-3xl font-bold text-white text-center mb-12">How It Works</h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="text-center">
        <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-white mb-2">1. Upload to Walrus</h3>
        <p class="text-gray-400">
          Upload your AI training data to Walrus decentralized storage.
          Data is replicated across multiple nodes for availability.
        </p>
      </div>

      <div class="text-center">
        <div class="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-white mb-2">2. List on Sui</h3>
        <p class="text-gray-400">
          Create a listing on the Sui blockchain with price and metadata.
          Smart contract handles escrow and access control.
        </p>
      </div>

      <div class="text-center">
        <div class="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-white mb-2">3. Earn SUI</h3>
        <p class="text-gray-400">
          AI agents and developers purchase your data with SUI tokens.
          98% goes to you, 2% platform fee.
        </p>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-white/10">
    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
      <div class="text-gray-500 text-sm">
        © 2026 Nexus. Built on Sui + Walrus + Tatum.
      </div>
      <div class="flex gap-6">
        <a href="https://github.com" class="text-gray-500 hover:text-white transition-colors">
          GitHub
        </a>
        <a href="/upload" class="text-gray-500 hover:text-white transition-colors">
          Upload
        </a>
      </div>
    </div>
  </footer>
</div>
