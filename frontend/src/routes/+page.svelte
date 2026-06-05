<script lang="ts">
  import { onMount } from 'svelte';
  import { queryMarketplaceEvents, getListingFields, readCoinType, MARKETPLACE_ID, formatAmount, coinSymbol } from '$lib/sui/config';
  import { formatFileSize } from '$lib/walrus/client';
  import Mark from '$lib/components/Mark.svelte';

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
    provider: string;
    active: boolean;
    purchaseCount: number;
  }

  let datasets: Dataset[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let filterCategory = $state('all');

  // Cap the grid at two rows (3 columns × 2) and paginate the rest.
  const PAGE_SIZE = 6;
  let currentPage = $state(0);

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'language', label: 'Language' },
    { value: 'vision', label: 'Vision' },
    { value: 'embeddings', label: 'Embeddings' },
    { value: 'fine-tuning', label: 'Fine-Tuning' },
    { value: 'model-weights', label: 'Model Weights' },
  ];

  // vector<u8> seal_policy_id arrives as base64 or number[]; non-empty = encrypted.
  function sealPolicyNonEmpty(seal: unknown): boolean {
    if (Array.isArray(seal)) return seal.length > 0;
    if (typeof seal === 'string') return seal.length > 0;
    return false;
  }

  onMount(async () => {
    await loadDatasets();
  });

  async function loadDatasets() {
    loading = true;
    error = null;

    try {
      // Discover listings via DatasetListed events. queryMarketplaceEvents uses
      // a raw-fetch RPC (Tatum-preferred, public-fullnode fallback) — the SDK
      // client can't be used in-browser because Tatum's CORS rejects its headers.
      const events = await queryMarketplaceEvents(MARKETPLACE_ID, 'DatasetListed', 50);

      // Events only carry the listing's *creation* snapshot (purchase_count is
      // always 0, no `active` flag). Read each listing's LIVE fields — the same
      // source the detail page uses — so cards and the detail view never disagree
      // on purchase count / status. Reads run in parallel; a failed read falls
      // back to the event snapshot so the card still renders.
      const settled = await Promise.all(
        events.map(async (event: any): Promise<Dataset | null> => {
          const parsed = (event.parsedJson || {}) as any;
          const id = parsed.listing_id || '';
          if (!id) return null;

          const fallback: Dataset = {
            id,
            name: parsed.name || 'Unknown',
            description: parsed.description || 'No description available',
            category: parsed.category || 'other',
            walrusBlobId: parsed.walrus_blob_id || '',
            sizeBytes: parseInt(parsed.size_bytes) || 0,
            price: parseInt(parsed.price) || 0,
            coinType: readCoinType(parsed.coin_type),
            encrypted: !!parsed.encrypted,
            provider: parsed.provider || '',
            active: true,
            purchaseCount: 0,
          };

          try {
            const live = await getListingFields(MARKETPLACE_ID, id);
            if (!live) return fallback;
            const f = live.fields;
            return {
              id,
              name: f.name ?? fallback.name,
              description: f.description ?? fallback.description,
              category: f.category ?? fallback.category,
              walrusBlobId: f.walrus_blob_id ?? fallback.walrusBlobId,
              sizeBytes: parseInt(f.size_bytes) || 0,
              price: parseInt(f.price) || 0,
              coinType: readCoinType(f.coin_type),
              encrypted: sealPolicyNonEmpty(f.seal_policy_id),
              provider: f.provider ?? fallback.provider,
              active: f.active ?? true,
              purchaseCount: parseInt(f.purchase_count) || 0,
            };
          } catch {
            return fallback;
          }
        })
      );

      // "Available Datasets" = active listings only (hide delisted ones).
      datasets = settled.filter((d): d is Dataset => d !== null && d.active);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load datasets';
      console.error('Error loading datasets:', err);
    } finally {
      loading = false;
    }
  }

  let filteredDatasets = $derived(
    filterCategory === 'all'
      ? datasets
      : datasets.filter((d) => d.category === filterCategory)
  );

  let totalPages = $derived(Math.max(1, Math.ceil(filteredDatasets.length / PAGE_SIZE)));

  // Clamp the page whenever the filtered set shrinks (e.g. after switching filter).
  let safePage = $derived(Math.min(currentPage, totalPages - 1));

  let pagedDatasets = $derived(
    filteredDatasets.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  );

  function selectFilter(value: string) {
    filterCategory = value;
    currentPage = 0;
  }

  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
</script>

