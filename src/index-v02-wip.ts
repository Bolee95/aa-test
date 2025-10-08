import { ethers } from 'ethers';
import { SimpleAccountAPI, HttpRpcClient } from '@account-abstraction/sdk';

/**
 * Test script demonstrating Account Abstraction SDK usage
 * This showcases:
 * 1. Creating a UserOperation with initCode (for new account deployment)
 * 2. Including paymasterAndData field for gasless transactions
 * 3. Calling a simple method on a contract
 */

import dotenv from 'dotenv';
dotenv.config(); // Loads environment variables from .env

// Configuration
const ENTRYPOINT_ADDRESS = process.env.ENTRYPOINT_ADDRESS!;
const BUNDLER_URL = process.env.BUNDLER_URL!;
const RPC_URL = process.env.RPC_URL!;
const ACCOUNT_FACTORY_ADDRESS = process.env.ACCOUNT_FACTORY_ADDRESS!;
const COUNTER_ADDRESS = process.env.COUNTER_ADDRESS!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// Simple counter contract ABI (example target contract)
const COUNTER_ABI = [
  'function increment() external',
  'function getCount() external view returns (uint256)'
];

async function main() {
  console.log('🚀 Starting Account Abstraction SDK Test\n');

  // 1. Setup provider and owner wallet
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(PRIVATE_KEY).connect(provider);

  console.log('Owner Address:', ownerWallet.address);
  console.log('Owner Private Key:', ownerWallet.privateKey);

  // 2. Initialize the bundler client
  const bundlerClient = new HttpRpcClient(
    BUNDLER_URL,
    ENTRYPOINT_ADDRESS,
    await provider.getNetwork().then(n => n.chainId)
  );

  // 3. Create SimpleAccountAPI instance
  const accountAPI = new SimpleAccountAPI({
    provider,
    entryPointAddress: ENTRYPOINT_ADDRESS,
    owner: ownerWallet,
    factoryAddress: ACCOUNT_FACTORY_ADDRESS,
    // Use index: 0 to use the first deterministic account
    index: 0
  });

  // 4. Get the counterfactual address (address before deployment)
  const accountAddress = await accountAPI.getAccountAddress();
  console.log('\n📍 Smart Account Address:', accountAddress);

  // 5. Check if account is deployed
  const isDeployed = await accountAPI.checkAccountPhantom();
  console.log('Is Account Deployed:', !isDeployed);

  // 6. Create a simple contract interaction
  // Example: calling increment() on a counter contract
  const counter = new ethers.Contract(COUNTER_ADDRESS, COUNTER_ABI, provider);

  // Encode the function call
  const callData = counter.interface.encodeFunctionData('increment');

  console.log('\n🔨 Building UserOperation...');

  // 7. Create UserOperation WITHOUT paymaster first (if you want gasless, set to empty)
  // For this demo, we'll create it WITHOUT paymaster to test basic flow first
  let userOp = await accountAPI.createUnsignedUserOp({
    target: COUNTER_ADDRESS,
    data: callData,
    value: 0,
    gasLimit: 200000, // Reduce gas limit for simulation
  });

  // 8. Get initCode (this will be non-empty if account is not deployed)
  // initCode = factoryAddress + factoryCalldata
  // const initCode = await accountAPI.getInitCode();
  // userOp.initCode = initCode;

  console.log('\n📋 UserOperation Details:');
  console.log('Sender:', userOp.sender);
  console.log('Nonce:', userOp.nonce);
  // console.log('InitCode:', userOp.initCode);
  // console.log('InitCode Length:', userOp.initCode.length);
  console.log('CallData:', userOp.callData);



  // 9. Set paymasterAndData to the paymaster address
  // NOTE: Your custom Paymaster contract validates on-chain (checks if account is registered)
  // It does NOT require the paymaster to sign the UserOp!
  // The validation happens in _validatePaymasterUserOp which checks:
  // 1. Caller is EntryPoint
  // 2. Paymaster has enough deposit
  // 3. Account is registered in the factory
  // userOp.paymasterAndData = PAYMASTER_ADDRESS;
  
  // IMPORTANT: paymasterAndData must be set BEFORE signing because it's part of the userOpHash!

  console.log('PaymasterAndData:', userOp.paymasterAndData);
  console.log('PreVerificationGas:', userOp.preVerificationGas);
  console.log('VerificationGasLimit:', userOp.verificationGasLimit);
  console.log('CallGasLimit:', userOp.callGasLimit);
  console.log('MaxFeePerGas:', userOp.maxFeePerGas);
  console.log('MaxPriorityFeePerGas:', userOp.maxPriorityFeePerGas);

  // 10. Get the UserOp hash and sign it
  userOp = await accountAPI.signUserOp(userOp);

  // 11. Display signature
  console.log('Signature:', userOp.signature);

  // 12. Send UserOperation to bundler
  console.log('\n📤 Sending UserOperation to bundler...');

  console.log(`Full userOp: ${JSON.stringify(userOp, null, 4)}`)
  console.log(`PreVerify gas: ${await userOp.preVerificationGas}`)

  try {
    const userOpResponse = await bundlerClient.sendUserOpToBundler(userOp);
    console.log('✅ UserOp submitted successfully!');
    console.log('UserOp Hash from Bundler:', userOpResponse);

    // 13. Wait for the UserOperation to be mined
    console.log('\n⏳ Waiting for UserOp to be mined...');

    // Note: In a real implementation, you would poll for the receipt
    // For this demo, we just log the submitted hash
    //  const txHash = await bundlerClient.getUserOperationReceipt(userOpHash)
    console.log('UserOp submitted. In production, poll for receipt using:');
    console.log('  const txHash = await bundlerClient.getUserOperationReceipt(userOpHash)');

  } catch (error) {
    console.error('❌ Error sending UserOperation:', error);
    throw error;
  }

  console.log('\n✨ Test completed successfully!');
}

// Run the test
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
