# Pellet Wallet — Phase 3.B Research Synthesis (2026-04-29)

Three parallel research agents on Tempo SDK + WebAuthn-signed TempoTransactions, AccountKeychain T3 ABI, and the Moderato sponsor service. This doc captures every architecture-changing finding and the concrete v0 plan they imply.

## 1. The architecture changed (again)

Pre-research, the v0 plan had us:
- Hand-rolling RLP envelopes for type-0x76 transactions
- Computing the keccak256(0x76 \|\| rlp(...)) sender hash by hand
- Wrapping it in a WebAuthn challenge ourselves
- Calling the AccountKeychain precompile via raw `eth_sendRawTransaction`
- Possibly building our own sponsor wire format

**None of that is needed.** `viem` (≥2.47.18) and `ox` (≥0.14.20) already ship first-class Tempo support upstream. Tempo was integrated into wevm's libraries at the protocol level. Specifically:

| Module | What it gives us |
|---|---|
| `viem/chains` | `tempo` (chainId 4217) and `tempoModerato` (chainId 42431) chain definitions |
| `viem/tempo` | `Account.fromWebAuthnP256({ id, publicKey })` reconstructs a passkey-rooted account from our stored credential. `Transport.withRelay(http(rpc), http(sponsor), { policy })` wires sponsored gas. `tempoActions()` extends a client with Tempo-aware writes. `Abis.accountKeychain` and `Addresses.accountKeychain` are the canonical ABI + precompile address. `Actions.accessKey.authorize(client, {...})` is the high-level call we want. |
| `ox/tempo` | Lower-level: `TxEnvelopeTempo`, `SignatureEnvelope`, `KeyAuthorization`, `TempoAddress`. Use only if we need to bypass viem. |

**We use viem's high-level API and never touch RLP or 0x76/0x78 hashes manually.** That eliminates roughly 80% of the risk surface in Phase 3.B.

## 2. Critical fact corrections from earlier research

### AccountKeychain T3 is live; T2 is rejected

The first research pass identified selector `0x54063a55` (T2) for `authorizeKey`. **As of 2026-04-21 (Moderato) and 2026-04-27 (Presto/mainnet), that selector returns `LegacyAuthorizeKeySelectorChanged(0x980a6025)`**. T3 is the only valid selector now.

T3 ABI:
```solidity
function authorizeKey(
  address keyId,
  uint8 sigType,                       // 0=Secp256k1, 1=P256, 2=WebAuthn
  KeyRestrictions calldata restrictions
) external;

struct KeyRestrictions {
  uint64 expiry;                       // unix seconds; MUST be future, nonzero
  bool enforceLimits;
  TokenLimit[] limits;
  bool allowAnyCalls;
  CallScope[] allowedCalls;
}

struct TokenLimit {
  address token;
  uint256 amount;
  uint64 period;                       // 0 = one-shot bucket; >0 = recurring (e.g. 86400 for daily reset)
}

struct CallScope {
  address target;
  SelectorRule[] selectorRules;
}

struct SelectorRule {
  bytes4 selector;
  address[] recipients;                // empty = any recipient
}
```

For Pellet's "$5/24h" UX:
```ts
{
  expiry: BigInt(Math.floor(Date.now()/1000) + 86400),
  enforceLimits: true,
  limits: [{
    token: USDC_E_MODERATO,
    amount: parseUnits('5', 6),
    period: 86400n,                    // daily reset
  }],
  allowAnyCalls: false,
  allowedCalls: [{
    target: USDC_E_MODERATO,
    selectorRules: [{
      selector: '0x95777d59',          // transferWithMemo — x402 path
      recipients: [],
    }],
  }],
}
```

### enforceLimits is cumulative and tx.origin-gated

- Caps deplete cumulatively across calls until reset. NOT per-call.
- `period > 0` enables auto-reset. For "5 USDC/day", `period=86400`.
- Caps only fire when `msg.sender == tx.origin == account`. Indirect calls through routers/multicalls bypass — we must build x402 settlement as a direct call from the access key to the TIP-20 token.
- `transferWithMemo` (selector `0x95777d59`) counts identically to `transfer`. `transferFrom` and `transferFromWithMemo` (T3+) also trigger the cap.
- `AccessKeySpend` event emitted on every depletion — useful for OLI ingest.

### USDC.e address differs per chain

