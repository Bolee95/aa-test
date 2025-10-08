import { ethers } from 'ethers';

import dotenv from 'dotenv';
dotenv.config(); // Loads environment variables from .env

const ENTRYPOINT_ADDRESS = process.env.ENTRYPOINT_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const SMART_ACCOUNT_ADDRESS = process.env.SMART_ACCOUNT_ADDRESS_0!; // Pre-deployed account

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

  console.log('Owner:', ownerWallet.address);

  const nonce = ethers.BigNumber.from(0);
  const callData = '0xb61d27f6000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000004d09de08a00000000000000000000000000000000000000000000000000000000';

  const verificationGasLimit = ethers.BigNumber.from(100000);
  const callGasLimit = ethers.BigNumber.from(200000);
  const preVerificationGas = ethers.BigNumber.from(50000);
  const maxPriorityFeePerGas = ethers.BigNumber.from('0x59682f00');
  const maxFeePerGas = ethers.BigNumber.from('0xa508a3b8');

  const accountGasLimits = packGasValues(verificationGasLimit, callGasLimit);
  const gasFees = packGasValues(maxPriorityFeePerGas, maxFeePerGas);

  // UserOp with actual values (for EntryPoint call)
  const userOpActual = {
    sender: SMART_ACCOUNT_ADDRESS,
    nonce: nonce,
    initCode: '0x',
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: '0x',
    signature: '0x',
  };

  console.log('\n📞 Calling EntryPoint.getUserOpHash...');
  try {
    const hashFromEntryPoint = await entryPoint.getUserOpHash(userOpActual);
    console.log('Hash from EntryPoint:', hashFromEntryPoint);

    // Now compute our EIP-712 hash (use actual bytes, not hashes)
    const userOpForSigning = {
      sender: SMART_ACCOUNT_ADDRESS,
      nonce: nonce,
      initCode: '0x', // actual bytes, not hash
      callData: callData, // actual bytes, not hash
      accountGasLimits: accountGasLimits,
      preVerificationGas: preVerificationGas,
      gasFees: gasFees,
      paymasterAndData: '0x', // actual bytes, not hash
    };

    const ourHash = ethers.utils._TypedDataEncoder.hash(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
    console.log('Our computed hash:    ', ourHash);
    console.log('\n✅ Hashes match:', hashFromEntryPoint.toLowerCase() === ourHash.toLowerCase());

    // Sign and verify
    const signature = await ownerWallet._signTypedData(EIP712_DOMAIN, PACKED_USER_OP_TYPE, userOpForSigning);
    const recovered = ethers.utils.recoverAddress(ourHash, signature);
    console.log('\n Recovered from our hash:', recovered);
    console.log('Expected owner:         ', ownerWallet.address);
    console.log('Match:', recovered.toLowerCase() === ownerWallet.address.toLowerCase());

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.error) {
      console.error('Inner error:', error.error);
    }
  }
}

main().catch(console.error);
