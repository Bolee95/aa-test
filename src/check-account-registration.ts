import { ethers } from 'ethers';

/**
 * Check if account is registered in AccountFactory
 * The Paymaster requires accounts to be registered
 */

const RPC_URL = 'http://localhost:8545';
const ACCOUNT_FACTORY_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const ACCOUNT_ADDRESS = '0x79890F634625835414a082c232e4c5DE52FD3eE0';

async function main() {
  console.log('🔍 Checking Account Registration\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  const factoryABI = [
    'function isRegistedAccount(address account) view returns (bool)',
    'function senderCreator() view returns (address)',
    'function accountImplementation() view returns (address)'
  ];

  const factory = new ethers.Contract(ACCOUNT_FACTORY_ADDRESS, factoryABI, provider);

  try {
    console.log('Factory Address:', ACCOUNT_FACTORY_ADDRESS);
    console.log('Account Address:', ACCOUNT_ADDRESS);
    
    const isRegistered = await factory.isRegistedAccount(ACCOUNT_ADDRESS);
    console.log('\n✓ Account Registered:', isRegistered);

    if (!isRegistered) {
      console.log('\n⚠️  WARNING: Account is NOT registered!');
      console.log('The Paymaster will reject UserOps from this account.');
      console.log('\nThe account must be created through the EntryPoint\'s SenderCreator to be registered.');
      console.log('You need to either:');
      console.log('1. Use initCode to create a new account (it will auto-register)');
      console.log('2. Have the factory owner manually register this account');
    } else {
      console.log('\n✓ Account is registered and can use the Paymaster!');
    }

    // Get SenderCreator address
    const senderCreator = await factory.senderCreator();
    console.log('\nSenderCreator:', senderCreator);

    const accountImpl = await factory.accountImplementation();
    console.log('Account Implementation:', accountImpl);

  } catch (error: any) {
    console.error('Error checking registration:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