| Chain | USDC.e address |
|---|---|
| Presto (mainnet, 4217) | `0x20c000000000000000000000b9537d11c60e8b50` |
| Moderato (testnet, 42431) | `0x20c0000000000000000000009e8d7eb59b783726` |

Pull from `https://tokenlist.tempo.xyz/list/<chainId>` rather than hardcoding. The agent flagged this as the "#1 phase-4 footgun."

### Faucet is an RPC method, not a URL

```bash
curl -X POST https://rpc.moderato.tempo.xyz/ \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tempo_fundAddress","params":["0xRECIPIENT"],"id":1}'
```

Mints 1M each of `pathUSD`, `alphaUSD`, `betaUSD`, `thetaUSD` (decimals 6). For demo flows on testnet, **use `pathUSD` end-to-end** — there's no Moderato USDC.e faucet, and `pathUSD` is the canonical Moderato test stable.

### Block explorer URL is wrong in the docs

Tempo's `connection-details` page claims `explore.moderato.tempo.xyz`. **That DNS does not resolve.** Use `https://explore.testnet.tempo.xyz/` (verified live). Mainnet is `https://explore.tempo.xyz`.

## 3. WebAuthn-signed TempoTransaction — what's actually happening

We don't need to construct this manually (viem does it), but understanding the wire format is useful for debugging:

**Sender hash (presign):**
```
sigHash = keccak256(0x76 || rlp([
  chainId, maxPriorityFeePerGas, maxFeePerGas, gas,
  calls, accessList, nonceKey, nonce,
  validBefore, validAfter,
  feeToken_or_0x80,           // 0x80 (skip) when sponsoring
  feePayerSig_or_0x00,         // 0x00 placeholder when sponsoring
  authorizationList,
  keyAuthorization?,
]))
```

