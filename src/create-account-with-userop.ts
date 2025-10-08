import { ethers } from 'ethers';

import dotenv from 'dotenv';
dotenv.config(); // Loads environment variables from .env

/**
 * Create account through UserOperation with initCode
 * This will register the account in the factory when executed through EntryPoint
 */

// Configuration
const ENTRYPOINT_ADDRESS = process.env.ENTRYPOINT_ADDRESS!;
const FACTORY_ADDRESS = process.env.ACCOUNT_FACTORY_ADDRESS!;
const BUNDLER_URL = process.env.BUNDLER_URL!;
const RPC_URL = process.env.RPC_URL;
const COUNTER_ADDRESS = process.env.COUNTER_ADDRESS!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const COUNTER_ABI = [
  'function increment() external',
];

const ENTRYPOINT_ABI = [
  'function getNonce(address sender, uint192 key) view returns (uint256)',
];

const FACTORY_ABI = [
  'function createAccount(address owner, uint256 salt) returns (address)',
  'function getAddress(address owner, uint256 salt) view returns (address)',
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
  console.log('🚀 Creating account through UserOperation with initCode\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const chainId = (await provider.getNetwork()).chainId;

  console.log('Owner Address:', ownerWallet.address);
  console.log('Chain ID:', chainId, '\n');

  // Create initCode
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const salt = 1; // Use salt=1 to create a fresh account
  const predictedAddress = await factory.getAddress(ownerWallet.address, salt);

  console.log('Predicted Account Address:', predictedAddress);

  // Check if already deployed
  const code = await provider.getCode(predictedAddress);
  if (code !== '0x') {
    console.log('⚠️  Account already deployed at', predictedAddress);
    console.log('Bytecode length:', code.length);
  }

  // Encode createAccount call
  const createAccountCallData = factory.interface.encodeFunctionData('createAccount', [
    ownerWallet.address,
    salt,
  ]);

  // initCode = factory address + createAccount calldata
  const initCode = ethers.utils.hexConcat([FACTORY_ADDRESS, createAccountCallData]);
  console.log('InitCode:', initCode, '\n');

  // Get nonce (should be 0 for new account)
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);
  const nonce = await entryPoint.getNonce(predictedAddress, 0);
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

  // Get gas prices
  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1', 'gwei')).mul(150).div(100);
  const maxFeePerGas = (feeData.maxFeePerGas || ethers.utils.parseUnits('3', 'gwei')).mul(150).div(100);

  // Gas limits - higher for account creation
  const verificationGasLimit = ethers.BigNumber.from(700000); // Higher for creation
  const callGasLimit = ethers.BigNumber.from(300000);
  const preVerificationGas = ethers.BigNumber.from(150000); // Higher for initCode

  const accountGasLimits = packGasValues(verificationGasLimit, callGasLimit);
  const gasFees = packGasValues(maxPriorityFeePerGas, maxFeePerGas);

  console.log('Gas Configuration:');
  console.log('  VerificationGasLimit:', verificationGasLimit.toString());
  console.log('  CallGasLimit:', callGasLimit.toString());
  console.log('  PreVerificationGas:', preVerificationGas.toString());
  console.log('  MaxFeePerGas:', ethers.utils.formatUnits(maxFeePerGas, 'gwei'), 'gwei');
  console.log('  MaxPriorityFeePerGas:', ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei'), 'gwei\n');

  // Create UserOp for signing (NO PAYMASTER - pay with account funds)
  const userOpForSigning = {
    sender: predictedAddress,
    nonce: nonce,
    initCode: initCode,
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: '0x', // NO PAYMASTER
  };

  console.log('🔑 Signing UserOperation with EIP-712...');

  const domain = { ...EIP712_DOMAIN, chainId };
  const signature = await ownerWallet._signTypedData(domain, PACKED_USER_OP_TYPE, userOpForSigning);
  console.log('Signature:', signature, '\n');

  // Create the UserOp to send to bundler
  const userOpToSend: any = {
    sender: predictedAddress,
    nonce: ethers.utils.hexValue(nonce),
    factory: FACTORY_ADDRESS,
    factoryData: createAccountCallData,
    callData: callData,
    callGasLimit: ethers.utils.hexValue(callGasLimit),
    verificationGasLimit: ethers.utils.hexValue(verificationGasLimit),
    preVerificationGas: ethers.utils.hexValue(preVerificationGas),
    maxFeePerGas: ethers.utils.hexValue(maxFeePerGas),
    maxPriorityFeePerGas: ethers.utils.hexValue(maxPriorityFeePerGas),
    signature: signature,
  };

  console.log('📤 Sending UserOperation to bundler...');
  console.log(JSON.stringify(userOpToSend, null, 2), '\n');

  // Fund the account first (it needs ETH to pay for gas)
  console.log('💰 Funding account with 1 ETH...');
  const fundTx = await ownerWallet.sendTransaction({
    to: predictedAddress,
    value: ethers.utils.parseEther('1'),
  });
  await fundTx.wait();
  console.log('✅ Account funded\n');

  try {
    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendUserOperation',
      params: [userOpToSend, ENTRYPOINT_ADDRESS],
    };

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
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if account is now registered
    const factoryWithView = new ethers.Contract(
      FACTORY_ADDRESS,
      [...FACTORY_ABI, 'function isRegistedAccount(address) view returns (bool)'],
      provider
    );
    const isRegistered = await factoryWithView.isRegistedAccount(predictedAddress);
    console.log('✅ Account registered:', isRegistered);

  } catch (error: any) {
    console.error('❌ Error sending UserOperation:', error.message);
    throw error;
  }

  console.log('\n✨ Account creation completed!');
  console.log('Account address:', predictedAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
