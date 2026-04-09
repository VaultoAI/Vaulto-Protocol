# PreStock Token Bridge

Cross-chain bridge for PreStock synthetic tokens using Wormhole Native Token Transfers (NTT).

**Solana (LOCKING) ↔ Polygon (BURNING)**

## Overview

This bridge enables PreStock tokens to be transferred between Solana and Polygon:

- **Solana → Polygon**: Tokens are locked in NTT custody on Solana, equivalent tokens are minted on Polygon
- **Polygon → Solana**: Tokens are burned on Polygon, equivalent tokens are unlocked on Solana

## Supported Tokens

| Token Name (Polygon)           | Symbol       | Solana SPL Mint                            |
| ------------------------------ | ------------ | ------------------------------------------ |
| Vaulted Prestock SpaceX        | vSPACEX      | `PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh` |
| Vaulted Prestock Anthropic     | vANTHROPIC   | `Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw` |
| Vaulted Prestock OpenAI        | vOPENAI      | `PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF` |
| Vaulted Prestock Anduril       | vANDURIL     | `PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB` |
| Vaulted Prestock Kalshi        | vKALSHI      | `PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua` |
| Vaulted Prestock Polymarket    | vPOLYMARKET  | `Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP` |
| Vaulted Prestock xAI           | vXAI         | `PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx` |

## Project Structure

```
POL_SOL_BRIDGE/
├── packages/
│   ├── contracts/          # Foundry - Polygon ERC-20 contracts
│   ├── sdk/                # TypeScript SDK for bridging
│   └── frontend/           # Next.js bridge UI
├── deployments/            # NTT CLI configs (one per token)
└── scripts/                # Deployment and monitoring scripts
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Wormhole NTT CLI](https://github.com/wormhole-foundation/native-token-transfers)

### Installation

```bash
# Install dependencies
pnpm install

# Install Foundry dependencies
cd packages/contracts
forge install
```

### Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following variables:

- `POLYGON_PRIVATE_KEY` - Deployer private key
- `OWNER_ADDRESS` - Owner address (should be multisig for mainnet)
- `POLYGON_RPC_URL` - Polygon RPC endpoint
- `POLYGONSCAN_API_KEY` - For contract verification

## Deployment

### 1. Deploy ERC-20 Contracts

```bash
cd packages/contracts
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $POLYGON_RPC_URL --broadcast --verify
```

### 2. Deploy NTT Infrastructure

For each token:

```bash
cd deployments/<token>

# Add Solana chain (locking mode)
ntt add-chain Solana --latest --mode locking --token <SPL_MINT>

# Add Polygon chain (burning mode)
ntt add-chain Polygon --latest --mode burning --token <ERC20_ADDRESS>

# Register peers
ntt push
```

### 3. Set NTT Managers

Call `setNttManager(address)` on each ERC-20 contract with the deployed NTT Manager address.

### 4. Update Addresses

```bash
npx tsx scripts/update-addresses.ts
```

## Usage

### SDK

```typescript
import { PreStockBridge } from "@vaulto/bridge-sdk";

const bridge = await PreStockBridge.create({ network: "Mainnet" });

// Get quote
const quote = await bridge.getTransferQuote("spacex", 100n * 10n ** 8n, "Solana");

// Bridge Solana → Polygon
const result = await bridge.bridgeSolanaToPolygon(
  "spacex",
  100n * 10n ** 8n,
  solanaSigner,
  "0x..."
);
```

### Frontend

```bash
pnpm --filter @vaulto/bridge-frontend dev
```

Open http://localhost:3001

## Monitoring

### Supply Verification

Verify that supply invariants hold (Solana locked >= Polygon supply):

```bash
# Single check
npx tsx scripts/verify-supply.ts

# Continuous monitoring
npx tsx scripts/verify-supply.ts --continuous
```

### Rate Limits

Default: 100,000 tokens/day per direction per token

Adjust in `deployments/<token>/deployment.json` and redeploy NTT.

## Security

- **Supply Invariant**: Continuous monitoring ensures Solana locked >= Polygon supply
- **Rate Limits**: Configurable daily limits prevent rapid draining
- **Pausable**: ERC-20 contracts can be paused in emergencies
- **Multi-sig**: Use Gnosis Safe for owner operations on mainnet

## Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│     Solana      │                    │     Polygon     │
│                 │                    │                 │
│  ┌───────────┐  │    Wormhole NTT    │  ┌───────────┐  │
│  │ SPL Token │  │◄──────────────────►│  │  ERC-20   │  │
│  └─────┬─────┘  │                    │  └─────┬─────┘  │
│        │        │                    │        │        │
│  ┌─────▼─────┐  │                    │  ┌─────▼─────┐  │
│  │  NTT Mgr  │  │                    │  │  NTT Mgr  │  │
│  │ (LOCKING) │  │                    │  │ (BURNING) │  │
│  └───────────┘  │                    │  └───────────┘  │
└─────────────────┘                    └─────────────────┘
```

## License

MIT
