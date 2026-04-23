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

1. Fund a fresh testnet-only deployer wallet with HyperEVM testnet ETH (use the [official faucet](https://app.hyperliquid-testnet.xyz/drip)).

2. Set your private key:

   ```bash
   cp .env.example .env
   # Edit .env and set PRIVATE_KEY to your testnet deployer
   export $(grep -v '^#' .env | xargs)
   ```

   ⚠️ Never use a mainnet wallet or a wallet with real funds.

3. Dry-run (optional — simulates the deploy without broadcasting):

   ```bash
   forge script script/Deploy.s.sol --rpc-url hyperevm_testnet
   ```

4. Deploy for real:

   ```bash
   forge script script/Deploy.s.sol \
     --rpc-url hyperevm_testnet \
     --broadcast
   ```

5. Copy the three addresses from the script output and save them to `deployments/hyperevm-testnet.json`:

   ```json
   {
     "chainId": 998,
     "deployedAt": "2026-MM-DDTHH:MM:SSZ",
     "deployer": "0x...",
     "contracts": {
       "IdentityRegistry": "0x...",
       "ReputationRegistry": "0x...",
       "ValidationRegistry": "0x..."
     }
   }
   ```

6. Commit the deployments JSON to git.

## Deploy to HyperEVM mainnet

Same flow with `--rpc-url hyperevm_mainnet`. **Do not deploy to mainnet without an audit** — this is Phase 1 pre-audit reference implementation.

## Contracts

- `IdentityRegistry` — ERC-8004 agent identity registry
- `ReputationRegistry` — ERC-8004 reputation attestations
- `ValidationRegistry` — ERC-8004 validation attestations
