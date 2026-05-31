/**
 * Sui / Tatum RPC Configuration
 * 
 * Configures the Sui client to route all RPC calls through Tatum's gateway.
 * Phase 2: Full implementation with PTB builders.
 */

export const TATUM_RPC_URL = import.meta.env.PUBLIC_TATUM_RPC_URL
  || 'https://sui-testnet.gateway.tatum.io';

// Phase 2: SuiClient initialization with Tatum gateway
// Phase 2: PTB builders for list_dataset, buy_dataset, delist_dataset
