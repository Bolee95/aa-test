import { ethers } from 'ethers';

const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const BUNDLER_URL = 'http://localhost:3000/rpc';
const SMART_ACCOUNT_ADDRESS = '0x02fafFd17d2B367E437f2C331221e46217a07017';
const PAYMASTER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const COUNTER_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RPC_URL = 'http://localhost:8545';

const COUNTER_ABI = ['function increment() external'];
const ENTRYPOINT_ABI = ['function getNonce(address sender, uint192 key) view returns (uint256)'];

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

async function sendDirectToBundler(userOp: any) {
  const response = await fetch(BUNDLER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_sendUserOperation',
      params: [userOp, ENTRYPOINT_ADDRESS],
      id: 1,
    }),
  });

  const result = await response.json();
  return result;
}

async function main() {
  console.log('🧪 Testing Direct Bundler Call with Paymaster\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);

  const nonce = await entryPoint.getNonce(SMART_ACCOUNT_ADDRESS, 0);
  console.log('Nonce:', nonce.toString());

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

  const paymasterVerificationGasLimit = ethers.BigNumber.from(100000);
  const paymasterPostOpGasLimit = ethers.BigNumber.from(50000);
  const paymasterAndData = ethers.utils.hexConcat([
    PAYMASTER_ADDRESS,
    ethers.utils.hexZeroPad(paymasterVerificationGasLimit.toHexString(), 16),
    ethers.utils.hexZeroPad(paymasterPostOpGasLimit.toHexString(), 16),
  ]);

  // Sign
  const userOpForSigning = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce,
    initCode: '0x',
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: paymasterAndData,
  };

  const signature = await ownerWallet._signTypedData(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);

  // Try different formats to see what bundler accepts

  console.log('\n📤 Test 1: With packed format (accountGasLimits, gasFees)');
  const userOp1 = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: ethers.utils.hexValue(nonce),
    initCode: '0x',
    callData: callData,
    accountGasLimits: accountGasLimits, // PACKED
    preVerificationGas: ethers.utils.hexValue(preVerificationGas),
    gasFees: gasFees, // PACKED
    paymasterAndData: paymasterAndData,
    signature: signature,
  };

  const result1 = await sendDirectToBundler(userOp1);
  if (result1.error) {
    console.log('❌ Error:', result1.error.message);
  } else {
    console.log('✅ Success:', result1.result);
  }

  console.log('\n📤 Test 2: With unpacked format (separate gas fields)');
  const userOp2 = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: ethers.utils.hexValue(nonce),
    initCode: '0x',
    callData: callData,
    callGasLimit: ethers.utils.hexValue(callGasLimit), // UNPACKED
    verificationGasLimit: ethers.utils.hexValue(verificationGasLimit), // UNPACKED
    preVerificationGas: ethers.utils.hexValue(preVerificationGas),
    maxFeePerGas: ethers.utils.hexValue(maxFeePerGas), // UNPACKED
    maxPriorityFeePerGas: ethers.utils.hexValue(maxPriorityFeePerGas), // UNPACKED
    paymasterAndData: paymasterAndData,
    signature: signature,
  };

  const result2 = await sendDirectToBundler(userOp2);
  if (result2.error) {
    console.log('❌ Error:', result2.error.message);
  } else {
    console.log('✅ Success:', result2.result);
  }
}

main().catch(console.error);
