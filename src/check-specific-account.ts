import { ethers } from 'ethers';

const ACCOUNT_FACTORY_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F';
const ACCOUNT_ADDRESS = '0x7Bc0B1ACd89169e5C2a65fdBF5eBe75C176c9912';
const RPC_URL = 'http://localhost:8545';

const FACTORY_ABI = [
  'function isRegistedAccount(address account) external view returns (bool)',
];

async function checkAccount() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const factory = new ethers.Contract(ACCOUNT_FACTORY_ADDRESS, FACTORY_ABI, provider);
  
  console.log('Checking account:', ACCOUNT_ADDRESS);
  console.log('Factory address:', ACCOUNT_FACTORY_ADDRESS);
  
  const isRegistered = await factory.isRegistedAccount(ACCOUNT_ADDRESS);
  console.log('Is registered:', isRegistered);
  
  const code = await provider.getCode(ACCOUNT_ADDRESS);
  console.log('Has code deployed:', code !== '0x');
  console.log('Code length:', code.length);
}

checkAccount().catch(console.error);
