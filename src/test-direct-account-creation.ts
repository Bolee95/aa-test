import { ethers } from 'ethers';

const ACCOUNT_FACTORY_ADDRESS = '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';
const OWNER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const SALT = 1;
const RPC_URL = 'http://localhost:8545';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const FACTORY_ABI = [
  'function createAccount(address owner, uint256 salt) external returns (address)',
  'function getAddress(address owner, uint256 salt) external view returns (address)',
  'function isRegistedAccount(address account) external view returns (bool)',
];

async function testDirectCreation() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const factory = new ethers.Contract(ACCOUNT_FACTORY_ADDRESS, FACTORY_ABI, signer);
  
  // Get expected address
  const expectedAddress = await factory.getAddress(OWNER_ADDRESS, SALT);
  console.log('Expected account address:', expectedAddress);
  
  // Check if already deployed
  const codeBefore = await provider.getCode(expectedAddress);
  console.log('Account deployed before:', codeBefore !== '0x');
  
  // Check if registered
  const isRegisteredBefore = await factory.isRegistedAccount(expectedAddress);
  console.log('Account registered before:', isRegisteredBefore);
  
  // Try to create account directly
  console.log('\nCalling createAccount directly...');
  try {
    const tx = await factory.createAccount(OWNER_ADDRESS, SALT);
    console.log('Transaction hash:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed!');
    console.log('Gas used:', receipt.gasUsed.toString());
    
    // Check after creation
    const codeAfter = await provider.getCode(expegctedAddress);
    console.log('\nAccount deployed after:', codeAfter !== '0x');
    
    const isRegisteredAfter = await factory.isRegistedAccount(expectedAddress);
    console.log('Account registered after:', isRegisteredAfter);
    
  } catch (error) {
    console.error('Error creating account:', error);
  }
}

testDirectCreation().catch(console.error);
