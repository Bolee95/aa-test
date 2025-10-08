import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
const accountAddress = '0x02fafFd17d2B367E437f2C331221e46217a07017';

async function main() {
  // Get the bytecode to check which version is deployed
  const code = await provider.getCode(accountAddress);
  console.log('Account bytecode length:', code.length);
  console.log('Account deployed:', code !== '0x');

  // Check if it's a proxy
  const proxyABI = ['function implementation() view returns (address)'];
  try {
    const proxy = new ethers.Contract(accountAddress, proxyABI, provider);
    const impl = await proxy.implementation();
    console.log('Proxy implementation:', impl);

    const implCode = await provider.getCode(impl);
    console.log('Implementation bytecode length:', implCode.length);
  } catch (e) {
    console.log('Not an ERC1967 proxy or no implementation() function');
  }

  // Check the entryPoint the account is using
  const accountABI = ['function entryPoint() view returns (address)'];
  try {
    const account = new ethers.Contract(accountAddress, accountABI, provider);
    const entryPoint = await account.entryPoint();
    console.log('Account entryPoint:', entryPoint);
  } catch (e: any) {
    console.log('Could not get entryPoint:', e.message);
  }
}

main().catch(console.error);
