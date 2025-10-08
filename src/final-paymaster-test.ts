import { ethers } from 'ethers';
import { HttpRpcClient } from '@account-abstraction/sdk';

const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const BUNDLER_URL = 'http://localhost:3000/rpc';
const RPC_URL = 'http://localhost:8545';
const SMART_ACCOUNT_ADDRESS = '0x02fafFd17d2B367E437f2C331221e46217a07017';
const COUNTER_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const PAYMASTER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

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
  console.log('🧪 Final Paymaster Test with On-Chain Hash Verification\n');

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

  // Create paymaster field
  const paymasterVerificationGasLimit = ethers.BigNumber.from(100000);
  const paymasterPostOpGasLimit = ethers.BigNumber.from(50000);
  const paymasterAndData = ethers.utils.hexConcat([
    PAYMASTER_ADDRESS,
    ethers.utils.hexZeroPad(paymasterVerificationGasLimit.toHexString(), 16),
    ethers.utils.hexZeroPad(paymasterPostOpGasLimit.toHexString(), 16),
  ]);

  console.log('PaymasterAndData:', paymasterAndData, '\n');

  // Sign the UserOp
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

  console.log('🔑 Signing UserOp...');
  const signature = await ownerWallet._signTypedData(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('Signature:', signature);

  // Build UserOp for on-chain verification
  const userOpForOnChainCheck = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce,
    initCode: '0x',
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: paymasterAndData,
    signature: signature,
  };

  console.log('\n📞 Getting hash from EntryPoint...');
  const hashFromEntryPoint = await entryPoint.getUserOpHash(userOpForOnChainCheck);
  console.log('Hash:', hashFromEntryPoint);

  // Recover signer
  const recovered = ethers.utils.recoverAddress(hashFromEntryPoint, signature);
  console.log('\n👤 Recovered address:', recovered);
  console.log('Expected address: ', ownerWallet.address);
  console.log('✅ Signature valid:', recovered.toLowerCase() === ownerWallet.address.toLowerCase());

  // Prepare for bundler
  const userOpToSend = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: ethers.utils.hexValue(nonce),
    initCode: '0x',
    callData: callData,
    callGasLimit: ethers.utils.hexValue(callGasLimit),
    verificationGasLimit: ethers.utils.hexValue(verificationGasLimit),
    preVerificationGas: ethers.utils.hexValue(preVerificationGas),
    maxFeePerGas: ethers.utils.hexValue(maxFeePerGas),
    maxPriorityFeePerGas: ethers.utils.hexValue(maxPriorityFeePerGas),
    paymasterAndData: paymasterAndData,
    signature: signature,
  };

  console.log('\n📤 Sending to bundler...');
  console.log(JSON.stringify(userOpToSend, null, 2));

  try {
    const bundlerClient = new HttpRpcClient(BUNDLER_URL, ENTRYPOINT_ADDRESS, 31337);
    const userOpHash = await bundlerClient.sendUserOpToBundler(userOpToSend);
    console.log('\n✅ SUCCESS! UserOp Hash:', userOpHash);
  } catch (error: any) {
    console.error('\n❌ Bundler rejected:', error.message);
    if (error.body) {
      console.error('Details:', error.body);
    }
  }
}

main().catch(console.error);
