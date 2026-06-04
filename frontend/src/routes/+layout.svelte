<script lang="ts">
	import '../app.css';
	import Mark from '$lib/components/Mark.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	let scrolled = $state(false);

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 12;
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<svelte:head>
	<title>Nexus — AI Dataset Marketplace</title>
	<meta name="description" content="Decentralized marketplace for AI training datasets stored on Walrus" />
</svelte:head>

<!-- Navigation -->
<header class="nav {scrolled ? 'nav--scrolled' : ''}">
	<div class="nav__inner">
		<a href="/" class="nav__logo">
			<Mark size={26} stroke="var(--fg)" accent="var(--accent)" weight={1.9} />
			<span class="nav__logo-text">Nexus</span>
		</a>

		<nav class="nav__links">
			<a href="/" class="nav__link">Marketplace</a>
			<a href="/upload" class="nav__link">Sell Data</a>
		</nav>

		<div class="nav__right">
			<button class="btn btn--primary btn--sm">Connect Wallet</button>
		</div>
	</div>
</header>

<main>
	{@render children()}
</main>

<!-- Footer -->
<footer class="footer">
	<div class="footer__inner">
		<div class="footer__grid">
			<div class="footer__brand">
				<div class="footer__logo">
					<Mark size={26} stroke="var(--on-dark)" accent="var(--accent-bright)" weight={1.9} />
					<span class="footer__logo-text">Nexus</span>
				</div>
				<p class="footer__desc">
					A decentralized AI model and memory marketplace, built natively on Sui.
				</p>
			</div>

			<div class="footer__col">
				<div class="footer__col-heading">Product</div>
				<div class="footer__col-items">
					<a href="/" class="footer__link">Marketplace</a>
					<a href="/upload" class="footer__link">Sell data</a>
					<a href="#" class="footer__link">Pricing</a>
					<a href="#" class="footer__link">Quality scores</a>
				</div>
			</div>

			<div class="footer__col">
				<div class="footer__col-heading">Developers</div>
				<div class="footer__col-items">
					<a href="#" class="footer__link">MCP server</a>
					<a href="#" class="footer__link">API reference</a>
					<a href="#" class="footer__link">SDK</a>
					<a href="#" class="footer__link">Status</a>
				</div>
			</div>

			<div class="footer__col">
				<div class="footer__col-heading">Protocol</div>
				<div class="footer__col-items">
					<a href="#" class="footer__link">Sui contracts</a>
					<a href="#" class="footer__link">Walrus storage</a>
					<a href="#" class="footer__link">Audits</a>
					<a href="#" class="footer__link">Tokenomics</a>
				</div>
			</div>

			<div class="footer__col">
				<div class="footer__col-heading">Company</div>
				<div class="footer__col-items">
					<a href="#" class="footer__link">About</a>
					<a href="#" class="footer__link">Blog</a>
					<a href="#" class="footer__link">Careers</a>
					<a href="#" class="footer__link">Contact</a>
				</div>
			</div>
		</div>

		<div class="footer__bottom">
			<span class="footer__copy">&copy; 2026 Nexus Protocol &middot; Settled on Sui</span>
			<div class="footer__bottom-links">
				<a href="#">Privacy</a>
				<a href="#">Terms</a>
				<a href="https://github.com/Manuel-dev01/nexus">GitHub</a>
			</div>
		</div>
	</div>
</footer>
