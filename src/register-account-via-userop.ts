import { ethers } from 'ethers';

/**
 * Simple script to create and register an account through UserOperation
 * This ensures the account is registered in the factory for paymaster authorization
 */

const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const FACTORY_ADDRESS = '0x8a791620dd6260079bf849dc5567adc3f2fdc318';
const BUNDLER_URL = 'http://localhost:3000/rpc';
const RPC_URL = 'http://localhost:8545';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SALT = 1; // Use salt=1 for new account

const FACTORY_ABI = [
  'function createAccount(address owner, uint256 salt) returns (address)',
  'function getAddress(address owner, uint256 salt) view returns (address)',
  'function isRegistedAccount(address) view returns (bool)',
];

const ENTRYPOINT_ABI = [
  'function getNonce(address sender, uint192 key) view returns (uint256)',
];

const EIP712_DOMAIN = {
  name: 'ERC4337',
  version: '1',
  chainId: 0,
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
  console.log('🚀 Creating account through UserOperation (salt=' + SALT + ')\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const chainId = (await provider.getNetwork()).chainId;

  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const predictedAddress = await factory.getAddress(ownerWallet.address, SALT);

  console.log('Owner:', ownerWallet.address);
  console.log('Predicted Account:', predictedAddress);

  // Check if already exists
  const code = await provider.getCode(predictedAddress);
  if (code !== '0x') {
    console.log('❌ Account already exists at this address');
    console.log('Try a different salt value\n');
    return;
  }

  // Build initCode
  const createAccountCallData = factory.interface.encodeFunctionData('createAccount', [
    ownerWallet.address,
    SALT,
  ]);
  const initCode = ethers.utils.hexConcat([FACTORY_ADDRESS, createAccountCallData]);

  console.log('InitCode:', initCode, '\n');

  // Get nonce
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);
  const nonce = await entryPoint.getNonce(predictedAddress, 0);

  // Gas configuration (high limits for account creation)
  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1', 'gwei')).mul(150).div(100);
  const maxFeePerGas = (feeData.maxFeePerGas || ethers.utils.parseUnits('3', 'gwei')).mul(150).div(100);

  const verificationGasLimit = ethers.BigNumber.from(700000);
  const callGasLimit = ethers.BigNumber.from(100000); // Small since no actual call
  const preVerificationGas = ethers.BigNumber.from(150000);

  const accountGasLimits = packGasValues(verificationGasLimit, callGasLimit);
  const gasFees = packGasValues(maxPriorityFeePerGas, maxFeePerGas);

  // Sign UserOp
  const userOpForSigning = {
    sender: predictedAddress,
    nonce: nonce,
    initCode: initCode,
    callData: '0x', // No call, just account creation
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: '0x',
  };

  const domain = { ...EIP712_DOMAIN, chainId };
  const signature = await ownerWallet._signTypedData(domain, PACKED_USER_OP_TYPE, userOpForSigning);

  // Build UserOp for bundler
  const userOpToSend = {
    sender: predictedAddress,
    nonce: ethers.utils.hexValue(nonce),
    factory: FACTORY_ADDRESS,
    factoryData: createAccountCallData,
    callData: '0x',
    callGasLimit: ethers.utils.hexValue(callGasLimit),
    verificationGasLimit: ethers.utils.hexValue(verificationGasLimit),
    preVerificationGas: ethers.utils.hexValue(preVerificationGas),
    maxFeePerGas: ethers.utils.hexValue(maxFeePerGas),
    maxPriorityFeePerGas: ethers.utils.hexValue(maxPriorityFeePerGas),
    signature: signature,
  };

  // Fund account first
  console.log('💰 Funding account with 1 ETH...');
  const fundTx = await ownerWallet.sendTransaction({
    to: predictedAddress,
    value: ethers.utils.parseEther('1'),
  });
  await fundTx.wait();
  console.log('✅ Funded\n');

  // Send to bundler
  console.log('📤 Sending UserOperation...');
  const response = await fetch(BUNDLER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendUserOperation',
      params: [userOpToSend, ENTRYPOINT_ADDRESS],
    }),
  });

  const result = await response.json();

  if (result.error) {
    console.error('❌ Error:', result.error.message);
    throw new Error(result.error.message);
  }

  console.log('✅ UserOp Hash:', result.result);
  console.log('\n⏳ Waiting for execution...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Verify registration
  const isRegistered = await factory.isRegistedAccount(predictedAddress);
  console.log('✅ Account registered in factory:', isRegistered);

  if (isRegistered) {
    console.log('\n✨ Success! Account is now authorized for paymaster sponsorship');
    console.log('Account address:', predictedAddress);
    console.log('\nUpdate SMART_ACCOUNT_ADDRESS in index-v08-working.ts to:', predictedAddress);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