<svelte:head>
  <title>Nexus — AI Dataset Marketplace</title>
  <meta name="description" content="Decentralized marketplace for AI training datasets stored on Walrus" />
</svelte:head>

<!-- Hero Section -->
<section class="hero">
  <div class="hero__glow"></div>
  <div class="hero__inner">
    <div class="hero__grid">
      <div>
        <h1 class="hero__title">
          Memory, for
          <br />
          machines that
          <br />
          <span class="hero__title-accent">need it.</span>
        </h1>
        <p class="hero__sub">
          Upload AI training datasets to Walrus decentralized storage. List them on Sui.
          Let autonomous agents discover, evaluate, and purchase them through MCP.
        </p>
        <div class="hero__actions">
          <a href="/upload" class="btn btn--primary">
            Upload Dataset &rarr;
          </a>
          <a href="#datasets" class="btn btn--ghost">
            Browse Marketplace
          </a>
        </div>
      </div>

      <div class="hero-card">
        <div class="hero-card__header">
          <span class="hero-card__label">DATASET &middot; LISTING</span>
          <span class="hero-card__badge">
            <span class="hero-card__badge-dot"></span>
            agent-ready
          </span>
        </div>

        <div class="hero-card__name">dialog-corpus-v9</div>
        <div class="hero-card__meta">2.4M turns &middot; 14 languages &middot; 99.1% verified</div>

        <div class="hero-card__rows">
          {#each [['Storage', 'Walrus &middot; 0x9f3a&hellip;'], ['Quality score', '0.94 / 1.00'], ['License', 'Commercial &middot; perpetual']] as [key, val]}
            <div class="hero-card__row">
              <span class="hero-card__row-key">{key}</span>
              <span class="hero-card__row-val">{@html val}</span>
            </div>
          {/each}
        </div>

        <div class="hero-card__footer">
          <div>
            <div class="hero-card__price-label">PRICE</div>
            <div class="hero-card__price">
              420 <span class="hero-card__price-unit">SUI</span>
            </div>
          </div>
          <!-- Static illustration of a listing — not a real control. -->
          <span class="hero-card__cta-demo">Purchase access</span>
        </div>

        <div class="hero-card__mark">
          <Mark size={34} stroke="var(--line)" accent="var(--accent-soft)" weight={2} />
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Powered By -->
<div class="powered-by">
  <div class="powered-by__inner">
    <div class="powered-by__item">
      <span class="powered-by__dot"></span>
      Built on Sui
    </div>
    <div class="powered-by__item">
      <span class="powered-by__dot"></span>
      Storage by Walrus
    </div>
    <div class="powered-by__item">
      <span class="powered-by__dot"></span>
      Agent access via Tatum MCP
    </div>
    <div class="powered-by__item">
      <span class="powered-by__dot"></span>
      Settlement On-chain
    </div>
  </div>
</div>

<!-- Datasets Section -->
<section id="datasets" class="section marketplace">
  <div class="container">
    <div class="marketplace__header">
      <div>
        <h2 class="marketplace__title">Available Datasets</h2>
        <p class="marketplace__sub">High-quality AI training data stored on Walrus</p>
      </div>

      <div class="marketplace__filters">
        {#each categories as cat}
          <button
            class="marketplace__filter {filterCategory === cat.value ? 'marketplace__filter--active' : ''}"
            onclick={() => selectFilter(cat.value)}
          >
            {cat.label}
          </button>
        {/each}
      </div>
    </div>

    {#if loading}
      <div style="text-align: center; padding: 96px 0;">
        <p style="font-family: var(--mono); color: var(--dim);">Loading datasets from blockchain...</p>
      </div>

    {:else if error}
      <div style="text-align: center; padding: 96px 0;">
        <div class="alert alert--error" style="max-width: 400px; margin: 0 auto;">
          <p>{error}</p>
          <button class="btn btn--ghost btn--sm" style="margin-top: 16px;" onclick={loadDatasets}>
            Try Again
          </button>
        </div>
      </div>

    {:else if filteredDatasets.length === 0}
      <div style="text-align: center; padding: 96px 0;">
        <p style="font-family: var(--mono); color: var(--dim);">
          {filterCategory !== 'all'
            ? 'No datasets in this category. Try changing the filter.'
            : 'No datasets yet. Be the first to upload!'}
        </p>
      </div>

    {:else}
      <div class="marketplace__grid">
        {#each pagedDatasets as dataset}
          <a href="/dataset/{dataset.id}" class="dataset-card">
            <div class="dataset-card__header">
              <span class="dataset-card__tag">{dataset.category}</span>
              <span class="dataset-card__ready">
                <span class="dataset-card__ready-dot"></span>
                agent-ready
              </span>
            </div>

            <div class="dataset-card__name">{dataset.name}</div>
            <div class="dataset-card__meta">
              {formatFileSize(dataset.sizeBytes)} &middot; {dataset.purchaseCount} {dataset.purchaseCount === 1 ? 'sale' : 'sales'}
            </div>

            <div class="dataset-card__divider"></div>

            <div class="dataset-card__footer">
              <span class="dataset-card__quality">
                {dataset.encrypted ? '🔒 Encrypted' : '🔓 Open'}
              </span>
              <span class="dataset-card__price">
                {formatAmount(dataset.price, dataset.coinType).split(' ')[0]}
                <span class="dataset-card__price-unit">{coinSymbol(dataset.coinType)}</span>
              </span>
            </div>
          </a>
        {/each}
      </div>

      {#if totalPages > 1}
        <div class="marketplace__pagination">
          <button
            class="btn btn--ghost btn--sm"
            onclick={() => { currentPage = Math.max(0, safePage - 1); }}
            disabled={safePage === 0}
          >
            &larr; Prev
          </button>
          <span class="marketplace__page-info">
            Page {safePage + 1} of {totalPages}
            <span style="color: var(--faint);">&middot; {filteredDatasets.length} datasets</span>
          </span>
          <button
            class="btn btn--ghost btn--sm"
            onclick={() => { currentPage = Math.min(totalPages - 1, safePage + 1); }}
            disabled={safePage >= totalPages - 1}
          >
            Next &rarr;
          </button>
        </div>
      {/if}
    {/if}
  </div>
</section>

<!-- How It Works -->
<section class="section">
  <div class="container">
    <div style="text-align: center; margin-bottom: var(--sp-7);">
      <h2 style="font-family: var(--sans); font-weight: 600; font-size: 42px; line-height: 1.04; letter-spacing: -0.032em;">
        How It Works
      </h2>
      <p style="font-family: var(--mono); font-size: 14.5px; color: var(--dim); margin-top: 12px;">
        Three steps to a fully decentralized AI data marketplace
      </p>
    </div>

    <div class="steps">
      <div class="step">
        <div class="step__number">1</div>
        <h3 class="step__title">Upload to Walrus</h3>
        <p class="step__desc">
          Store your AI training data on Walrus decentralized storage with erasure coding across multiple nodes.
        </p>
      </div>

      <div class="step">
        <div class="step__number">2</div>
        <h3 class="step__title">List on Sui</h3>
        <p class="step__desc">
          Create an on-chain listing with price and metadata. Smart contracts handle escrow and access control.
        </p>
      </div>

      <div class="step">
        <div class="step__number">3</div>
        <h3 class="step__title">Earn SUI</h3>
        <p class="step__desc">
          AI agents and developers purchase your data with SUI tokens. You receive 98% of every sale.
        </p>
      </div>
    </div>
  </div>
</section>

<!-- Stats -->
<section class="section stats">
  <div class="container">
    <div class="stats__grid">
      <div>
        <div class="stats__value">{datasets.length}+</div>
        <div class="stats__label">Datasets Listed</div>
      </div>
      <div>
        <div class="stats__value">
          {datasets.length > 0 ? formatFileSize(datasets.reduce((sum, d) => sum + d.sizeBytes, 0)) : '0 B'}
        </div>
        <div class="stats__label">Total Data</div>
      </div>
      <div>
        <div class="stats__value">{datasets.reduce((sum, d) => sum + d.purchaseCount, 0)}</div>
        <div class="stats__label">Purchases</div>
      </div>
      <div>
        <div class="stats__value">100%</div>
        <div class="stats__label">Decentralized</div>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="section cta">
  <div class="cta__glow"></div>
  <div class="container cta__inner">
    <div style="margin-bottom: var(--sp-5);">
      <Mark size={40} stroke="var(--fg)" accent="var(--accent)" weight={1.8} />
    </div>
    <h2 class="cta__title">The memory layer for the agent economy</h2>
    <p class="cta__sub">
      Start uploading datasets or integrate your AI agent with the Nexus MCP server today.
    </p>
    <div class="cta__actions">
      <a href="/upload" class="btn btn--primary">Upload Dataset &rarr;</a>
      <a href="https://github.com/Manuel-dev01/nexus/tree/master/docs" target="_blank" rel="noopener noreferrer" class="btn btn--ghost">For developers</a>
    </div>
  </div>
</section>
