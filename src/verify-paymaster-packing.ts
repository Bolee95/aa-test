import { ethers } from 'ethers';

const PAYMASTER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

// Our current method (WRONG - uses 16 bytes each)
const paymasterVerificationGasLimit = ethers.BigNumber.from(100000);
const paymasterPostOpGasLimit = ethers.BigNumber.from(50000);

const ourMethod = ethers.utils.hexConcat([
  PAYMASTER_ADDRESS, // 20 bytes
  ethers.utils.hexZeroPad(paymasterVerificationGasLimit.toHexString(), 16), // 16 bytes
  ethers.utils.hexZeroPad(paymasterPostOpGasLimit.toHexString(), 16), // 16 bytes
]);

console.log('=== Our Current Method ===');
console.log('PaymasterAndData:', ourMethod);
console.log('Length:', (ourMethod.length - 2) / 2, 'bytes');
console.log('Structure:');
console.log('  Paymaster (20 bytes):', ethers.utils.hexDataSlice(ourMethod, 0, 20));
console.log('  Verification Gas (16 bytes):', ethers.utils.hexDataSlice(ourMethod, 20, 36));
console.log('  PostOp Gas (16 bytes):', ethers.utils.hexDataSlice(ourMethod, 36, 52));

// Bundler's packUint method (CORRECT - packs into 32 bytes total)
function packUint(high128: ethers.BigNumber, low128: ethers.BigNumber): string {
  return ethers.utils.hexZeroPad(
    high128.shl(128).add(low128).toHexString(),
    32
  );
}

const correctMethod = ethers.utils.hexConcat([
  PAYMASTER_ADDRESS, // 20 bytes
  packUint(paymasterVerificationGasLimit, paymasterPostOpGasLimit), // 32 bytes (packed)
]);

console.log('\n=== Bundler\'s Correct Method (packUint) ===');
console.log('PaymasterAndData:', correctMethod);
console.log('Length:', (correctMethod.length - 2) / 2, 'bytes');
console.log('Structure:');
console.log('  Paymaster (20 bytes):', ethers.utils.hexDataSlice(correctMethod, 0, 20));
console.log('  Packed Gas Limits (32 bytes):', ethers.utils.hexDataSlice(correctMethod, 20, 52));

console.log('\n=== Comparison ===');
console.log('Our method length:', (ourMethod.length - 2) / 2, 'bytes (52 bytes)');
console.log('Correct method length:', (correctMethod.length - 2) / 2, 'bytes (52 bytes)');
console.log('Match:', ourMethod.toLowerCase() === correctMethod.toLowerCase());

if (ourMethod.toLowerCase() !== correctMethod.toLowerCase()) {
  console.log('\n❌ METHODS DO NOT MATCH!');
  console.log('This is the bug! We need to use packUint to combine gas limits into 32 bytes.');
} else {
  console.log('\n✅ Methods match - not the issue');
}