**WebAuthn challenge field embedded in clientDataJSON = raw `sigHash` bytes** (base64url-encoded automatically by the browser's WebAuthn API). Tempo's verifier reconstructs by base64url-decoding the challenge from clientDataJSON and matching against the recomputed `sigHash`.

**Wire format for the `sender_signature` field** (sigType=2, WebAuthn):
```
0x02 || authenticatorData || utf8(clientDataJSON) || r(32) || s(32) || pubKeyX(32) || pubKeyY(32)
```

**Fee-payer hash:**
```
feePayerHash = keccak256(0x78 || rlp(... feeToken, sender_address, keyAuthorization?))
```

The 0x76/0x78 type-byte separator is what prevents signature reuse across roles. Mixing them up is the most-common silent failure (sponsor rejects as invalid signature).

## 4. Passkey-rooted address derivation

Standard Ethereum derivation, just over secp256r1 (P-256) instead of secp256k1:
```
address = keccak256(uncompressed_p256_pubkey_xy_64bytes)[12:]
```

`Account.fromWebAuthnP256({ publicKey })` does this for us. Public key arrives from WebAuthn as COSE-encoded; we need to convert COSE → uncompressed `(0x04 || x || y)` before passing to viem. `ox/CoseKey.toPublicKey` is the helper, or hand-rolled COSE parsing (the COSE structure for an ES256 key is well-defined: kty=2, crv=1, alg=-7, x, y).

**Key implication:** the address is deterministic from the public key. No "first-tx ceremony" needed. We can compute the user's Tempo address at WebAuthn enrollment time and store it as `wallet_users.managed_address` immediately. **This kills the placeholder-address compromise from Phase 2.**

## 5. Sponsor service — verified live

`https://sponsor.moderato.tempo.xyz/` is a JSON-RPC 2.0 endpoint (CORS-permissive, no auth on testnet). Three methods:

| Method | Behavior |
|---|---|
| `eth_signRawTransaction` | Co-sign only — returns spliced envelope, doesn't broadcast |
| `eth_sendRawTransaction` | Co-sign + broadcast, returns tx hash |
| `eth_sendRawTransactionSync` | Co-sign + broadcast + wait for receipt |

`Transport.withRelay(httpRpc, httpSponsor, { policy })` handles all three transparently:
- `policy: 'sign-only'` → CLI/wallet broadcasts after sponsor co-signs
- `policy: 'broadcast'` (default) → sponsor broadcasts, wallet just gets tx hash

## 6. Concrete Phase 3.B v0 implementation

Three contained commits:

### 3.B.1 (this commit) — Foundation

**Migration 0006:**
```sql
ALTER TABLE wallet_sessions ADD COLUMN IF NOT EXISTS authorize_tx_hash text;
ALTER TABLE wallet_sessions ADD COLUMN IF NOT EXISTS on_chain_authorized_at timestamptz;
ALTER TABLE wallet_users ADD COLUMN IF NOT EXISTS public_key_uncompressed text;
```

**`lib/wallet/tempo-config.ts`** — constants for both chains.

**`lib/wallet/tempo-account.ts`** — helpers:
- `coseToUncompressed(cose: Buffer): \`0x\${string}\`` — convert COSE pubkey to viem-friendly uncompressed hex
- `walletUserToAccount(user, rpId)` — wraps `Account.fromWebAuthnP256` with our stored credential

No browser-side authorize call yet. No signing code.

### 3.B.2 — Browser-side authorize flow

- Refactor `/api/wallet/device/approve` into two endpoints:
  - `POST /api/wallet/device/approve-init` — generates agent EOA, returns its address + the agent label
  - `POST /api/wallet/device/approve-finalize` — verifies the tx hash on-chain, flips pairing to approved, persists `authorize_tx_hash` + `on_chain_authorized_at`
- Update `DeviceApproval.tsx`:
  - On approve click, call `/approve-init`
  - Construct viem client with user's passkey-rooted account + `Transport.withRelay`
  - Call `Actions.accessKey.authorize(client, {...})` — Touch ID prompt
  - On success, POST tx hash to `/approve-finalize`
- UI shows tx hash + explorer link in the success state

### 3.B.3 — Server-side verification + polish

- `/approve-finalize` reads the receipt from the chain and confirms:
  - Tx succeeded (status=1)
  - The keyId in the call data matches our generated agent address
  - `getKey(account, keyId)` returns matching restrictions
- Without verification, a malicious browser could lie about the tx hash. With it, we have ironclad proof the on-chain authorization actually happened with the right caps.

## 7. Open questions deferred to future phases

- **Mainnet sponsor.** No public Presto sponsor; we'd need to run our own. Phase 4+.
- **Recovery flow.** Lose your passkey → lose your wallet. Phase 4+: register a second passkey on day one as a guardian, or wrap in a smart account with a backup signer.
- **Cross-device / cross-vendor passkey sync.** iCloud Keychain ↔ Google Password Manager don't sync to each other. Document in the wallet UI.
- **Allowed-calls scoping when we ship Pellet's own routing.** If Pellet ever proxies x402 via our own contract, we'll need to add it to `allowedCalls`. Today: locked tight to USDC.e.transferWithMemo.

## 8. Bookmarks

### Tempo + viem
- https://github.com/wevm/viem/blob/main/src/tempo/Account.ts (`fromWebAuthnP256`)
- https://github.com/wevm/viem/blob/main/src/tempo/Transport.ts (`withRelay`)
- https://github.com/wevm/viem/blob/main/src/tempo/Abis.ts (`accountKeychain`)
- https://github.com/wevm/viem/blob/main/src/tempo/Addresses.ts (precompile address)
- https://github.com/wevm/ox/blob/main/src/tempo/TxEnvelopeTempo.ts
- https://github.com/wevm/ox/blob/main/src/tempo/SignatureEnvelope.ts

### AccountKeychain
- https://github.com/tempoxyz/tempo-std/blob/main/src/interfaces/IAccountKeychain.sol (canonical T3 ABI)
- https://docs.tempo.xyz/protocol/transactions/AccountKeychain
- https://github.com/tempoxyz/tempo/releases/tag/v1.6.0 (T3 activation notes)

### Sponsor + onboarding
- https://docs.tempo.xyz/guide/payments/sponsor-user-fees
- https://github.com/tempoxyz/tempo-ts/blob/main/src/server/Handler.ts (definitive sponsor wire format)
- https://github.com/tempoxyz/accounts/tree/main/examples/with-fee-payer-and-webauthn (working E2E example)
- https://docs.tempo.xyz/quickstart/faucet (`tempo_fundAddress` reference)

### Connection details
- https://docs.tempo.xyz/quickstart/connection-details
- https://tokenlist.tempo.xyz/list/42431 (Moderato token list — canonical USDC.e address)
- https://explore.testnet.tempo.xyz/ (Moderato block explorer — actual URL, docs are stale)
