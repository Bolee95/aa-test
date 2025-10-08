import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
const ENTRYPOINT_ADDRESS = '0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2';
const SMART_ACCOUNT_ADDRESS = '0x02fafFd17d2B367E437f2C331221e46217a07017';
const PAYMASTER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

const ENTRYPOINT_ABI = [
  'function balanceOf(address account) view returns (uint256)',
];

async function main() {
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);

  const accountBalance = await entryPoint.balanceOf(SMART_ACCOUNT_ADDRESS);
  const paymasterBalance = await entryPoint.balanceOf(PAYMASTER_ADDRESS);

  console.log('Smart Account deposit in EntryPoint:', ethers.utils.formatEther(accountBalance), 'ETH');
  console.log('Paymaster deposit in EntryPoint:    ', ethers.utils.formatEther(paymasterBalance), 'ETH');

  if (paymasterBalance.eq(0)) {
    console.log('\n⚠️  WARNING: Paymaster has no deposit! The UserOp will fail.');
    console.log('Run fund-paymaster.ts to deposit ETH to the paymaster.');
  }
}

main().catch(console.error);
