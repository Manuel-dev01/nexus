<script lang="ts">
	import '../app.css';
	import Mark from '$lib/components/Mark.svelte';
	import { onMount } from 'svelte';
	import {
		detectWallets,
		connectWallet,
		disconnectWallet,
		truncateAddress,
		type WalletInfo
	} from '$lib/wallet/store';
	import { explorerObject, PACKAGE_ID, MARKETPLACE_ID } from '$lib/sui/config';

	let { children } = $props();

	let scrolled = $state(false);
	let mobileMenuOpen = $state(false);
	let walletAddress: string | null = $state(null);
	let walletName: string | null = $state(null);
	let walletConnecting = $state(false);
	let walletError: string | null = $state(null);
	let availableWallets: WalletInfo[] = $state([]);
	let showWalletMenu = $state(false);

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 12;
		};
		window.addEventListener('scroll', onScroll, { passive: true });

		// Detect installed wallets
		availableWallets = detectWallets();

		return () => window.removeEventListener('scroll', onScroll);
	});

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
		// Prevent body scroll when menu is open
		if (typeof document !== 'undefined') {
			document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
		}
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	}

	async function handleConnect(wallet: WalletInfo) {
		walletConnecting = true;
		walletError = null;
		showWalletMenu = false;
		closeMobileMenu();

		try {
			const address = await connectWallet(wallet);
			walletAddress = address;
			walletName = wallet.name;
		} catch (err: any) {
			walletError = err.message || 'Failed to connect wallet';
			console.error('Wallet connection failed:', err);
		} finally {
			walletConnecting = false;
		}
	}

	async function handleDisconnect() {
		if (availableWallets.length > 0 && walletName) {
			const wallet = availableWallets.find(w => w.name === walletName);
			if (wallet) {
				await disconnectWallet(wallet);
			}
		}
		walletAddress = null;
		walletName = null;
		closeMobileMenu();
	}

	function toggleWalletMenu() {
		showWalletMenu = !showWalletMenu;
	}

	// Close wallet menu when clicking outside
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.wallet-dropdown')) {
			showWalletMenu = false;
		}
	}
</script>

<svelte:head>
	<title>Nexus — AI Dataset Marketplace</title>
	<meta name="description" content="Decentralized marketplace for AI training datasets stored on Walrus" />
</svelte:head>

<svelte:window onclick={handleClickOutside} />

