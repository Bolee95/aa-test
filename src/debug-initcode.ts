import { ethers } from 'ethers';

const ENTRYPOINT_ADDRESS = '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108';
const ACCOUNT_FACTORY_ADDRESS = '0xc6e7DF5E7b4f2A278906862b61205850344D4e7d';
const RPC_URL = 'http://localhost:8545';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const ENTRYPOINT_ABI = [
  'function getSenderAddress(bytes initCode) external',
];

async function debugInitCode() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, signer);

  // The initCode from our failing UserOp
  const initCode = '0xc6e7df5e7b4f2a278906862b61205850344d4e7d5fbfb9cf000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000000';

  console.log('Testing initCode execution...');
  console.log('InitCode:', initCode);

  try {
    // Try to get the sender address (this simulates what the bundler does)
    console.log('\n1. Getting sender address from initCode...');
    const senderAddress = await entryPoint.getSenderAddress(initCode);
    console.log('Sender address:', senderAddress);

    // Check if the account is already deployed
    const code = await provider.getCode(senderAddress);
    console.log('Account code length:', code.length);
    console.log('Account deployed:', code !== '0x');

  } catch (error) {
    console.error('❌ Error during initCode execution:', error);
    console.log('This is likely the source of the AA20 error');
  }
}

debugInitCode().catch(console.error);
