import { ethers } from 'ethers';

import dotenv from 'dotenv';
dotenv.config(); // Loads environment variables from .env

/**
 * Working solution for EntryPoint v0.8 without SDK
 * Manually constructs and signs UserOperations with proper EIP-712
 *
 * NOTE: Paymaster integration is included but may fail with AA24 due to bundler-side validation.
 * The signature itself is cryptographically valid (verified on-chain), but some bundlers
 * may have issues with paymaster validation. If you get AA24 with paymaster, set
 * paymasterAndData to '0x' to bypass the paymaster.
 */

// Configuration
const ENTRYPOINT_ADDRESS = process.env.ENTRYPOINT_ADDRESS;
const BUNDLER_URL = process.env.BUNDLER_URL;
const RPC_URL = process.env.RPC_URL;
const SMART_ACCOUNT_ADDRESS = process.env.SMART_ACCOUNT_ADDRESS_0; // Pre-deployed account
const COUNTER_ADDRESS = process.env.COUNTER_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const COUNTER_ABI = [
  'function increment() external',
  'function getCount() external view returns (uint256)'
];

const ENTRYPOINT_ABI = [
  'function getNonce(address sender, uint192 key) view returns (uint256)',
];

// EIP-712 domain for EntryPoint v0.8
const EIP712_DOMAIN = {
  name: 'ERC4337',
  version: '1',
  chainId: 0, // Will be set dynamically
  verifyingContract: ENTRYPOINT_ADDRESS,
};

// PackedUserOperation type for EIP-712
// IMPORTANT: initCode, callData, and paymasterAndData are 'bytes', not 'bytes32'
// EIP-712 will automatically hash them during encoding
const PACKED_USER_OP_TYPE = {
  PackedUserOperation: [
    { name: 'sender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'initCode', type: 'bytes' },
    { name: 'callData', type: 'bytes' },
    { name: 'accountGasLimits', type: 'bytes32' },
    { name: 'preVerificationGas', type: 'uint256' },
    { name: 'gasFees', type: 'bytes32' },
    { name: 'paymasterAndData', type: 'bytes' },
  ],
};

function packGasValues(high128: ethers.BigNumber, low128: ethers.BigNumber): string {
  const high = ethers.utils.hexZeroPad(high128.toHexString(), 16);
  const low = ethers.utils.hexZeroPad(low128.toHexString(), 16);
  return high + low.slice(2); // Remove 0x from low and concatenate
}

async function main() {
  console.log('🚀 Working UserOperation for EntryPoint v0.8\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const chainId = (await provider.getNetwork()).chainId;

  console.log('Owner Address:', ownerWallet.address);
  console.log('Smart Account Address:', SMART_ACCOUNT_ADDRESS);
  console.log('Chain ID:', chainId, '\n');

  // Get nonce from EntryPoint
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);
  const nonce = await entryPoint.getNonce(SMART_ACCOUNT_ADDRESS, 0);
  console.log('Nonce:', nonce.toString());

  // Encode the counter increment call
  const counter = new ethers.Contract(COUNTER_ADDRESS, COUNTER_ABI, provider);
  const counterCallData = counter.interface.encodeFunctionData('increment');

  // Encode the execute call on SimpleAccount
  const executeABI = ['function execute(address dest, uint256 value, bytes calldata func)'];
  const executeIface = new ethers.utils.Interface(executeABI);
  const callData = executeIface.encodeFunctionData('execute', [
    COUNTER_ADDRESS,
    0,
    counterCallData,
  ]);

  console.log('CallData:', callData, '\n');

  // Get gas prices (add 50% to ensure replacement works)
  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1', 'gwei'));
  const maxFeePerGas = (feeData.maxFeePerGas || ethers.utils.parseUnits('3', 'gwei'));

  // Gas limits - use high values to avoid AA95 errors
  const verificationGasLimit = ethers.BigNumber.from(500000); // High for account + paymaster validation
  const callGasLimit = ethers.BigNumber.from(300000);
  const preVerificationGas = ethers.BigNumber.from(100000);

  // Pack gas values into bytes32
  const accountGasLimits = packGasValues(verificationGasLimit, callGasLimit);
  const gasFees = packGasValues(maxPriorityFeePerGas, maxFeePerGas);

  console.log('Gas Configuration:');
  console.log('  VerificationGasLimit:', verificationGasLimit.toString());
  console.log('  CallGasLimit:', callGasLimit.toString());
  console.log('  PreVerificationGas:', preVerificationGas.toString());
  console.log('  MaxFeePerGas:', ethers.utils.formatUnits(maxFeePerGas, 'gwei'), 'gwei');
  console.log('  MaxPriorityFeePerGas:', ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei'), 'gwei\n');

  // Create UserOp struct for EIP-712 signing
  // Use actual bytes values, NOT hashes - EIP-712 will hash them automatically
  const userOpForSigning = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce,
    initCode: '0x', // actual bytes
    callData: callData, // actual bytes
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: '0x', // No paymaster
  };

  console.log('🔑 Signing UserOperation with EIP-712...');

  // Update domain with chainId
  const domain = { ...EIP712_DOMAIN, chainId };

  // Sign with EIP-712 (this is the correct way for v0.8)
  const signature = await ownerWallet._signTypedData(domain, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('Signature:', signature, '\n');

  // Create the actual UserOp to send to bundler (hybrid format with both packed and unpacked)
  const userOpToSend: any = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: ethers.utils.hexValue(nonce),
    initCode: '0x',
    callData: callData,
    // Unpacked gas fields (for bundler validation)
    callGasLimit: ethers.utils.hexValue(callGasLimit),
    verificationGasLimit: ethers.utils.hexValue(verificationGasLimit),
    preVerificationGas: ethers.utils.hexValue(preVerificationGas),
    maxFeePerGas: ethers.utils.hexValue(maxFeePerGas),
    maxPriorityFeePerGas: ethers.utils.hexValue(maxPriorityFeePerGas),
    signature: signature,
  };

  console.log('📤 Sending UserOperation to bundler...');
  console.log(JSON.stringify(userOpToSend, null, 2), '\n');

  try {
    // Send directly to bundler RPC with proper format
    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendUserOperation',
      params: [userOpToSend, ENTRYPOINT_ADDRESS],
    };

    console.log('Full request:', JSON.stringify(requestBody, null, 2), '\n');

    const response = await fetch(BUNDLER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log('Bundler response:', JSON.stringify(result, null, 2), '\n');

    if (result.error) {
      throw new Error(`Bundler error: ${result.error.message}`);
    }

    const userOpHash = result.result;
    console.log('✅ UserOp submitted successfully!');
    console.log('UserOp Hash:', userOpHash);

    console.log('\n⏳ Waiting for transaction to be mined...');
    // Wait a bit for bundler to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const receiptResponse = await fetch(BUNDLER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        }),
      });
      const receiptResult = await receiptResponse.json();
      if (receiptResult.result) {
        console.log('✅ Transaction mined!');
        console.log('Receipt:', JSON.stringify(receiptResult.result, null, 2));
      } else {
        console.log('Note: Receipt not yet available. Transaction may still be pending.');
      }
    } catch (e) {
      console.log('Note: Receipt not yet available. Transaction may still be pending.');
    }

  } catch (error: any) {
    console.error('❌ Error sending UserOperation:', error.message);
    if (error.body) {
      console.error('Error body:', error.body);
    }
    throw error;
  }

  console.log('\n✨ Test completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
