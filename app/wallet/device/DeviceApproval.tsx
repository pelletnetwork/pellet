"use client";

import { useEffect, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import { createWalletClient, http } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { Account, Actions, withRelay, tempoActions } from "viem/tempo";

type ApprovalState =
  | { kind: "input" }
  | { kind: "auth"; code: string }
  | { kind: "confirming"; code: string; userId: string; managedAddress: string }
  | { kind: "submitting"; stage: "init" | "signing" | "broadcasting" | "finalizing" }
  | { kind: "approved"; txHash: string; explorerUrl: string }
  | { kind: "error"; message: string };

const PRESET_CAPS = [
  { label: "$5 / 24h", spendCapUsdc: 5, perCallUsdc: 1, ttlSeconds: 24 * 3600 },
  { label: "$25 / 7d", spendCapUsdc: 25, perCallUsdc: 5, ttlSeconds: 7 * 24 * 3600 },
  { label: "$100 / 30d", spendCapUsdc: 100, perCallUsdc: 10, ttlSeconds: 30 * 24 * 3600 },
];

// transferWithMemo selector — the x402 settlement call on TIP-20.
const TRANSFER_WITH_MEMO = "0x95777d59" as const;

type InitResponse = {
  user_id: string;
  credential_id: string;
  public_key_uncompressed: `0x${string}`;
  managed_address: `0x${string}`;
  rp_id: string;
  agent_key_address: `0x${string}`;
  agent_private_key: `0x${string}`;
  chain: {
    id: number;
    name: string;
    rpc_url: string;
    sponsor_url: string | null;
    explorer_url: string;
    usdc_e: `0x${string}`;
  };
  account_keychain_address: `0x${string}`;
  expiry_unix: number;
  spend_cap_wei: string;
  per_call_cap_wei: string;
  session_ttl_seconds: number;
};

export function DeviceApproval({ initialCode }: { initialCode: string }) {
  const [state, setState] = useState<ApprovalState>(
    initialCode ? { kind: "auth", code: initialCode } : { kind: "input" },
  );
  const [code, setCode] = useState(initialCode);
  const [capIdx, setCapIdx] = useState(0);
  const [supportsPasskey, setSupportsPasskey] = useState<boolean | null>(null);

  useEffect(() => {
    setSupportsPasskey(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
    );
  }, []);

  const cap = PRESET_CAPS[capIdx];

  const onPasskeySignIn = async () => {
    if (state.kind !== "auth") return;
    try {
      const optsRes = await fetch("/api/wallet/webauthn/auth/options", { method: "POST" });
      const opts = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: opts });
      const verifyRes = await fetch("/api/wallet/webauthn/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) {
        setState({ kind: "error", message: data.error ?? "sign-in failed" });
        return;
      }
      setState({
        kind: "confirming",
        code: state.code,
        userId: data.user_id,
        managedAddress: data.managed_address,
      });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const onPasskeyEnroll = async () => {
    if (state.kind !== "auth") return;
    try {
      const optsRes = await fetch("/api/wallet/webauthn/register/options", { method: "POST" });
      const opts = await optsRes.json();
      const attestation = await startRegistration({ optionsJSON: opts });
      const verifyRes = await fetch("/api/wallet/webauthn/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) {
        setState({ kind: "error", message: data.error ?? "enrollment failed" });
        return;
      }
      setState({
        kind: "confirming",
        code: state.code,
        userId: data.user_id,
        managedAddress: data.managed_address,
      });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const onApprove = async () => {
    if (state.kind !== "confirming") return;

    setState({ kind: "submitting", stage: "init" });
    let init: InitResponse;
    try {
      const res = await fetch("/api/wallet/device/approve-init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: state.code,
          spend_cap_wei: String(cap.spendCapUsdc * 1_000_000),
          per_call_cap_wei: String(cap.perCallUsdc * 1_000_000),
          session_ttl_seconds: cap.ttlSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "approve-init failed" });
        return;
      }
      init = data as InitResponse;
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      return;
    }

    setState({ kind: "submitting", stage: "signing" });
    let txHash: `0x${string}`;
    try {
      const userAccount = Account.fromWebAuthnP256(
        {
          id: init.credential_id,
          publicKey: init.public_key_uncompressed,
        },
        { rpId: init.rp_id },
      );

      const accessKey = Account.fromSecp256k1(init.agent_private_key, {
        access: userAccount,
      });

      const baseChain =
        init.chain.id === tempoMainnet.id ? tempoMainnet : tempoModerato;
      const chain = { ...baseChain, feeToken: init.chain.usdc_e };

      const transport = init.chain.sponsor_url
        ? withRelay(http(init.chain.rpc_url), http(init.chain.sponsor_url), {
            policy: "sign-only",
          })
        : http(init.chain.rpc_url);

      const client = createWalletClient({
        account: userAccount,
        chain,
        transport,
      }).extend(tempoActions());

      setState({ kind: "submitting", stage: "broadcasting" });
      const result = await client.accessKey.authorizeSync({
        accessKey,
        expiry: init.expiry_unix,
        feePayer: true,
        gas: BigInt(5_000_000),
        limits: [
          {
            token: init.chain.usdc_e,
            limit: BigInt(init.spend_cap_wei),
            period: 86400,
          },
        ],
        scopes: [
          { address: init.chain.usdc_e, selector: TRANSFER_WITH_MEMO },
        ],
      });
      txHash = result.receipt.transactionHash as `0x${string}`;
    } catch (e) {
      setState({
        kind: "error",
        message:
          "on-chain authorize failed: " +
          (e instanceof Error ? e.message : String(e)),
      });
      return;
    }

    setState({ kind: "submitting", stage: "finalizing" });
    try {
      const finRes = await fetch("/api/wallet/device/approve-finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: state.code, tx_hash: txHash }),
      });
      const finData = await finRes.json();
      if (!finRes.ok) {
        setState({
          kind: "error",
          message:
            "tx confirmed but server rejected finalize: " +
            (finData.error ?? "unknown") +
            (finData.detail ? ` (${finData.detail})` : "") +
            ` · tx ${txHash}`,
        });
        return;
      }
    } catch (e) {
      setState({
        kind: "error",
        message:
          "tx confirmed but finalize POST failed: " +
          (e instanceof Error ? e.message : String(e)),
      });
      return;
    }

    setState({
      kind: "approved",
      txHash,
      explorerUrl: `${init.chain.explorer_url}/tx/${txHash}`,
    });
  };

  return (
    <div className="device-card">
      <span className="device-kicker">pellet wallet · connect agent</span>

      {state.kind === "input" && (
        <>
          <h1 className="device-title">enter code</h1>
          <p className="device-desc">
            Type or paste the three-word code from your CLI to begin pairing.
          </p>
          <input
            className="device-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. blue-tape-river"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            className="device-btn"
            style={{ marginTop: 12 }}
            onClick={() => {
              if (code.trim().length > 0) setState({ kind: "auth", code: code.trim() });
            }}
          >
            continue
          </button>
        </>
      )}

      {state.kind === "auth" && (
        <>
          <h1 className="device-title">sign in or enroll</h1>
          <p className="device-desc">
            Pellet Wallet is rooted in your passkey. Sign in if you've used
            this device before; otherwise enroll a new passkey.
          </p>
          <p className="device-code">
            Code: <em>{state.code}</em>
          </p>

          {supportsPasskey === false && (
            <p className="device-error-msg" style={{ marginBottom: 12 }}>
              this browser doesn't support passkeys. try Chrome, Safari, or Edge.
            </p>
          )}

          <button className="device-btn" onClick={onPasskeySignIn} disabled={!supportsPasskey}>
            sign in with passkey
          </button>
          <button className="device-btn device-btn-secondary" onClick={onPasskeyEnroll} disabled={!supportsPasskey}>
            enroll new passkey
          </button>
        </>
      )}

      {state.kind === "confirming" && (
        <>
          <h1 className="device-title">approve agent</h1>
          <p className="device-code">
            Code: <em>{state.code}</em>
          </p>
          <p className="device-mono-addr">
            wallet · {state.managedAddress.slice(0, 14)}…{state.managedAddress.slice(-6)}
          </p>

          <hr className="device-rule" />

          <div>
            <span className="device-kicker">spend caps</span>
            <div className="device-cap-row">
              {PRESET_CAPS.map((c, i) => (
                <button
                  key={c.label}
                  type="button"
                  className={`device-cap${i === capIdx ? " device-cap-active" : ""}`}
                  onClick={() => setCapIdx(i)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="device-cap-detail">
              max ${cap.perCallUsdc} per call · {cap.spendCapUsdc} total · expires in{" "}
              {cap.ttlSeconds < 86400 ? `${cap.ttlSeconds / 3600}h` : `${cap.ttlSeconds / 86400}d`}
            </p>
          </div>

          <hr className="device-rule" />

          <p className="device-warn">
            Approving will prompt your passkey to sign an authorizeKey tx on
            Tempo Moderato testnet. Gas is sponsored. The agent key gets
            on-chain caps — Tempo enforces them.
          </p>

          <button className="device-btn" onClick={onApprove}>
            approve · grant {cap.label}
          </button>
        </>
      )}

      {state.kind === "submitting" && (
        <>
          <h1 className="device-title">working…</h1>
          <p className="device-stage">
            <span className={state.stage === "init" ? "device-stage-active" : "device-stage-done"}>
              · preparing agent key
            </span>
            <br />
            <span
              className={
                state.stage === "signing"
                  ? "device-stage-active"
                  : state.stage === "init"
                  ? ""
                  : "device-stage-done"
              }
            >
              · waiting for passkey
            </span>
            <br />
            <span
              className={
                state.stage === "broadcasting"
                  ? "device-stage-active"
                  : state.stage === "finalizing"
                  ? "device-stage-done"
                  : ""
              }
            >
              · broadcasting tx
            </span>
            <br />
            <span className={state.stage === "finalizing" ? "device-stage-active" : ""}>
              · finalizing
            </span>
          </p>
        </>
      )}

      {state.kind === "approved" && (
        <>
          <h1 className="device-title">approved.</h1>
          <p className="device-desc">
            Agent key authorized on Tempo. Your CLI should pick up the bearer
            token within a couple seconds.
          </p>
          <a
            href={state.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="device-tx-link"
          >
            tx · {state.txHash.slice(0, 14)}…{state.txHash.slice(-6)} ↗
          </a>
        </>
      )}

      {state.kind === "error" && (
        <>
          <h1 className="device-title">something went wrong.</h1>
          <p className="device-error-msg">{state.message}</p>
          <button
            className="device-btn device-btn-secondary"
            style={{ marginTop: 16 }}
            onClick={() => setState({ kind: "input" })}
          >
            start over
          </button>
        </>
      )}
    </div>
  );
}
