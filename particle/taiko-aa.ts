/**
 * Particle Network Account Abstraction Demo on Taiko
 *
 * This script demonstrates how to:
 * 1. Initialize Particle Network's SmartAccount on Taiko
 * 2. Create a UserOperation to interact with Counter.sol
 * 3. Sign and send the UserOperation for execution
 */

import { SmartAccount } from '@particle-network/aa/dist/esm/index.mjs';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

// Particle Network credentials (get from https://dashboard.particle.network)
const PARTICLE_PROJECT_ID = process.env.PARTICLE_PROJECT_ID || '';
const PARTICLE_CLIENT_KEY = process.env.PARTICLE_CLIENT_KEY || '';
const PARTICLE_APP_ID = process.env.PARTICLE_APP_ID || '';

// Taiko Network Configuration
const TAIKO_MAINNET = {
  chainId: 167000,
  name: 'Taiko Mainnet',
  rpc: 'https://rpc.taiko.xyz',
  explorer: 'https://taikoscan.io'
};

const TAIKO_HOODI_TESTNET = {
  chainId: 167012,
  name: 'Taiko Hoodi Testnet',
  rpc: 'https://rpc.hoodi.taiko.xyz',
  explorer: 'https://hoodi.taikoscan.io'
};

// Choose network (change to TAIKO_MAINNET for production)
const NETWORK = TAIKO_HOODI_TESTNET;

// Counter contract address (deploy Counter.sol first)
const COUNTER_ADDRESS = process.env.COUNTER_ADDRESS || '';

// Owner EOA private key (your wallet that will control the smart account)
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || '';

// ============================================================================
// Counter Contract ABI
// ============================================================================

