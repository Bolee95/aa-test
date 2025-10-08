import { ethers } from 'ethers';

import dotenv from 'dotenv';
dotenv.config(); // Loads environment variables from .env

/**
 * Debug script to test account creation from initCode
 * This helps identify why the bundler rejects the UserOperation with AA20
 */

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
 const ENTRYPOINT_ADDRESS = process.env.ENTRYPOINT_ADDRESS!;
 const FACTORY_ADDRESS = process.env.ACCOUNT_FACTORY_ADDRESS!;
// From the UserOperation that failed
const CALL_DATA = '0x5fbfb9cf000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000000';

async function main() {
  console.log('🔍 Debugging Account Creation from InitCode\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // Parse calldata
  const callData = CALL_DATA;

  console.log('Factory Address:', FACTORY_ADDRESS);
  console.log('Call Data:', callData);
  console.log('Call Data Length:', callData.length, '\n');

  // Decode the callData
  const accountFactoryABI = [
    'function createAccount(address owner, uint256 salt) returns (address)'
  ];
  const iface = new ethers.utils.Interface(accountFactoryABI);
  
  try {
    const decoded = iface.decodeFunctionData('createAccount', callData);
    console.log('Decoded Parameters:');
    console.log('  Owner:', decoded.owner);
    console.log('  Salt:', decoded.salt.toString(), '\n');
  } catch (error) {
    console.error('Failed to decode callData:', error);
  }

  // Check if factory exists
  const factoryCode = await provider.getCode(FACTORY_ADDRESS);
  console.log('Factory exists:', factoryCode !== '0x');
  console.log('Factory bytecode length:', factoryCode.length, '\n');

  if (factoryCode === '0x') {
    console.error('❌ Factory contract not deployed at', FACTORY_ADDRESS);
    return;
  }

  // Try to call the factory directly
  console.log('📞 Attempting direct factory call...\n');

  const factory = new ethers.Contract(
    FACTORY_ADDRESS,
    accountFactoryABI,
    wallet
  );

  try {
    // First, try a static call to see if it would succeed
    console.log('1️⃣ Testing with staticCall (view simulation)...');
    const accountAddress = await provider.call({
      to: FACTORY_ADDRESS,
      data: callData
    });
    
    // Decode the address from the return data
    const decodedAddress = ethers.utils.defaultAbiCoder.decode(['address'], accountAddress)[0];
    console.log('✅ Static call succeeded! Account would be created at:', decodedAddress, '\n');

    // Now try actual execution
    console.log('2️⃣ Attempting actual account creation...');
    const tx = await wallet.sendTransaction({
      to: FACTORY_ADDRESS,
      data: callData,
      gasLimit: 500000
    });
    console.log('Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('✅ Account created successfully!');
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Block number:', receipt.blockNumber, '\n');

    // Check if account is now deployed
    const accountCode = await provider.getCode(decodedAddress);
    console.log('Account deployed:', accountCode !== '0x');
    console.log('Account bytecode length:', accountCode.length);

  } catch (error: any) {
    console.error('❌ Direct factory call failed!');
    console.error('Error:', error.message);
    
    if (error.error) {
      console.error('Inner error:', error.error);
    }
    
    if (error.reason) {
      console.error('Revert reason:', error.reason);
    }

    // Try to get more details about the revert
    try {
      console.log('\n3️⃣ Attempting to get detailed revert reason...');
      await provider.call({
        to: FACTORY_ADDRESS,
        data: callData,
        from: wallet.address
      });
    } catch (callError: any) {
      console.error('Detailed error:', callError.message);
      if (callError.data) {
        console.error('Error data:', callError.data);
      }
    }
  }

  // Additional debugging: Check EntryPoint's SenderCreator
  console.log('\n🔍 Checking EntryPoint configuration...');
 
  const entryPointCode = await provider.getCode(ENTRYPOINT_ADDRESS);
  console.log('EntryPoint deployed:', entryPointCode !== '0x');

  // Check if AccountFactory has the SenderCreator restriction
  console.log('\n🔍 Reading AccountFactory contract...');
  try {
    const accountFactoryFullABI = [
      'function createAccount(address owner, uint256 salt) returns (address)',
      'function getAddress(address owner, uint256 salt) view returns (address)',
      'function accountImplementation() view returns (address)'
    ];
    
    const factoryWithView = new ethers.Contract(
      FACTORY_ADDRESS,
      accountFactoryFullABI,
      provider
    );

    const predictedAddress = await factoryWithView.getAddress(
      FACTORY_ADDRESS,
      0
    );
    console.log('Predicted account address:', predictedAddress);

    const accountImpl = await factoryWithView.accountImplementation();
    console.log('Account implementation:', accountImpl);

  } catch (error: any) {
    console.error('Could not read factory view functions:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
