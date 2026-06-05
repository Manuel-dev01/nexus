/**
 * Seal integration — client-side encryption with on-chain access control.
 *
 * Datasets can be encrypted with Mysten Seal before upload to Walrus. The
 * encryption identity is stored on-chain as the listing's `seal_policy_id`.
 * A buyer who owns a matching `DatasetAccess` passes the contract's
 * `seal_approve(id, &DatasetAccess)` check, so the Seal key servers release the
 * decryption key shares — gating decryption on proof-of-purchase.
 *
 * ⚠️ Runtime-tested in the browser only: encryption/decryption hit live Seal key
 * servers and decryption requires a wallet-signed SessionKey personal message.
 */

import { SealClient, SessionKey } from '@mysten/seal';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, SUI_FULLNODE_URL } from '$lib/sui/config';

// Mysten testnet open-mode key servers (seal-docs.wal.app). Override via
// PUBLIC_SEAL_KEY_SERVERS (comma-separated object IDs) for other networks.
const KEY_SERVER_IDS = (
  import.meta.env.PUBLIC_SEAL_KEY_SERVERS ||
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8'
)
  .split(',')
  .map((id: string) => ({ objectId: id.trim(), weight: 1 }));

// With 2 servers, threshold 1 favors liveness; raise to 2 for stronger TSS.
const THRESHOLD = 1;

// Seal needs a CoreClient-capable Sui client. The public fullnode is CORS-open in
// the browser (unlike the Tatum gateway, which rejects the SDK's headers).
function sealSuiClient(): any {
  return new SuiJsonRpcClient({
    transport: new JsonRpcHTTPTransport({ url: SUI_FULLNODE_URL }),
    network: 'testnet',
  });
}

function getSealClient(): SealClient {
  return new SealClient({
    suiClient: sealSuiClient(),
    serverConfigs: KEY_SERVER_IDS,
    verifyKeyServers: false,
  });
}

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/** A fresh Seal identity = the listing's `seal_policy_id`. */
export function newSealIdentity(): { bytes: number[]; hex: string } {
  const b = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  return { bytes: Array.from(b), hex };
}

/** Encrypt bytes under a Seal identity; returns the ciphertext to store on Walrus. */
export async function sealEncrypt(data: Uint8Array, identityHex: string): Promise<Uint8Array> {
  const { encryptedObject } = await getSealClient().encrypt({
    threshold: THRESHOLD,
    packageId: PACKAGE_ID,
    id: identityHex,
    data,
  });
  return encryptedObject;
}

/**
 * Decrypt a Seal ciphertext. Builds a `seal_approve` PTB the key servers dry-run
 * against the buyer's `DatasetAccess`, then fetches key shares and decrypts.
 */
export async function sealDecrypt(opts: {
  ciphertext: Uint8Array;
  /** hex of the listing's seal_policy_id (= the encryption identity) */
  identityHex: string;
  /** the buyer's DatasetAccess object id (proof of purchase) */
  accessObjectId: string;
  address: string;
  /** wallet personal-message signer; returns a base64 signature */
  signPersonalMessage: (message: Uint8Array) => Promise<{ signature: string }>;
}): Promise<Uint8Array> {
  const suiClient = sealSuiClient();

  const sessionKey = await SessionKey.create({
    address: opts.address,
    packageId: PACKAGE_ID,
    ttlMin: 10,
    suiClient,
  });
  const { signature } = await opts.signPersonalMessage(sessionKey.getPersonalMessage());
  await sessionKey.setPersonalMessageSignature(signature);

  // seal_approve(id, access) — the access-control proof the key servers evaluate.
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::nexus_marketplace::seal_approve`,
    arguments: [tx.pure.vector('u8', hexToBytes(opts.identityHex)), tx.object(opts.accessObjectId)],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  return getSealClient().decrypt({ data: opts.ciphertext, sessionKey, txBytes });
}
