<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Nexus — AI Dataset Marketplace</title>
	<meta name="description" content="Decentralized marketplace for AI training datasets stored on Walrus" />
</svelte:head>

<!-- Navigation -->
<nav class="bg-gray-900/80 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between items-center h-16">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-2">
				<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
					<span class="text-white font-bold text-sm">N</span>
				</div>
				<span class="text-white font-bold text-xl">Nexus</span>
			</a>

			<!-- Navigation Links -->
			<div class="flex items-center gap-6">
				<a href="/" class="text-gray-400 hover:text-white transition-colors">
					Marketplace
				</a>
				<a href="/upload" class="text-gray-400 hover:text-white transition-colors">
					Upload
				</a>
				<button
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
				>
					Connect Wallet
				</button>
			</div>
		</div>
	</div>
</nav>

{@render children()}
