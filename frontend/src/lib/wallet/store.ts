/**
 * Sui Wallet Store for Svelte
 *
 * Uses the Sui Wallet Standard (@mysten/wallet-standard) to detect
 * and connect to installed Sui wallets (Sui Wallet, Suiet, Martian, etc.).
 *
 * This is framework-agnostic — works with Svelte 5 runes via $state.
 */

import { getWallets, type WalletWithFeatures } from '@mysten/wallet-standard';
import type { SuiSignAndExecuteTransactionFeature } from '@mysten/wallet-standard';
import type { ConnectFeature, DisconnectFeature } from '@mysten/wallet-standard';
import { Transaction } from '@mysten/sui/transactions';

// === Types ===

export interface WalletInfo {
  name: string;
  icon: string;
  adapter: WalletWithFeatures<
    ConnectFeature & DisconnectFeature & SuiSignAndExecuteTransactionFeature
  >;
}

export interface WalletState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  walletName: string | null;
  error: string | null;
}

// === Wallet Detection ===

/**
 * Get all installed Sui wallets that support the wallet standard.
 */
export function detectWallets(): WalletInfo[] {
  const walletApi = getWallets();
  const wallets = walletApi.get();

  return wallets
    .filter((w) => {
      // Must support connect and signAndExecuteTransaction
      const features = w.features as any;
      return features['standard:connect'] && features['sui:signAndExecuteTransaction'];
    })
    .map((w) => ({
      name: w.name,
      icon: typeof w.icon === 'string' ? w.icon : '',
      adapter: w as any,
    }));
}

// === Connection ===

/**
 * Connect to a wallet and return the address.
 */
export async function connectWallet(wallet: WalletInfo): Promise<string> {
  const connectFeature = wallet.adapter.features['standard:connect'] as any;
  if (!connectFeature) {
    throw new Error(`Wallet ${wallet.name} does not support connect`);
  }

  const result = await connectFeature.connect();
  const accounts = result.accounts;

  if (!accounts || accounts.length === 0) {
    throw new Error(`No accounts found in wallet ${wallet.name}`);
  }

  return accounts[0].address;
}

/**
 * Disconnect from a wallet.
 */
export async function disconnectWallet(wallet: WalletInfo): Promise<void> {
  const disconnectFeature = wallet.adapter.features['standard:disconnect'] as any;
  if (disconnectFeature) {
    await disconnectFeature.disconnect();
  }
}

// === Transaction Signing ===

/**
 * Sign and execute a transaction using the connected wallet.
 *
 * @param wallet - The connected wallet info
 * @param tx - The Transaction to sign and execute
 * @returns The transaction result
 */
export async function signAndExecuteTransaction(
  wallet: WalletInfo,
  tx: Transaction
): Promise<any> {
  const signFeature = wallet.adapter.features['sui:signAndExecuteTransaction'] as any;
  if (!signFeature) {
    throw new Error(`Wallet ${wallet.name} does not support signAndExecuteTransaction`);
  }

  // The Wallet-Standard feature REQUIRES the signing account — the adapter reads
  // `account.address` internally, so passing `undefined` throws
  // "Cannot read properties of undefined (reading 'address')". After connect, the
  // wallet exposes the authorized accounts on the adapter.
  const account = (wallet.adapter as any).accounts?.[0];
  if (!account) {
    throw new Error('No connected account — please connect your wallet first.');
  }

  const result = await signFeature.signAndExecuteTransaction({
    transaction: tx,
    account,
    chain: 'sui:testnet',
  });

  return result;
}

/**
 * Sign a personal message with the connected wallet (used to authorize a Seal
 * SessionKey). Returns the base64 signature.
 */
export async function signPersonalMessage(
  wallet: WalletInfo,
  message: Uint8Array
): Promise<{ signature: string }> {
  const feature = (wallet.adapter as any).features['sui:signPersonalMessage'];
  if (!feature) {
    throw new Error(`Wallet ${wallet.name} does not support signPersonalMessage`);
  }
  const account = (wallet.adapter as any).accounts?.[0];
  if (!account) {
    throw new Error('No connected account — please connect your wallet first.');
  }
  const result = await feature.signPersonalMessage({ message, account });
  return { signature: result.signature };
}

// === Formatting ===

/**
 * Truncate a Sui address for display.
 */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
