# Pellet HL Contracts

ERC-8004 registries deployed on HyperEVM for agent identity, reputation, and validation.

## Setup

1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation):

   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. Install dependencies:

   ```bash
   forge install
   ```

3. Copy the env template and fill in a deployer private key:

   ```bash
   cp .env.example .env
   # Edit .env and set PRIVATE_KEY to a testnet-only deployer wallet
   ```

   ⚠️ Use a fresh wallet with testnet funds only. Never reuse a mainnet wallet.

## Testnet

HyperEVM testnet RPC: `https://rpc.hyperliquid-testnet.xyz/evm` (chain ID 998).
Faucet: see [Hyperliquid docs](https://hyperliquid.gitbook.io/hyperliquid-docs).

## Build

```bash
forge build
```

## Test

```bash
forge test -vv
```

Run with gas reports:

```bash
forge test --gas-report
```

## Deploy to HyperEVM testnet

```bash
forge script script/Deploy.s.sol \
  --rpc-url hyperevm_testnet \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Deployed addresses are recorded by the deploy script — commit the resulting JSON to `deployments/`.

## Contracts

- `IdentityRegistry` — ERC-8004 agent identity registry
- `ReputationRegistry` — ERC-8004 reputation attestations
- `ValidationRegistry` — ERC-8004 validation attestations