const COUNTER_ABI = [
  'function increment() external',
  'function getCount() external view returns (uint256)'
];

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Particle Network AA Demo on Taiko');
  console.log('='.repeat(60));
  console.log(`Network: ${NETWORK.name} (Chain ID: ${NETWORK.chainId})`);
  console.log(`RPC: ${NETWORK.rpc}`);
  console.log('='.repeat(60));

  // Validate configuration
  if (!PARTICLE_PROJECT_ID || !PARTICLE_CLIENT_KEY || !PARTICLE_APP_ID) {
    throw new Error('Missing Particle Network credentials. Set PARTICLE_PROJECT_ID, PARTICLE_CLIENT_KEY, and PARTICLE_APP_ID');
  }

  if (!COUNTER_ADDRESS) {
    throw new Error('Missing Counter contract address. Set COUNTER_ADDRESS or deploy Counter.sol first');
  }

  if (!OWNER_PRIVATE_KEY) {
    throw new Error('Missing owner private key. Set OWNER_PRIVATE_KEY');
  }

  // ============================================================================
  // Step 1: Setup Base Provider
  // ============================================================================
  console.log('\n[1] Setting up base provider...');

  const baseProvider = new ethers.JsonRpcProvider(NETWORK.rpc);
  const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, baseProvider);

  console.log(`    Owner EOA: ${ownerWallet.address}`);

  const balance = await baseProvider.getBalance(ownerWallet.address);
  console.log(`    Balance: ${ethers.formatEther(balance)} ETH`);

  // ============================================================================
  // Step 2: Initialize Particle SmartAccount
  // ============================================================================
  console.log('\n[2] Initializing Particle SmartAccount...');

  // Create EIP-1193 compatible provider from ethers wallet
  const eip1193Provider: any = {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        return [ownerWallet.address];
      }
      if (method === 'eth_chainId') {
        return `0x${NETWORK.chainId.toString(16)}`;
      }
      if (method === 'eth_sendTransaction') {
        const tx = params?.[0];
        const txResponse = await ownerWallet.sendTransaction(tx);
        return txResponse.hash;
      }
      if (method === 'eth_sign' || method === 'personal_sign') {
        const message = params?.[0];
        return await ownerWallet.signMessage(ethers.getBytes(message));
      }
      // Forward other requests to the base provider
      return await baseProvider.send(method, params || []);
    }
  };

  // Initialize SmartAccount with Particle Network
  const smartAccount = new SmartAccount(eip1193Provider, {
    projectId: PARTICLE_PROJECT_ID,
    clientKey: PARTICLE_CLIENT_KEY,
    appId: PARTICLE_APP_ID,
    aaOptions: {
      accountContracts: {
        SIMPLE: [
          {
            version: '1.0.0',
            chainIds: [NETWORK.chainId],
          }
        ],
      },
    },
  });

  // Set the smart account implementation to SimpleAccount
  smartAccount.setSmartAccountContract({
    name: 'SIMPLE',
    version: '1.0.0'
  });

  console.log('    SmartAccount initialized with SIMPLE account implementation');

  // Get smart account address
  const smartAccountAddress = await smartAccount.getAddress();
  console.log(`    Smart Account Address: ${smartAccountAddress}`);

  // Check if smart account is deployed
  const smartAccountCode = await baseProvider.getCode(smartAccountAddress);
  const isDeployed = smartAccountCode !== '0x';
  console.log(`    Is Deployed: ${isDeployed}`);

  if (!isDeployed) {
    console.log('    ⚠️  Smart account will be deployed with the first transaction');
  }

  // Check smart account balance
  const smartAccountBalance = await baseProvider.getBalance(smartAccountAddress);
  console.log(`    Smart Account Balance: ${ethers.formatEther(smartAccountBalance)} ETH`);

  // ============================================================================
  // Step 3: Read Current Counter Value
  // ============================================================================
  console.log('\n[3] Reading current counter value...');

  const counterContract = new ethers.Contract(
    COUNTER_ADDRESS,
    COUNTER_ABI,
    baseProvider
  );

  let currentCount: bigint;
  try {
    currentCount = await counterContract.getCount();
    console.log(`    Current count: ${currentCount}`);
  } catch (error) {
    console.error('    ❌ Failed to read counter. Is the contract deployed?');
    throw error;
  }

  // ============================================================================
  // Step 4: Create UserOperation to Increment Counter
  // ============================================================================
  console.log('\n[4] Creating UserOperation to increment counter...');

  // Encode the increment() function call
  const counterInterface = new ethers.Interface(COUNTER_ABI);
  const incrementCalldata = counterInterface.encodeFunctionData('increment');

  console.log(`    Target: ${COUNTER_ADDRESS}`);
  console.log(`    Calldata: ${incrementCalldata}`);

  // Build the transaction object
  const tx = {
    to: COUNTER_ADDRESS,
    value: '0x0',
    data: incrementCalldata,
  };

  console.log('    Transaction object created');

  // ============================================================================
  // Step 5: Estimate Gas and Get Fee Quotes (Optional)
  // ============================================================================
  console.log('\n[5] Getting fee quotes...');

  try {
    // Note: getFeeQuotes is available in newer SDK versions with gasless sponsorship
    if (typeof (smartAccount as any).getFeeQuotes === 'function') {
      const feeQuotes = await smartAccount.getFeeQuotes(tx);
      console.log('    Fee quotes received:');

      if (feeQuotes?.verifyingPaymasterGasless) {
        console.log('    ✓ Gasless transaction available (sponsored)');
      }
      if (feeQuotes?.verifyingPaymasterNative) {
        console.log('    ✓ Native token payment available');
      }
      if (feeQuotes?.tokenPaymaster) {
        console.log('    ✓ ERC-20 token payment available');
      }
    } else {
      console.log('    ℹ️  Fee quotes not available in this SDK version');
    }
  } catch (error) {
    console.log('    ⚠️  Could not fetch fee quotes, proceeding with standard flow');
  }

  // ============================================================================
  // Step 6: Build and Send UserOperation
  // ============================================================================
  console.log('\n[6] Building and sending UserOperation...');

  try {
    // Option A: Using buildUserOperation + sendUserOperation (lower level)
    console.log('    Building UserOperation...');

    const userOperation = await smartAccount.buildUserOperation({
      tx,
      feeQuote: undefined, // Use default fee settings
    });

    console.log('    UserOperation built successfully');
    console.log(`    Sender: ${userOperation.userOp.sender}`);
    console.log(`    Nonce: ${userOperation.userOp.nonce}`);
    console.log(`    CallGasLimit: ${userOperation.userOp.callGasLimit}`);
    console.log(`    VerificationGasLimit: ${userOperation.userOp.verificationGasLimit}`);
    console.log(`    PreVerificationGas: ${userOperation.userOp.preVerificationGas}`);

    console.log('\n    Signing and sending UserOperation...');

    const userOpHash = await smartAccount.sendUserOperation({
      userOpHash: userOperation.userOpHash, userOp: userOperation.userOp
    });

    console.log(`    ✓ UserOperation sent!`);
    console.log(`    UserOp Hash: ${userOpHash}`);

    // Wait for the UserOperation to be included in a block
    console.log('\n    Waiting for UserOperation to be mined...');

    // Poll for transaction receipt (simplified version)
    let receipt = null;
    let attempts = 0;
    const maxAttempts = 60; // Wait up to 60 seconds

    while (!receipt && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;

      try {
        // Try to get the transaction receipt
        // Note: The actual transaction hash might be different from userOpHash
        // In production, you'd use the bundler's eth_getUserOperationReceipt
        receipt = await baseProvider.getTransactionReceipt(userOpHash);
      } catch (e) {
        // Receipt not available yet
      }

      if (attempts % 5 === 0) {
        console.log(`    Still waiting... (${attempts}s)`);
      }
    }

    if (receipt) {
      console.log(`    ✓ Transaction mined in block ${receipt.blockNumber}`);
      console.log(`    Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`    Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    } else {
      console.log('    ⚠️  Transaction pending (check explorer for status)');
    }

  } catch (error: any) {
    console.error('    ❌ Failed to send UserOperation:');
    console.error(`    ${error.message}`);
    throw error;
  }

  // ============================================================================
  // Step 7: Verify Counter Increment
  // ============================================================================
  console.log('\n[7] Verifying counter increment...');

  // Wait a bit for state to update
  await new Promise(resolve => setTimeout(resolve, 3000));

  const newCount = await counterContract.getCount();
  console.log(`    New count: ${newCount}`);

  if (newCount > currentCount) {
    console.log(`    ✓ Counter incremented successfully! (${currentCount} → ${newCount})`);
  } else {
    console.log('    ⚠️  Counter value unchanged. Transaction may still be pending.');
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Smart Account: ${smartAccountAddress}`);
  console.log(`Counter Before: ${currentCount}`);
  console.log(`Counter After: ${newCount}`);
  console.log(`Network: ${NETWORK.name}`);
  console.log(`Explorer: ${NETWORK.explorer}`);
  console.log('='.repeat(60));
}

// ============================================================================
// Execute
// ============================================================================

main()
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:');
    console.error(error);
    process.exit(1);
  });