<!-- Navigation -->
<header class="nav {scrolled ? 'nav--scrolled' : ''}">
	<div class="nav__inner">
		<a href="/" class="nav__logo" onclick={closeMobileMenu}>
			<Mark size={26} stroke="var(--fg)" accent="var(--accent)" weight={1.9} />
			<span class="nav__logo-text">Nexus</span>
		</a>

		<nav class="nav__links">
			<a href="/" class="nav__link">Marketplace</a>
			<a href="/upload" class="nav__link">Sell Data</a>
		</nav>

		<div class="nav__right">
			{#if walletAddress}
				<button class="btn btn--ghost btn--sm nav__wallet-btn" onclick={handleDisconnect}>
					{walletName ? `${walletName} · ` : ''}{truncateAddress(walletAddress)}
				</button>
			{:else}
				<div class="wallet-dropdown">
					<button
						class="btn btn--primary btn--sm nav__wallet-btn"
						onclick={availableWallets.length === 1
							? () => handleConnect(availableWallets[0])
							: toggleWalletMenu}
						disabled={walletConnecting}
					>
						{walletConnecting ? 'Connecting...' : 'Connect Wallet'}
					</button>

					{#if showWalletMenu && availableWallets.length > 1}
						<div class="wallet-dropdown__menu">
							{#each availableWallets as wallet}
								<button
									class="wallet-dropdown__item"
									onclick={() => handleConnect(wallet)}
								>
									{#if wallet.icon}
										<img src={wallet.icon} alt="" class="wallet-dropdown__icon" />
									{/if}
									<span>{wallet.name}</span>
								</button>
							{/each}
						</div>
					{/if}

					{#if availableWallets.length === 0 && showWalletMenu}
						<div class="wallet-dropdown__menu">
							<div class="wallet-dropdown__empty">
								No Sui wallet detected.<br />
								<a href="https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil" target="_blank" rel="noopener">
									Install Sui Wallet
								</a>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Mobile burger button -->
			<button
				class="nav__burger"
				onclick={toggleMobileMenu}
				aria-label="Toggle menu"
				aria-expanded={mobileMenuOpen}
			>
				<span class="nav__burger-line" class:nav__burger-line--open={mobileMenuOpen}></span>
				<span class="nav__burger-line" class:nav__burger-line--open={mobileMenuOpen}></span>
				<span class="nav__burger-line" class:nav__burger-line--open={mobileMenuOpen}></span>
			</button>
		</div>
	</div>
</header>

<!-- Mobile Menu Overlay -->
{#if mobileMenuOpen}
	<div class="mobile-menu" role="dialog" aria-label="Navigation menu">
		<div
			class="mobile-menu__backdrop"
			role="button"
			tabindex="0"
			aria-label="Close navigation menu"
			onclick={closeMobileMenu}
			onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') closeMobileMenu(); }}
		></div>
		<div class="mobile-menu__panel">
			<div class="mobile-menu__header">
				<a href="/" class="nav__logo" onclick={closeMobileMenu}>
					<Mark size={26} stroke="var(--fg)" accent="var(--accent)" weight={1.9} />
					<span class="nav__logo-text">Nexus</span>
				</a>
				<button class="mobile-menu__close" onclick={closeMobileMenu} aria-label="Close menu">
					&times;
				</button>
			</div>

			<nav class="mobile-menu__nav">
				<a href="/" class="mobile-menu__link" onclick={closeMobileMenu}>Marketplace</a>
				<a href="/upload" class="mobile-menu__link" onclick={closeMobileMenu}>Sell Data</a>
			</nav>

			<div class="mobile-menu__wallet">
				{#if walletAddress}
					<button class="btn btn--ghost" onclick={handleDisconnect} style="width: 100%; justify-content: center;">
						{walletName ? `${walletName} · ` : ''}{truncateAddress(walletAddress)}
					</button>
				{:else}
					{#each availableWallets as wallet}
						<button
							class="btn btn--primary"
							onclick={() => handleConnect(wallet)}
							disabled={walletConnecting}
							style="width: 100%; justify-content: center;"
						>
							{walletConnecting ? 'Connecting...' : `Connect ${wallet.name}`}
						</button>
					{/each}
					{#if availableWallets.length === 0}
						<a href="https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil" target="_blank" rel="noopener" class="btn btn--ghost" style="width: 100%; justify-content: center;">
							Install Sui Wallet
						</a>
					{/if}
				{/if}
			</div>

			<div class="mobile-menu__footer">
				<p class="mobile-menu__footer-text">
					Decentralized AI dataset marketplace<br />built on Sui + Walrus
				</p>
			</div>
		</div>
	</div>
{/if}

{#if walletError}
	<div class="wallet-error">
		{walletError}
		<button onclick={() => walletError = null}>&times;</button>
	</div>
{/if}

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
				</div>
			</div>

			<div class="footer__col">
				<div class="footer__col-heading">Developers</div>
				<div class="footer__col-items">
					<a href="https://github.com/Manuel-dev01/nexus" class="footer__link">GitHub</a>
					<a href="https://docs.wal.app" class="footer__link">Walrus Docs</a>
					<a href="https://docs.sui.io" class="footer__link">Sui Docs</a>
				</div>
			</div>

			<div class="footer__col">
				<div class="footer__col-heading">Protocol</div>
				<div class="footer__col-items">
					<a href={explorerObject(PACKAGE_ID)} target="_blank" rel="noopener noreferrer" class="footer__link">Contract on Suiscan</a>
					<a href={explorerObject(MARKETPLACE_ID)} target="_blank" rel="noopener noreferrer" class="footer__link">Marketplace on Suiscan</a>
					<a href="https://aggregator.walrus-testnet.walrus.space" target="_blank" rel="noopener noreferrer" class="footer__link">Walrus Aggregator</a>
				</div>
			</div>

			<div class="footer__col">
				<div class="footer__col-heading">Company</div>
				<div class="footer__col-items">
					<a href="https://github.com/Manuel-dev01/nexus" class="footer__link">GitHub</a>
				</div>
			</div>
		</div>

		<div class="footer__bottom">
			<span class="footer__copy">&copy; 2026 Nexus Protocol &middot; Settled on Sui</span>
			<div class="footer__bottom-links">
				<a href="https://github.com/Manuel-dev01/nexus">GitHub</a>
			</div>
		</div>
	</div>
</footer>
