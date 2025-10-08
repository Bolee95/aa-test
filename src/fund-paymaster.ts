import { ethers } from 'ethers';

const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const PAYMASTER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const RPC_URL = 'http://localhost:8545';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const ENTRYPOINT_ABI = [
  'function depositTo(address account) external payable',
  'function balanceOf(address account) external view returns (uint256)',
];

async function fundPaymaster() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, signer);
  
  const currentBalance = await entryPoint.balanceOf(PAYMASTER_ADDRESS);
  console.log('Current Paymaster balance in EntryPoint:', ethers.utils.formatEther(currentBalance), 'ETH');
  
  // Deposit 1 ETH to the Paymaster
  console.log('\nDepositing 1 ETH to Paymaster...');
  const tx = await entryPoint.depositTo(PAYMASTER_ADDRESS, { value: ethers.utils.parseEther('1') });
  console.log('Transaction hash:', tx.hash);
  
  await tx.wait();
  console.log('Transaction confirmed!');
  
  const newBalance = await entryPoint.balanceOf(PAYMASTER_ADDRESS);
  console.log('\nNew Paymaster balance in EntryPoint:', ethers.utils.formatEther(newBalance), 'ETH');
}

fundPaymaster().catch(console.error);
