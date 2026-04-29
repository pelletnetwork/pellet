# @pelletnetwork/cli

Open agent wallet on Tempo. Pair, approve, pay — every settlement recorded on the public [OLI ledger](https://pellet.network/oli).

## Install

```sh
npm i -g @pelletnetwork/cli
```

Or invoke without install:

```sh
npx -y @pelletnetwork/cli auth start
```

## Quick start

```sh
pellet auth start
#
#   Starting connection…
#   └ Calling pellet auth start
#
#   Visit https://pellet.network/wallet/device?code=blue-tape-river
#   and follow the instructions to connect your Pellet wallet.
#   When prompted, verify or enter the following passphrase:
#   blue-tape-river
#
#   Waiting for approval…
```

After approval the CLI writes `~/.pellet/config.json` (mode 0600). Every subsequent agent action reuses the bearer until it expires.

```sh
pellet auth status
pellet auth revoke
```

## Commands (phase 1)

| Command | What it does |
|---|---|
| `pellet auth start [--label <name>]` | Pair this CLI via device-code. Browser flow approves with caps. |
| `pellet auth status` | Show current session — caps, expiry, label. |
| `pellet auth revoke` | Drop the local bearer. Server-side revoke ships in phase 3. |
| `pellet pay <402-url>` | **Phase 4.** Sign + submit an x402 challenge from the active session. |

## Status

Phase 1 of the [v0 plan](https://github.com/pelletnetwork/pellet/blob/main/docs/wallet/research-2026-04-29.md). The pairing loop is live end-to-end against Tempo's Moderato testnet; the browser approval is currently a placeholder UI that grants caps without a real passkey assertion. Real passkey enrollment + on-chain `AccountKeychain.authorizeKey` lands in phase 3.

Don't trust this with mainnet funds yet.

## Env

| Var | Default | Use |
|---|---|---|
| `PELLET_BASE_URL` | `https://pellet.network` | Override API host (e.g. local dev `http://localhost:3000`) |

## Links

- [pellet.network/wallet](https://pellet.network/wallet) — manifesto + roadmap
- [pellet.network/skill.md](https://pellet.network/skill.md) — agent install
- [pellet.network/oli/methodology](https://pellet.network/oli/methodology) — the ledger pellet writes to

## License

MIT.
