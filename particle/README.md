# Particle Network Account Abstraction on Taiko

This demo shows how to use Particle Network's Account Abstraction SDK on Taiko to create and send UserOperations.

## Overview

The script (`taiko-aa.ts`) demonstrates:
1. Initializing a Particle Network SmartAccount on Taiko
2. Creating a UserOperation to call `increment()` on Counter.sol
3. Signing and sending the UserOperation
4. Verifying the transaction execution

## Prerequisites

### 1. Get Particle Network Credentials

Sign up at [Particle Dashboard](https://dashboard.particle.network) and create a new project to get:
- `PARTICLE_PROJECT_ID`
- `PARTICLE_CLIENT_KEY`
- `PARTICLE_APP_ID`

### 2. Deploy Counter Contract

Deploy the Counter.sol contract to Taiko:

```bash
cd ../contracts

# For Taiko Hoodi Testnet
forge script script/DeployCounter.s.sol:DeployCounter \
  --rpc-url https://rpc.hoodi.taiko.xyz \
  --private-key <your-private-key> \
  --broadcast

# For Taiko Mainnet
forge script script/DeployCounter.s.sol:DeployCounter \
  --rpc-url https://rpc.taiko.xyz \
  --private-key <your-private-key> \
  --broadcast
```

Note the deployed Counter contract address.

### 3. Fund Your Wallet

Make sure your EOA wallet has some ETH on Taiko:
- **Testnet**: Get testnet ETH from [Taiko Hoodi Faucet](https://hoodi.taikoscan.io/faucet)
- **Mainnet**: Bridge ETH to Taiko via [Taiko Bridge](https://bridge.taiko.xyz)

## Setup

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
PARTICLE_PROJECT_ID=your_project_id_here
PARTICLE_CLIENT_KEY=your_client_key_here
PARTICLE_APP_ID=your_app_id_here
COUNTER_ADDRESS=0x...  # Your deployed Counter contract address
OWNER_PRIVATE_KEY=0x...  # Your wallet private key
```

### 3. Choose Network

By default, the script uses **Taiko Hoodi Testnet**. To use mainnet, edit `taiko-aa.ts`:

```typescript
// Change this line:
const NETWORK = TAIKO_HOODI_TESTNET;
// To:
const NETWORK = TAIKO_MAINNET;
```

## Usage

Run the script:

```bash
npm start
# or
yarn start
```

## What Happens

1. **Provider Setup**: Creates an ethers provider connected to Taiko RPC
2. **SmartAccount Init**: Initializes Particle's SmartAccount with SIMPLE implementation
3. **Read Counter**: Reads the current counter value
4. **Create UserOp**: Builds a UserOperation to call `increment()`
5. **Sign & Send**: Signs and submits the UserOp through Particle's infrastructure
6. **Verify**: Confirms the counter was incremented

## Network Configuration

### Taiko Mainnet (Alethia)
- Chain ID: `167000`
- RPC: `https://rpc.taiko.xyz`
- Explorer: `https://taikoscan.io`

### Taiko Hoodi Testnet
- Chain ID: `167012`
- RPC: `https://rpc.hoodi.taiko.xyz`
- Explorer: `https://hoodi.taikoscan.io`

## Smart Account Details

- **Implementation**: SimpleAccount (ERC-4337)
- **Deployment**: Auto-deployed on first transaction
- **Owner**: Your EOA wallet (from `OWNER_PRIVATE_KEY`)
- **Address**: Deterministic based on owner + salt

## Troubleshooting

### "Missing Particle Network credentials"
Make sure you've set all three Particle credentials in `.env`

### "Missing Counter contract address"
Deploy Counter.sol first and set `COUNTER_ADDRESS` in `.env`

### "Failed to read counter"
Verify the Counter contract is deployed at the specified address

### "Insufficient funds"
- For testnet: Get ETH from the [faucet](https://hoodi.taikoscan.io/faucet)
- For mainnet: Bridge ETH to Taiko

### Transaction pending
Check the transaction on the block explorer using the UserOp hash or smart account address

## Advanced Usage

### Gasless Transactions

If your Particle project has a paymaster configured, you can enable gasless transactions:

```typescript
const feeQuotes = await smartAccount.getFeeQuotes(tx);
const userOp = feeQuotes.verifyingPaymasterGasless.userOp;
const userOpHash = await smartAccount.sendUserOperation({ userOp });
```

### Batch Transactions

To execute multiple transactions in one UserOp:

```typescript
const tx = [
  { to: COUNTER_ADDRESS, data: incrementCalldata, value: '0x0' },
  { to: COUNTER_ADDRESS, data: incrementCalldata, value: '0x0' },
  { to: COUNTER_ADDRESS, data: incrementCalldata, value: '0x0' }
];

const userOp = await smartAccount.buildUserOperation({ tx });
```

## Resources

- [Particle Network Docs](https://developers.particle.network)
- [Particle Dashboard](https://dashboard.particle.network)
- [Taiko Docs](https://docs.taiko.xyz)
- [ERC-4337 Spec](https://eips.ethereum.org/EIPS/eip-4337)

## Notes

- The first transaction will deploy your smart account (higher gas cost)
- Smart account address is deterministic and won't change
- Keep your `OWNER_PRIVATE_KEY` secure - it controls the smart account
- For production, use environment variables and never commit `.env`
