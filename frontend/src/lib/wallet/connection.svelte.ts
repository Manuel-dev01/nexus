/**
 * Shared, reactive wallet-connection state (Svelte 5 runes singleton).
 *
 * The nav, upload page, and dataset page all read/write this one instance, so
 * connecting is a single explicit step that every screen reflects. This replaces
 * the previous pattern where each page silently called `connectWallet()` inside
 * its action handler — which, when the wallet had a persisted authorization,
 * resolved with no visible prompt and made purchases/downloads look like they
 * happened "without connecting."
 */

import {
  detectWallets,
  connectWallet as adapterConnect,
  disconnectWallet as adapterDisconnect,
  type WalletInfo,
} from './store';

class WalletConnection {
  address = $state<string | null>(null);
  walletName = $state<string | null>(null);
  connecting = $state(false);
  error = $state<string | null>(null);
  wallet = $state<WalletInfo | null>(null);

  /** True only after an explicit, successful in-app connection. */
  get connected(): boolean {
    return this.address !== null;
  }

  /** Installed Sui wallets (re-detected each call). */
  list(): WalletInfo[] {
    return detectWallets();
  }

  /** Explicitly connect. Defaults to the first installed wallet. */
  async connect(target?: WalletInfo): Promise<string> {
    const wallets = detectWallets();
    if (wallets.length === 0) {
      this.error = 'No Sui wallet detected. Install Sui Wallet or Slush to continue.';
      throw new Error(this.error);
    }
    const w = target ?? wallets[0];
    this.connecting = true;
    this.error = null;
    try {
      const addr = await adapterConnect(w);
      this.address = addr;
      this.walletName = w.name;
      this.wallet = w;
      return addr;
    } catch (e: any) {
      this.error = e?.message || 'Failed to connect wallet';
      throw e;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.wallet) {
      try {
        await adapterDisconnect(this.wallet);
      } catch {
        // ignore — we clear local state regardless
      }
    }
    this.address = null;
    this.walletName = null;
    this.wallet = null;
  }
}

export const walletConn = new WalletConnection();
