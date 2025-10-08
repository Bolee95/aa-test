import { ethers } from 'ethers';

/**
 * Debug script to verify the account owner
 * This helps identify why signature validation fails
 */

const RPC_URL = 'http://localhost:8545';
const ACCOUNT_ADDRESS = '0x79890F634625835414a082c232e4c5DE52FD3eE0';
const EXPECTED_OWNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

async function main() {
  console.log('🔍 Verifying Account Owner\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  // SimpleAccount ABI - just the owner function
  const accountABI = [
    'function owner() view returns (address)',
    'function entryPoint() view returns (address)',
    'function getNonce() view returns (uint256)'
  ];

  const account = new ethers.Contract(ACCOUNT_ADDRESS, accountABI, provider);

  try {
    console.log('Account Address:', ACCOUNT_ADDRESS);
    
    // Get the actual owner
    const actualOwner = await account.owner();
    console.log('Actual Owner:', actualOwner);
    console.log('Expected Owner:', EXPECTED_OWNER);
    console.log('Owners Match:', actualOwner.toLowerCase() === EXPECTED_OWNER.toLowerCase());

    // Get EntryPoint
    const entryPoint = await account.entryPoint();
    console.log('\nEntryPoint:', entryPoint);

    // Get nonce
    const nonce = await account.getNonce();
    console.log('Nonce:', nonce.toString());

    // Check account code
    const code = await provider.getCode(ACCOUNT_ADDRESS);
    console.log('\nAccount bytecode length:', code.length);
    console.log('Account is deployed:', code !== '0x');

  } catch (error: any) {
    console.error('Error reading account:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
