import { ethers } from 'ethers';

const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const SMART_ACCOUNT_ADDRESS = '0x02fafFd17d2B367E437f2C331221e46217a07017';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RPC_URL = 'http://localhost:8545';

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
    { name: 'initCode', type: 'bytes32' },
    { name: 'callData', type: 'bytes32' },
    { name: 'accountGasLimits', type: 'bytes32' },
    { name: 'preVerificationGas', type: 'uint256' },
    { name: 'gasFees', type: 'bytes32' },
    { name: 'paymasterAndData', type: 'bytes32' },
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

  console.log('Owner:', ownerWallet.address);
  console.log('Account:', SMART_ACCOUNT_ADDRESS);

  // Sample UserOp data
  const nonce = ethers.BigNumber.from(0);
  const callData = '0xb61d27f6000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000004d09de08a00000000000000000000000000000000000000000000000000000000';

  const verificationGasLimit = ethers.BigNumber.from(100000);
  const callGasLimit = ethers.BigNumber.from(200000);
  const preVerificationGas = ethers.BigNumber.from(50000);
  const maxPriorityFeePerGas = ethers.BigNumber.from('0x59682f00');
  const maxFeePerGas = ethers.BigNumber.from('0xa508a3b8');

  const accountGasLimits = packGasValues(verificationGasLimit, callGasLimit);
  const gasFees = packGasValues(maxPriorityFeePerGas, maxFeePerGas);

  const userOpForSigning = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce,
    initCode: ethers.utils.keccak256('0x'),
    callData: ethers.utils.keccak256(callData),
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: ethers.utils.keccak256('0x'),
  };

  console.log('\n📝 UserOp for signing:');
  console.log(JSON.stringify(userOpForSigning, null, 2));

  // Sign with EIP-712
  const signature = await ownerWallet._signTypedData(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('\n✍️  Signature:', signature);

  // Manually compute the EIP-712 hash
  const typedDataHash = ethers.utils._TypedDataEncoder.hash(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('\n🔑 Typed data hash:', typedDataHash);

  // Recover signer from signature
  const recoveredAddress = ethers.utils.recoverAddress(typedDataHash, signature);
  console.log('\n👤 Recovered address:', recoveredAddress);
  console.log('Expected address:', ownerWallet.address);
  console.log('Match:', recoveredAddress.toLowerCase() === ownerWallet.address.toLowerCase());
}

main().catch(console.error);
