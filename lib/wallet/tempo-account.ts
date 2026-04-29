// Helpers for reconstructing a passkey-rooted Tempo account from the
// credential we stored at WebAuthn enrollment time.
//
// COSE → uncompressed public key conversion lives here so both browser and
// server can use it. ES256 / WebAuthn passkeys encode the public key as a
// CBOR map: {1: 2 (kty=EC2), 3: -7 (alg=ES256), -1: 1 (crv=P-256), -2: x,
// -3: y}. We extract x + y as 32-byte big-endian buffers and pack them as
// 0x04 || x || y for viem's Account.fromWebAuthnP256.

import { keccak256 } from "viem";
import { decode as cborDecode } from "cbor-x";

/**
 * Convert a COSE-encoded ES256 public key to viem's expected uncompressed
 * hex format (0x04 || x(32) || y(32)).
 */
export function coseToUncompressed(cose: Buffer | Uint8Array): `0x${string}` {
  const buf = Buffer.isBuffer(cose) ? cose : Buffer.from(cose);
  const decoded = cborDecode(buf);
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("COSE key: not a CBOR map");
  }
  // CBOR map keys for COSE: kty=1, alg=3, crv=-1, x=-2, y=-3
  const map = decoded as Record<number, unknown>;
  const kty = map[1];
  const crv = map[-1];
  const x = map[-2];
  const y = map[-3];
  if (kty !== 2) throw new Error(`COSE key: expected kty=2 (EC2), got ${kty}`);
  if (crv !== 1) throw new Error(`COSE key: expected crv=1 (P-256), got ${crv}`);
  if (!(x instanceof Uint8Array) || x.length !== 32) {
    throw new Error("COSE key: x coordinate must be 32-byte buffer");
  }
  if (!(y instanceof Uint8Array) || y.length !== 32) {
    throw new Error("COSE key: y coordinate must be 32-byte buffer");
  }
  const hex =
    "0x04" +
    Buffer.from(x).toString("hex") +
    Buffer.from(y).toString("hex");
  return hex as `0x${string}`;
}

/**
 * Derive the user's Tempo account address from a passkey's uncompressed
 * public key. Same shape as Ethereum derivation but over secp256r1.
 *
 *   address = keccak256(uncompressed_pubkey_xy_64bytes)[12:]
 *
 * We strip the 0x04 prefix before hashing.
 */
export function passkeyAddress(uncompressedHex: `0x${string}`): `0x${string}` {
  if (!uncompressedHex.startsWith("0x04") || uncompressedHex.length !== 132) {
    throw new Error(
      `passkeyAddress: expected 0x04+x+y (132 chars), got ${uncompressedHex.length}`,
    );
  }
  // Drop the 0x04 prefix; hash the 64-byte x||y.
  const xy = ("0x" + uncompressedHex.slice(4)) as `0x${string}`;
  const hash = keccak256(xy);
  return ("0x" + hash.slice(-40)).toLowerCase() as `0x${string}`;
}

/**
 * One-shot: stored COSE bytes → real Tempo account address.
 * Replaces the placeholderAddressFromCredId() compromise from Phase 2.
 */
export function tempoAddressFromCose(cose: Buffer | Uint8Array): `0x${string}` {
  return passkeyAddress(coseToUncompressed(cose));
}
