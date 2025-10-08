import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
const accountAddress = '0x02fafFd17d2B367E437f2C331221e46217a07017';

async function main() {
  // ERC1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1
  const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

  const implAddress = await provider.getStorageAt(accountAddress, IMPLEMENTATION_SLOT);
  const cleanImplAddress = ethers.utils.getAddress('0x' + implAddress.slice(26));

  console.log('Implementation address:', cleanImplAddress);

  const implCode = await provider.getCode(cleanImplAddress);
  console.log('Implementation bytecode length:', implCode.length);
  console.log('Implementation deployed:', implCode !== '0x');
}

main().catch(console.error);
