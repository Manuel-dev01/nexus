<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Nexus — AI Dataset Marketplace</title>
	<meta name="description" content="Decentralized marketplace for AI training datasets stored on Walrus" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="noise-overlay"></div>

<!-- Navigation -->
<nav class="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between items-center h-16">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-3 group">
				<div class="relative">
					<div class="w-9 h-9 bg-gradient-to-br from-nexus-500 via-tatum-500 to-walrus-500 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
						<span class="text-white font-bold text-sm tracking-tight">N</span>
					</div>
					<div class="absolute -inset-1 bg-gradient-to-br from-nexus-500 via-tatum-500 to-walrus-500 rounded-xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-300"></div>
				</div>
				<span class="text-white font-bold text-xl tracking-tight">Nexus</span>
			</a>

			<!-- Navigation Links -->
			<div class="flex items-center gap-8">
				<a href="/" class="text-sm text-slate-400 hover:text-white transition-colors duration-200 font-medium">
					Marketplace
				</a>
				<a href="/upload" class="text-sm text-slate-400 hover:text-white transition-colors duration-200 font-medium">
					Upload
				</a>
				<button class="btn-primary text-sm !py-2 !px-5">
					Connect Wallet
				</button>
			</div>
		</div>
	</div>
</nav>

<main class="pt-16">
	{@render children()}
</main>
