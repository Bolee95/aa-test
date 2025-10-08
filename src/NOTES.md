### Paymaster fields issues
- The packing of the paymaster data for gas related data should be packed in a single slot
- When sending the request to the bundler, the `unpacked` payload is expected
- [X] Signature verification fails with paymaster data 
!!! It managed once to parse the fields of the paymaster, should be revisited

### SDK issues
- The manual signing and constuction of the data works, but it does not work via the SDK
  - The difference in the version of contracts and SDK (v0.8 vs v0.6) may have the difference in how the data is packed before signing


### `InitCode` is not working as expected
- Pre-deployed accounts works ok...



# Step-by-step

## Account pre-created, no paymaster (account pays the gas)
1. Setup network, bundler and entrypoint
   1. `bundler` package
   2. Follow the README instructions
   3. `anvil` or `npx hardhat node`
   4. `yarn hardhat-deploy --network localhost`
   5. `yarn run bundler --unsafe` 
2. Deploy account factory and paymaster
   1. This repo, `contracts` package
   2. Make sure entrypoint address is good
   3. ```
   forge script script/AccountAbstraction.s.sol:AAScript --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
   ```
   forge script script/Counter.s.sol --broadcast --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
    ```
3. Setup smart account for the user (debug-account-creation.ts, then update env with smart contract account)
4. Fund the smart account
```shell
 cast send --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \      130 ↵ ──(Tue,Oct07)─┘  0xFE66E25f708aB4ef9b1cF6c5fF3BE911f38D15A2 \
  "depositTo(address)()" \
  0x02fafFd17d2B367E437f2C331221e46217a07017 \
  --value 1ether
```
1. Run the working script


# Improvements
1. `[This script is working. Check why!](create-account-with-userop.ts) 
2.  Use SDK methods in `src/index-v08-working.ts` to get gas limits and prices