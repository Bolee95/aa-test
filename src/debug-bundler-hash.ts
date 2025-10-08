import { ethers } from 'ethers';

const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const SMART_ACCOUNT_ADDRESS = '0x02fafFd17d2B367E437f2C331221e46217a07017';
const PAYMASTER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RPC_URL = 'http://localhost:8545';
const COUNTER_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';

const ENTRYPOINT_ABI = [
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) calldata userOp) external view returns (bytes32)',
];

const ACCOUNT_ABI = [
  'function validateUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256 validationData)',
];

const COUNTER_ABI = ['function increment() external'];

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
  console.log('🔍 Deep Debugging: Checking Bundler vs EntryPoint Hash\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);
  const account = new ethers.Contract(SMART_ACCOUNT_ADDRESS, ACCOUNT_ABI, provider);

  const nonce = await entryPoint.getNonce(SMART_ACCOUNT_ADDRESS, 0);
  console.log('Current nonce:', nonce.toString());

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

  console.log('\n=== UserOp Details ===');
  console.log('Sender:', SMART_ACCOUNT_ADDRESS);
  console.log('Nonce:', nonce.toString());
  console.log('InitCode:', '0x');
  console.log('CallData:', callData);
  console.log('AccountGasLimits:', accountGasLimits);
  console.log('PreVerificationGas:', preVerificationGas.toString());
  console.log('GasFees:', gasFees);
  console.log('PaymasterAndData:', paymasterAndData);
  console.log('PaymasterAndData length:', paymasterAndData.length, 'chars,', (paymasterAndData.length - 2) / 2, 'bytes');

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

  console.log('\n=== Signing ===');
  const signature = await ownerWallet._signTypedData(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('Signature:', signature);

  // Build full UserOp
  const userOp = {
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

  console.log('\n=== Hash Verification ===');
  const hashFromEntryPoint = await entryPoint.getUserOpHash(userOp);
  console.log('Hash from EntryPoint:', hashFromEntryPoint);

  const ourHash = ethers.utils._TypedDataEncoder.hash(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('Our computed hash:    ', ourHash);
  console.log('Hashes match:', hashFromEntryPoint.toLowerCase() === ourHash.toLowerCase());

  const recovered = ethers.utils.recoverAddress(hashFromEntryPoint, signature);
  console.log('\n=== Signature Recovery ===');
  console.log('Recovered address:', recovered);
  console.log('Expected address: ', ownerWallet.address);
  console.log('Match:', recovered.toLowerCase() === ownerWallet.address.toLowerCase());

  // Now let's try to simulate validateUserOp call
  console.log('\n=== Simulating validateUserOp ===');
  try {
    // Call validateUserOp as the EntryPoint would
    const result = await provider.call({
      from: ENTRYPOINT_ADDRESS,
      to: SMART_ACCOUNT_ADDRESS,
      data: account.interface.encodeFunctionData('validateUserOp', [userOp, hashFromEntryPoint, 0]),
    });

    const decoded = account.interface.decodeFunctionResult('validateUserOp', result);
    console.log('✅ validateUserOp succeeded');
    console.log('ValidationData:', decoded.validationData.toString());

    if (decoded.validationData.toString() === '1') {
      console.log('⚠️  Validation returned SIG_VALIDATION_FAILED (1)');
    } else if (decoded.validationData.toString() === '0') {
      console.log('✅ Validation returned SIG_VALIDATION_SUCCESS (0)');
    }
  } catch (error: any) {
    console.error('❌ validateUserOp failed:', error.message);
    if (error.error) {
      console.error('Error data:', error.error);
    }
    if (error.data) {
      console.error('Revert data:', error.data);
    }
  }
}

main().catch(console.error);
