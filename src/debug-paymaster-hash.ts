import { ethers } from 'ethers';

const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const SMART_ACCOUNT_ADDRESS = '0x02fafFd17d2B367E437f2C331221e46217a07017';
const PAYMASTER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RPC_URL = 'http://localhost:8545';

const ENTRYPOINT_ABI = [
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
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);

  const nonce = ethers.BigNumber.from(1);
  const callData = '0xb61d27f6000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000004d09de08a00000000000000000000000000000000000000000000000000000000';

  const verificationGasLimit = ethers.BigNumber.from(100000);
  const callGasLimit = ethers.BigNumber.from(200000);
  const preVerificationGas = ethers.BigNumber.from(50000);
  const maxPriorityFeePerGas = ethers.BigNumber.from('0x59682f00');
  const maxFeePerGas = ethers.BigNumber.from('0x9b9bf31e');

  const accountGasLimits = packGasValues(verificationGasLimit, callGasLimit);
  const gasFees = packGasValues(maxPriorityFeePerGas, maxFeePerGas);

  // Create paymasterAndData
  const paymasterVerificationGasLimit = ethers.BigNumber.from(100000);
  const paymasterPostOpGasLimit = ethers.BigNumber.from(50000);

  const paymasterAndData = ethers.utils.hexConcat([
    PAYMASTER_ADDRESS,
    ethers.utils.hexZeroPad(paymasterVerificationGasLimit.toHexString(), 16),
    ethers.utils.hexZeroPad(paymasterPostOpGasLimit.toHexString(), 16),
  ]);

  console.log('PaymasterAndData:', paymasterAndData);
  console.log('Length:', paymasterAndData.length, 'characters (including 0x)');
  console.log('Bytes:', (paymasterAndData.length - 2) / 2);

  // UserOp for EntryPoint call
  const userOpActual = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce,
    initCode: '0x',
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: paymasterAndData,
    signature: '0x',
  };

  console.log('\n📞 Getting hash from EntryPoint...');
  const hashFromEntryPoint = await entryPoint.getUserOpHash(userOpActual);
  console.log('Hash from EntryPoint:', hashFromEntryPoint);

  // Compute our hash
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

  const ourHash = ethers.utils._TypedDataEncoder.hash(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('Our computed hash:    ', ourHash);
  console.log('\n✅ Hashes match:', hashFromEntryPoint.toLowerCase() === ourHash.toLowerCase());

  // Sign and verify
  const signature = await ownerWallet._signTypedData(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
  const recovered = ethers.utils.recoverAddress(ourHash, signature);
  console.log('\n👤 Recovered:', recovered);
  console.log('Expected: ', ownerWallet.address);
  console.log('Match:', recovered.toLowerCase() === ownerWallet.address.toLowerCase());
}

main().catch(console.error);
