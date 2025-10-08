import { ethers } from 'ethers';

/**
 * Script to execute a raw transaction that fails during gas estimation
 * This allows you to see the actual revert reason on-chain
 */

async function executeRawTransaction() {
  // Setup
  const RPC_URL = 'http://localhost:8545';
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  // Use the same wallet as in your SDK test
  const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('Sending transaction from:', wallet.address);
  
  // Transaction details from the latest UserOperation's initCode
  // UserOperation sender: 0xa0b31Da47FbBd11Be5B99db3B6BE7dE4E3601eF0
  // initCode: 0xdc64a140aa3e981100a9beca4e685f962f0cf6c95fbfb9cf000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000000
  
  const to = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'; // AccountFactory address (from initCode)
  const data = '0x5fbfb9cf000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000000';
  
  // Decoded: createAccount(address owner, uint256 salt)
  // owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  // salt: 0
  // Expected to create account at: 0xa0b31Da47FbBd11Be5B99db3B6BE7dE4E3601eF0
  
  // Create transaction with manual gas limit (bypass estimation)
  const tx = {
    to: to,
    data: data,
    gasLimit: 500000, // Manual gas limit
    gasPrice: await provider.getGasPrice(),
    nonce: await wallet.getTransactionCount(),
    chainId: (await provider.getNetwork()).chainId
  };
  
  console.log('\nTransaction details:');
  console.log('To:', tx.to);
  console.log('Data:', tx.data);
  console.log('Gas Limit:', tx.gasLimit);
  console.log('Gas Price:', ethers.utils.formatUnits(tx.gasPrice, 'gwei'), 'gwei');
  console.log('Nonce:', tx.nonce);
  
  try {
    console.log('\n📤 Sending transaction...');
    
    // Send the transaction without estimating gas
    const txResponse = await wallet.sendTransaction(tx);
    console.log('Transaction hash:', txResponse.hash);
    
    console.log('\n⏳ Waiting for transaction to be mined...');
    const receipt = await txResponse.wait();
    
    console.log('\n✅ Transaction mined!');
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
    
    // If it failed, try to get the revert reason
    if (receipt.status === 0) {
      console.log('\n❌ Transaction reverted!');
      
      // Try to get the revert reason by replaying the transaction
      try {
        await provider.call({
          to: tx.to,
          data: tx.data,
          from: wallet.address
        }, receipt.blockNumber);
      } catch (error: any) {
        console.log('Revert reason:', error.reason || error.message);
        if (error.data) {
          console.log('Revert data:', error.data);
        }
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ Error executing transaction:');
    console.error('Reason:', error.reason || error.message);
    
    if (error.transaction) {
      console.log('\nTransaction that failed:');
      console.log(JSON.stringify(error.transaction, null, 2));
    }
    
    if (error.receipt) {
      console.log('\nReceipt:');
      console.log('Status:', error.receipt.status);
      console.log('Gas used:', error.receipt.gasUsed?.toString());
    }
  }
}

// Alternative: Send with specific from address using eth_sendTransaction
async function executeRawTransactionWithFrom() {
  const RPC_URL = 'http://localhost:8545';
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  const to = '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';
  const data = '0x5fbfb9cf000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000000';
  
  // You can also try sending with a different 'from' address
  // For example, to test if it works when called from the SenderCreator
  const senderCreatorAddress = '0xYOUR_SENDER_CREATOR_ADDRESS'; // Get this from EntryPoint
  
  console.log('\n🔧 Alternative: Testing with specific from address');
  console.log('From:', senderCreatorAddress);
  
  try {
    // This only works on development networks where eth_sendTransaction is available
    const result = await provider.send('eth_sendTransaction', [{
      from: senderCreatorAddress,
      to: to,
      data: data,
      gas: ethers.utils.hexlify(500000)
    }]);
    
    console.log('Transaction hash:', result);
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Run the script
console.log('🚀 Raw Transaction Executor\n');
executeRawTransaction()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
