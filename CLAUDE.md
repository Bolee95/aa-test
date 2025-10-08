# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an ERC-4337 Account Abstraction implementation with custom smart contracts (Solidity) and integration scripts (TypeScript). The project consists of two main parts:

1. **Smart Contracts** (`contracts/`): Foundry-based Solidity contracts implementing AccountFactory and Paymaster
2. **Integration Scripts** (`src/`): TypeScript scripts using the Account Abstraction SDK to interact with the contracts

## Architecture

### Smart Contracts (`contracts/src/`)

- **AccountFactory.sol**: Factory contract for deploying ERC-4337 SimpleAccount instances
  - Uses CREATE2 for deterministic account addresses
  - Tracks registered accounts via `_registeredAccounts` mapping
  - Only registers accounts when called through SenderCreator (during EntryPoint execution)
  - Key methods: `createAccount()`, `getAddress()`, `isRegistedAccount()`, `revokeRegisterdAccount()`

- **Paymaster.sol**: Sponsoring paymaster for gasless transactions
  - Inherits from BasePaymaster
  - References AccountFactory to check account registration status
  - Sponsorship logic in `_validatePaymasterUserOp()` allows accounts that are:
    1. Registered in the factory
    2. Have initCode (will be deployed during execution)
    3. Already deployed (have bytecode)
  - Does NOT require signature validation - all validation is on-chain

- **Counter.sol**: Simple counter contract used for testing UserOperations

### Integration Scripts (`src/`)

The TypeScript scripts use ethers v5 and the Account Abstraction SDK v0.6. Key scripts include:

- **index.ts**: Main SDK usage example showing how to create and submit UserOperations
- **debug-account-creation.ts**: Debugging tool for testing account creation from initCode
- **fund-paymaster.ts**: Helper to deposit ETH to the paymaster in the EntryPoint
- Various verification and debugging utilities

## Common Commands

### Smart Contracts (from `contracts/` directory)

```bash
# Build contracts
cd contracts && forge build

# Run tests
cd contracts && forge test

# Format contracts
cd contracts && forge fmt

# Deploy AccountFactory and Paymaster
cd contracts && forge script script/AccountAbstraction.s.sol:AAScript --rpc-url <rpc_url> --private-key <private_key> --broadcast

# Create gas snapshots
cd contracts && forge snapshot
```

### TypeScript Scripts (from `src/` directory)

```bash
# Run the main SDK test
cd src && npx tsx index.ts

# Debug account creation
cd src && npx tsx debug-account-creation.ts

# Fund the paymaster
cd src && npx tsx fund-paymaster.ts

# Check account registration
cd src && npx tsx check-account-registration.ts
```

## Important Configuration

### Contract Addresses (Hardcoded in scripts)

- **EntryPoint v0.6**: `0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2` (or `0xfa37cC200a5B6A030Eb355fC27b495740816c20b` in some scripts)
- **AccountFactory**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **Paymaster**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` (or `0x0165878A594ca255338adfa4d48449f69242Eb8F`)
- **Counter**: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`

These addresses are deployment-specific. Update them after deploying contracts.

### Network Configuration

- **Local RPC**: `http://localhost:8545` (Anvil/Hardhat)
- **Bundler**: `http://localhost:3000/rpc`
- **Test Private Key**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` (Anvil default account #0)

### Foundry Configuration (`contracts/foundry.toml`)

- Uses `via_ir = true` for optimizations
- Optimizer runs: 10,000
- Custom remappings:
  - `@openzeppelin/` → `lib/openzeppelin-contracts/`
  - `account-abstraction/` → `lib/account-abstraction/contracts/`

## Key Implementation Details

### Account Registration Flow

The AccountFactory only registers accounts when called through the EntryPoint's SenderCreator. This prevents arbitrary account registration:

```solidity
// Only register if called through SenderCreator (during actual execution)
if (msg.sender == address(senderCreator)) {
    _registeredAccounts[addr] = true;
    emit AccountRegistered(addr);
}
```

### Paymaster Validation

The Paymaster does NOT require signature validation. All validation happens on-chain in `_validatePaymasterUserOp()`:
- Checks caller is EntryPoint
- Verifies paymaster has sufficient deposit
- Validates account authorization (registered OR has initCode OR is deployed)

When using the paymaster in TypeScript, set `paymasterAndData` to the paymaster address BEFORE signing, as it's part of the userOpHash.

### UserOperation Creation

The SDK (SimpleAccountAPI) handles most UserOp complexity, but key points:
- `initCode` is automatically populated if account is not deployed
- `paymasterAndData` must be set before signing if using a paymaster
- Gas values (preVerificationGas, verificationGasLimit, callGasLimit) are estimated by the SDK

## Dependencies

### Contracts
- Foundry/Forge
- OpenZeppelin Contracts (via forge-std)
- ERC-4337 Account Abstraction contracts (v0.6)

### TypeScript
- Node.js with ES modules support
- ethers v5.8.0
- @account-abstraction/sdk v0.6.0
- @account-abstraction/contracts v0.8.0
- TypeScript v5.9+
- tsx for running TypeScript directly
