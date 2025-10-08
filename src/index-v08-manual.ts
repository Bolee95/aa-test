import { ethers } from 'ethers';
import { HttpRpcClient } from '@account-abstraction/sdk';

/**
 * Manual UserOperation creation and signing for EntryPoint v0.8
 * The SDK v0.6 doesn't support v0.8, so we need to manually handle EIP-712 signing
 */

// Configuration
const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2'; // v0.8 EntryPoint
const BUNDLER_URL = 'http://localhost:3000/rpc';
const RPC_URL = 'http://localhost:8545';
const SMART_ACCOUNT_ADDRESS = '0x02fafFd17d2B367E437f2C331221e46217a07017'; // Pre-deployed account
const COUNTER_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

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
const PACKED_USER_OP_TYPE = {
  PackedUserOperation: [
    { name: 'sender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'initCode', type: 'bytes32' }, // hash of initCode
    { name: 'callData', type: 'bytes32' }, // hash of callData
    { name: 'accountGasLimits', type: 'bytes32' },
    { name: 'preVerificationGas', type: 'uint256' },
    { name: 'gasFees', type: 'bytes32' },
    { name: 'paymasterAndData', type: 'bytes32' }, // hash of paymasterAndData
  ],
};

function packGasValues(high128: ethers.BigNumber, low128: ethers.BigNumber): string {
  const high = ethers.utils.hexZeroPad(high128.toHexString(), 16);
  const low = ethers.utils.hexZeroPad(low128.toHexString(), 16);
  return high + low.slice(2); // Remove 0x from low and concatenate
}

async function main() {
  console.log('🚀 Manual UserOperation for EntryPoint v0.8\n');

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
  // SimpleAccount.execute(address dest, uint256 value, bytes calldata func)
  const executeABI = ['function execute(address dest, uint256 value, bytes calldata func)'];
  const executeIface = new ethers.utils.Interface(executeABI);
  const callData = executeIface.encodeFunctionData('execute', [
    COUNTER_ADDRESS,
    0,
    counterCallData,
  ]);

  console.log('CallData:', callData);

  // Get gas prices
  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1', 'gwei');
  const maxFeePerGas = feeData.maxFeePerGas || ethers.utils.parseUnits('3', 'gwei');

  // Gas limits
  const verificationGasLimit = ethers.BigNumber.from(100000);
  const callGasLimit = ethers.BigNumber.from(200000);
  const preVerificationGas = ethers.BigNumber.from(44152);

  // Pack gas values into bytes32
  const accountGasLimits = packGasValues(verificationGasLimit, callGasLimit);
  const gasFees = packGasValues(maxPriorityFeePerGas, maxFeePerGas);

  console.log('Gas Limits:');
  console.log('  Verification:', verificationGasLimit.toString());
  console.log('  Call:', callGasLimit.toString());
  console.log('  PreVerification:', preVerificationGas.toString());
  console.log('  MaxFeePerGas:', ethers.utils.formatUnits(maxFeePerGas, 'gwei'), 'gwei');
  console.log('  MaxPriorityFeePerGas:', ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei'), 'gwei\n');

  // Create UserOp struct for EIP-712 signing
  const userOpForSigning = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce.toHexString(),
    initCode: ethers.utils.keccak256('0x'), // hash of empty initCode
    callData: ethers.utils.keccak256(callData), // hash of callData
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas.toHexString(),
    gasFees: gasFees,
    paymasterAndData: ethers.utils.keccak256('0x'), // hash of empty paymasterAndData
  };

  console.log('🔑 Signing UserOperation with EIP-712...');

  // Update domain with chainId
  const domain = { ...EIP712_DOMAIN, chainId };

  // Sign with EIP-712
  const signature = await ownerWallet._signTypedData(domain, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('Signature:', signature, '\n');

  // Create the actual UserOp to send to bundler (with unpacked values)
  const userOpToSend = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce.toHexString(),
    initCode: '0x', // actual initCode (not hash)
    callData: callData, // actual callData (not hash)
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas.toHexString(),
    gasFees: gasFees,
    paymasterAndData: '0x', // actual paymasterAndData (not hash)
    signature: signature,
  };

  console.log('📤 Sending UserOperation to bundler...');
  console.log(JSON.stringify(userOpToSend, null, 2), '\n');

  try {
    const bundlerClient = new HttpRpcClient(BUNDLER_URL, ENTRYPOINT_ADDRESS, chainId);
    const userOpHash = await bundlerClient.sendUserOpToBundler(userOpToSend);
    console.log('✅ UserOp submitted successfully!');
    console.log('UserOp Hash:', userOpHash);
  } catch (error: any) {
    console.error('❌ Error sending UserOperation:', error.message);
    if (error.body) {
      console.error('Error body:', error.body);
    }
    throw error;
  }

  console.log('\n✨ Test completed successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
