import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
const accountAddress = '0x02fafFd17d2B367E437f2C331221e46217a07017';

async function main() {
  // Check account owner
  const accountABI = ['function owner() view returns (address)'];
  const account = new ethers.Contract(accountAddress, accountABI, provider);
  const owner = await account.owner();
  console.log('Account owner:', owner);
  console.log('Expected owner:', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  console.log('Match:', owner.toLowerCase() === '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase());
}

main().catch(console.error);
