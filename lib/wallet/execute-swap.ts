import { createPublicClient, createWalletClient, http } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { Account, withRelay, tempoActions } from "viem/tempo";
import { decryptSessionKey } from "./session-keys";
import { tempoChainConfig } from "./tempo-config";

type WalletSessionRow = {
  sessionKeyCiphertext: Buffer | null;
  authorizeTxHash: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

type SwapUser = {
  managedAddress: string;
  publicKeyUncompressed: string;
};

export type SwapQuoteInput = {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
};

export type SwapQuoteResult =
  | { ok: true; amountOut: bigint; amountOutDisplay: string }
  | { ok: false; error: string; status: number };

export type SwapExecuteInput = {
  session: WalletSessionRow;
  user: SwapUser;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  minAmountOut: bigint;
};

export type SwapExecuteResult =
  | { ok: true; txHash: `0x${string}`; explorerUrl: string }
  | { ok: false; error: string; detail?: string; status: number };

export async function quoteSwap(input: SwapQuoteInput): Promise<SwapQuoteResult> {
  const chain = tempoChainConfig();
  const viemChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;

  const client = createPublicClient({
    chain: viemChain,
    transport: http(chain.rpcUrl),
  }).extend(tempoActions());

  try {
    const amountOut = await client.dex.getSellQuote({
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amountIn: input.amountIn,
    });
    const amountOutDisplay = (Number(amountOut) / 1_000_000).toFixed(2);
    return { ok: true, amountOut, amountOutDisplay };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `quote failed: ${detail}`, status: 502 };
  }
}

export async function executeSwap(input: SwapExecuteInput): Promise<SwapExecuteResult> {
  const { session, user, tokenIn, tokenOut, amountIn, minAmountOut } = input;

  if (!session.sessionKeyCiphertext) {
    return { ok: false, error: "session has no agent key", status: 500 };
  }
  if (!session.authorizeTxHash) {
    return { ok: false, error: "session not on-chain authorized", status: 403 };
  }
  if (session.revokedAt) {
    return { ok: false, error: "session revoked", status: 403 };
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "session expired", status: 403 };
  }

  let agentPk: `0x${string}`;
  try {
    agentPk = decryptSessionKey(Buffer.from(session.sessionKeyCiphertext));
  } catch (e) {
    return { ok: false, error: "session key undecryptable", detail: String(e), status: 500 };
  }

  const chain = tempoChainConfig();
  const viemBaseChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  const viemChain = { ...viemBaseChain, feeToken: chain.usdcE };

  const userAccount = Account.fromWebAuthnP256(
    { id: "noop", publicKey: user.publicKeyUncompressed as `0x${string}` },
    { rpId: process.env.NEXT_PUBLIC_RP_ID ?? "pellet.network" },
  );
  const accessKey = Account.fromSecp256k1(agentPk, { access: userAccount });

  if (!chain.sponsorUrl) {
    return { ok: false, error: "no sponsor configured", status: 500 };
  }

  const client = createWalletClient({
    account: accessKey,
    chain: viemChain,
    transport: withRelay(http(chain.rpcUrl), http(chain.sponsorUrl), { policy: "sign-only" }),
  }).extend(tempoActions());

  try {
    const txHash = await client.dex.sell({
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
    });
    return {
      ok: true,
      txHash,
      explorerUrl: `${chain.explorerUrl}/tx/${txHash}`,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, error: "swap failed", detail, status: 500 };
  }
}
