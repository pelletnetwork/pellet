#!/usr/bin/env node
// @pelletnetwork/cli — open agent wallet on Tempo.
//
// Phase 1: only `pellet auth start` and `pellet auth status` are wired.
// `pellet pay` lands in phase 4 once on-chain signing is plumbed.

import { authStart, authStatus, authRevoke } from "./commands/auth.js";

const args = process.argv.slice(2);
const [verb, sub, ...rest] = args;

async function main(): Promise<number> {
  if (!verb || verb === "help" || verb === "--help" || verb === "-h") {
    printHelp();
    return 0;
  }

  if (verb === "version" || verb === "--version" || verb === "-v") {
    // Mirrors package.json — kept hand-synced for v0; harvest from package.json later.
    console.log("0.1.0");
    return 0;
  }

  if (verb === "auth") {
    if (!sub || sub === "start") return authStart(parseAuthStartArgs(rest));
    if (sub === "status") return authStatus();
    if (sub === "revoke") return authRevoke();
    console.error(`unknown auth subcommand: ${sub}`);
    return 2;
  }

  if (verb === "pay") {
    console.error("pellet pay is not yet implemented (phase 4 — see docs/wallet/)");
    return 64;
  }

  console.error(`unknown command: ${verb}`);
  printHelp();
  return 2;
}

function parseAuthStartArgs(argv: string[]): { agentLabel?: string; baseUrl?: string } {
  const out: { agentLabel?: string; baseUrl?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--label" && argv[i + 1]) {
      out.agentLabel = argv[++i];
    } else if (a === "--base-url" && argv[i + 1]) {
      out.baseUrl = argv[++i];
    }
  }
  return out;
}

function printHelp(): void {
  process.stdout.write(`pellet — open agent wallet on Tempo

usage:
  pellet auth start [--label <name>] [--base-url <url>]
                    pair this CLI to your Pellet Wallet via device-code

  pellet auth status
                    show the active session (caps, expiry, label)

  pellet auth revoke
                    drop the local bearer (server revoke comes in phase 3)

  pellet pay <402-url>
                    [phase 4] sign + submit an x402 challenge

  pellet version    print version

env:
  PELLET_BASE_URL   override the API host (default https://pellet.network)

docs:
  https://pellet.network/wallet
  https://pellet.network/skill.md
`);
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
