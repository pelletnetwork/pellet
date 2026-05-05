// Pellet Wallet WebAuthn config + helpers.
//
// Phase 2 lays the passkey enrollment + login surface. Phase 3 wires the
// resulting credential to an on-chain Tempo account via AccountKeychain.
// For now, managedAddress is a deterministic placeholder derived from the
// credential id (NOT a real on-chain address — phase 3 replaces this).

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";

// ── Relying-party config ─────────────────────────────────────────────────

export type WebAuthnEnv = {
  rpId: string;
  rpName: string;
  // Accept both apex and www origins in production — pellet.network and
  // www.pellet.network are valid clients of the same RP. simplewebauthn
  // takes string | string[] for expectedOrigin.
  origins: string[];
};

export function webauthnEnv(): WebAuthnEnv {
  // In Vercel preview/prod, NEXT_PUBLIC_BASE_URL or VERCEL_URL surfaces the
  // host. Locally, defaults to localhost:3000. The RP id MUST be a
  // registrable suffix of every origin host (no scheme, no port) — passkeys
  // are scoped to exactly that label and any subdomain of it.
  const explicit = process.env.NEXT_PUBLIC_RP_ID;
  if (explicit) {
    const explicitOrigin = process.env.NEXT_PUBLIC_RP_ORIGIN;
    return {
      rpId: explicit,
      rpName: "Pellet Wallet",
      origins: explicitOrigin
        ? [explicitOrigin]
        : [`https://${explicit}`, `https://www.${explicit}`],
    };
  }
  if (process.env.VERCEL_ENV === "production") {
    return {
      rpId: "pellet.network",
      rpName: "Pellet Wallet",
      origins: ["https://pellet.network", "https://www.pellet.network"],
    };
  }
  return {
    rpId: "localhost",
    rpName: "Pellet Wallet (dev)",
    origins: ["http://localhost:3000"],
  };
}

// ── Registration ─────────────────────────────────────────────────────────

export async function makeRegistrationOptions(opts: {
  userId: string;
  userName: string;
  excludeCredentialIds?: string[];
}) {
  const env = webauthnEnv();
  const config: GenerateRegistrationOptionsOpts = {
    rpName: env.rpName,
    rpID: env.rpId,
    userID: new TextEncoder().encode(opts.userId),
    userName: opts.userName,
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: (opts.excludeCredentialIds ?? []).map((id) => ({ id })),
    authenticatorSelection: {
      // Platform passkeys preferred (cross-device sync via iCloud Keychain
      // / Google Password Manager). Don't require resident keys; allow
      // non-discoverable credentials so security keys still work.
      residentKey: "preferred",
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  };
  return generateRegistrationOptions(config);
}

export async function verifyRegistration(opts: {
  response: VerifyRegistrationResponseOpts["response"];
  expectedChallenge: string;
}) {
  const env = webauthnEnv();
  return verifyRegistrationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: env.origins,
    expectedRPID: env.rpId,
    requireUserVerification: false,
  });
}

// ── Authentication ───────────────────────────────────────────────────────

export async function makeAuthenticationOptions(opts: {
  allowCredentialIds?: string[];
}) {
  const env = webauthnEnv();
  const config: GenerateAuthenticationOptionsOpts = {
    rpID: env.rpId,
    timeout: 60_000,
    userVerification: "preferred",
    allowCredentials: (opts.allowCredentialIds ?? []).map((id) => ({ id })),
  };
  return generateAuthenticationOptions(config);
}

export async function verifyAuthentication(opts: {
  response: VerifyAuthenticationResponseOpts["response"];
  expectedChallenge: string;
  credential: VerifyAuthenticationResponseOpts["credential"];
}) {
  const env = webauthnEnv();
  return verifyAuthenticationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: env.origins,
    expectedRPID: env.rpId,
    credential: opts.credential,
    requireUserVerification: false,
  });
}

