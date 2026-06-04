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

      const marketplace = await client.getObject({
        id: MARKETPLACE_ID,
        options: { showContent: true },
      });

      if (!marketplace.data?.content || marketplace.data.content.dataType !== 'moveObject') {
        throw new Error('Failed to fetch marketplace');
      }

      const fields = marketplace.data.content.fields as any;
      const listingsTableId = fields.listings.fields.id.id;

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
  <title>Nexus — AI Dataset Marketplace</title>
  <meta name="description" content="Decentralized marketplace for AI training datasets stored on Walrus" />
</svelte:head>

<div class="gradient-bg min-h-screen">
  <!-- Hero Section -->
  <section class="relative overflow-hidden">
    <!-- Background orbs -->
    <div class="orb orb-nexus w-96 h-96 -top-48 -left-48" style="animation-delay: 0s;"></div>
    <div class="orb orb-tatum w-80 h-80 top-20 right-20" style="animation-delay: 2s;"></div>
    <div class="orb orb-walrus w-72 h-72 bottom-0 left-1/3" style="animation-delay: 4s;"></div>

    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
      <div class="text-center max-w-4xl mx-auto">
        <!-- Pill badge -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-in">
          <span class="w-2 h-2 rounded-full bg-walrus-500 animate-pulse"></span>
          <span class="text-sm text-slate-400">Live on Sui Testnet</span>
        </div>

        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8 animate-in stagger-1">
          The Marketplace Where
          <br />
          <span class="gradient-text">AI Agents Buy Memory</span>
        </h1>

        <p class="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-12 text-balance animate-in stagger-2">
          Upload AI training datasets to Walrus decentralized storage. List them on Sui.
          Let autonomous agents discover, evaluate, and purchase them through MCP.
        </p>

        <div class="flex flex-col sm:flex-row justify-center gap-4 animate-in stagger-3">
          <a href="/upload" class="btn-primary text-base">
            Upload Dataset
          </a>
          <a href="#datasets" class="btn-secondary text-base">
            Browse Marketplace
          </a>
        </div>
      </div>
    </div>

    <!-- Gradient divider -->
    <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-nexus-500/30 to-transparent"></div>
  </section>

  <!-- Stats Bar -->
  <section class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 mb-20">
    <div class="glass rounded-2xl p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
      <div class="text-center">
        <div class="text-3xl font-bold gradient-text mb-1">{datasets.length}</div>
        <div class="text-sm text-slate-500">Datasets Listed</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-bold gradient-text mb-1">
          {datasets.length > 0 ? formatFileSize(datasets.reduce((sum, d) => sum + d.sizeBytes, 0)) : '0 B'}
        </div>
        <div class="text-sm text-slate-500">Total Data</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-bold gradient-text mb-1">
          {datasets.reduce((sum, d) => sum + d.purchaseCount, 0)}
        </div>
        <div class="text-sm text-slate-500">Purchases</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-bold gradient-text mb-1">100%</div>
        <div class="text-sm text-slate-500">Decentralized</div>
      </div>
    </div>
  </section>

  <!-- Datasets Section -->
  <section id="datasets" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
    <!-- Section Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
      <div>
        <h2 class="text-3xl font-bold tracking-tight mb-2">Available Datasets</h2>
        <p class="text-slate-500">High-quality AI training data stored on Walrus</p>
      </div>

      <div class="flex flex-wrap gap-3">
        <select
          bind:value={filterCategory}
          class="input-field !w-auto !py-2 text-sm"
        >
          {#each categories as cat}
            <option value={cat.value}>{cat.label}</option>
          {/each}
        </select>

        <select
          bind:value={sortBy}
          class="input-field !w-auto !py-2 text-sm"
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
      <div class="text-center py-32">
        <div class="inline-block w-12 h-12 border-2 border-nexus-500/30 border-t-nexus-500 rounded-full animate-spin mb-4"></div>
        <p class="text-slate-500">Loading datasets from blockchain...</p>
      </div>

    <!-- Error State -->
    {:else if error}
      <div class="text-center py-32">
        <div class="glass rounded-2xl p-8 max-w-md mx-auto">
          <div class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p class="text-slate-400 mb-6">{error}</p>
          <button onclick={loadDatasets} class="btn-primary text-sm">
            Try Again
          </button>
        </div>
      </div>

    <!-- Empty State -->
    {:else if filteredDatasets.length === 0}
      <div class="text-center py-32">
        <div class="glass rounded-2xl p-8 max-w-md mx-auto">
          <div class="w-16 h-16 rounded-2xl bg-nexus-500/10 flex items-center justify-center mx-auto mb-6">
            <svg class="w-8 h-8 text-nexus-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-2">No datasets found</h3>
          <p class="text-slate-500 text-sm">
            {filterCategory !== 'all'
              ? 'Try changing the filter or check back later'
              : 'Be the first to upload a dataset!'}
          </p>
        </div>
      </div>

    <!-- Dataset Grid -->
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each filteredDatasets as dataset, i}
          <a
            href="/dataset/{dataset.id}"
            class="group glass glass-hover rounded-2xl p-6 animate-in stagger-{Math.min(i + 1, 5)}"
          >
            <!-- Category Badge -->
            <div class="flex justify-between items-start mb-5">
              <span class="{getCategoryBadge(dataset.category)}">
                {dataset.category}
              </span>
              <span class="text-xs text-slate-600">
                {dataset.purchaseCount} {dataset.purchaseCount === 1 ? 'sale' : 'sales'}
              </span>
            </div>

            <!-- Title & Description -->
            <h3 class="text-lg font-semibold text-white mb-3 group-hover:text-nexus-400 transition-colors duration-200">
              {dataset.name}
            </h3>
            <p class="text-sm text-slate-500 mb-5 line-clamp-2 leading-relaxed">
              {dataset.description}
            </p>

            <!-- Metadata -->
            <div class="flex justify-between items-center text-sm mb-5">
              <span class="text-slate-600 font-mono text-xs">
                {formatFileSize(dataset.sizeBytes)}
              </span>
              <span class="text-nexus-400 font-semibold">
                {formatSui(dataset.price)}
              </span>
            </div>

            <!-- Provider -->
            <div class="pt-4 border-t border-white/5">
              <span class="text-xs text-slate-600 font-mono">
                {truncateAddress(dataset.provider)}
              </span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </section>

  <!-- How It Works Section -->
  <section class="relative border-t border-white/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold tracking-tight mb-4">How It Works</h2>
        <p class="text-slate-500 max-w-xl mx-auto">Three steps to a fully decentralized AI data marketplace</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Step 1 -->
        <div class="glass rounded-2xl p-8 text-center relative group hover:border-nexus-500/20 transition-colors duration-300">
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-nexus-600 flex items-center justify-center text-sm font-bold">
            1
          </div>
          <div class="w-16 h-16 rounded-2xl bg-nexus-500/10 flex items-center justify-center mx-auto mb-6 mt-4">
            <svg class="w-8 h-8 text-nexus-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-3">Upload to Walrus</h3>
          <p class="text-slate-500 text-sm leading-relaxed">
            Store your AI training data on Walrus decentralized storage with erasure coding across multiple nodes.
          </p>
        </div>

        <!-- Step 2 -->
        <div class="glass rounded-2xl p-8 text-center relative group hover:border-tatum-500/20 transition-colors duration-300">
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-tatum-600 flex items-center justify-center text-sm font-bold">
            2
          </div>
          <div class="w-16 h-16 rounded-2xl bg-tatum-500/10 flex items-center justify-center mx-auto mb-6 mt-4">
            <svg class="w-8 h-8 text-tatum-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-3">List on Sui</h3>
          <p class="text-slate-500 text-sm leading-relaxed">
            Create an on-chain listing with price and metadata. Smart contracts handle escrow and access control.
          </p>
        </div>

        <!-- Step 3 -->
        <div class="glass rounded-2xl p-8 text-center relative group hover:border-walrus-500/20 transition-colors duration-300">
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-walrus-600 flex items-center justify-center text-sm font-bold">
            3
          </div>
          <div class="w-16 h-16 rounded-2xl bg-walrus-500/10 flex items-center justify-center mx-auto mb-6 mt-4">
            <svg class="w-8 h-8 text-walrus-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-3">Earn SUI</h3>
          <p class="text-slate-500 text-sm leading-relaxed">
            AI agents and developers purchase your data with SUI tokens. You receive 98% of every sale.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-white/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex flex-col md:flex-row justify-between items-center gap-8">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-gradient-to-br from-nexus-500 via-tatum-500 to-walrus-500 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-sm">N</span>
          </div>
          <span class="text-slate-500 text-sm">
            Built on Sui + Walrus + Tatum
          </span>
        </div>
        <div class="flex gap-8">
          <a href="https://github.com/Manuel-dev01/nexus" class="text-sm text-slate-600 hover:text-white transition-colors">
            GitHub
          </a>
          <a href="/upload" class="text-sm text-slate-600 hover:text-white transition-colors">
            Upload
          </a>
        </div>
      </div>
    </div>
  </footer>
</div>
