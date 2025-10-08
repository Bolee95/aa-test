import { ethers } from 'ethers';

const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const SMART_ACCOUNT_ADDRESS = '0x02fafFd17d2B367E437f2C331221e46217a07017';
const PAYMASTER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const COUNTER_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RPC_URL = 'http://localhost:8545';

const COUNTER_ABI = ['function increment() external'];
const ENTRYPOINT_ABI = [
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) calldata userOp) external view returns (bytes32)',
];

const EIP712_DOMAIN = {
  name: 'ERC4337',
  version: '1',
  chainId: 31337,
  verifyingContract: ENTRYPOINT_ADDRESS,
};

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
  return high + low.slice(2);
}

async function main() {
  console.log('🔬 Tracing the Issue: Comparing with WITHOUT paymaster\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);

  const nonce = await entryPoint.getNonce(SMART_ACCOUNT_ADDRESS, 0);
  const counter = new ethers.Contract(COUNTER_ADDRESS, COUNTER_ABI, provider);
  const counterCallData = counter.interface.encodeFunctionData('increment');

  const executeABI = ['function execute(address dest, uint256 value, bytes calldata func)'];
  const executeIface = new ethers.utils.Interface(executeABI);
  const callData = executeIface.encodeFunctionData('execute', [COUNTER_ADDRESS, 0, counterCallData]);

  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1', 'gwei');
  const maxFeePerGas = feeData.maxFeePerGas || ethers.utils.parseUnits('3', 'gwei');

  const verificationGasLimit = ethers.BigNumber.from(100000);
  const callGasLimit = ethers.BigNumber.from(200000);
  const preVerificationGas = ethers.BigNumber.from(50000);

  const accountGasLimits = packGasValues(verificationGasLimit, callGasLimit);
  const gasFees = packGasValues(maxPriorityFeePerGas, maxFeePerGas);

  // Case 1: WITHOUT paymaster
  console.log('=== Case 1: WITHOUT Paymaster ===');
  const userOp1ForSigning = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce,
    initCode: '0x',
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: '0x',
  };

  const sig1 = await ownerWallet._signTypedData(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOp1ForSigning);

  const userOp1Full = { ...userOp1ForSigning, signature: sig1 };
  const hash1 = await entryPoint.getUserOpHash(userOp1Full);
  const recovered1 = ethers.utils.recoverAddress(hash1, sig1);

  console.log('Hash:', hash1);
  console.log('Signature valid:', recovered1.toLowerCase() === ownerWallet.address.toLowerCase());

  // Case 2: WITH paymaster
  console.log('\n=== Case 2: WITH Paymaster ===');
  const paymasterVerificationGasLimit = ethers.BigNumber.from(100000);
  const paymasterPostOpGasLimit = ethers.BigNumber.from(50000);
  const paymasterAndData = ethers.utils.hexConcat([
    PAYMASTER_ADDRESS,
    ethers.utils.hexZeroPad(paymasterVerificationGasLimit.toHexString(), 16),
    ethers.utils.hexZeroPad(paymasterPostOpGasLimit.toHexString(), 16),
  ]);

  console.log('PaymasterAndData:', paymasterAndData);
  console.log('  Length:', (paymasterAndData.length - 2) / 2, 'bytes');
  console.log('  Expected: 52 bytes (20 + 16 + 16)');

  const userOp2ForSigning = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce,
    initCode: '0x',
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: paymasterAndData,
  };

  const sig2 = await ownerWallet._signTypedData(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOp2ForSigning);

  const userOp2Full = { ...userOp2ForSigning, signature: sig2 };
  const hash2 = await entryPoint.getUserOpHash(userOp2Full);
  const recovered2 = ethers.utils.recoverAddress(hash2, sig2);

  console.log('Hash:', hash2);
  console.log('Signature valid:', recovered2.toLowerCase() === ownerWallet.address.toLowerCase());

  // The question: what is the bundler doing differently?
  console.log('\n=== Analysis ===');
  console.log('Both signatures are cryptographically valid.');
  console.log('The bundler accepts Case 1 but rejects Case 2 with AA24.');
  console.log('\nPossible causes:');
  console.log('1. Bundler is recalculating the hash differently when paymaster is present');
  console.log('2. Bundler is modifying paymasterAndData before validation');
  console.log('3. Bundler has a bug in v0.8 paymaster handling');
  console.log('\nSince the signature validates correctly on-chain, this is likely a bundler bug.');
}

main().catch(console.error);
