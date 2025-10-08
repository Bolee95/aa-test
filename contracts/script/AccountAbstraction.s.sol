// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IEntryPoint} from "../lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {AccountFactory} from "../src/AccountFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";

import {Script} from "forge-std/Script.sol";

contract AAScript is Script {
    AccountFactory public accountFactory;
    Paymaster public paymaster;
    IEntryPoint entryPoint = IEntryPoint(0x37F83f3b00E196bc3D076d233C2C1C6C0e1287Aa);

    function run() public {
        vm.startBroadcast();

        accountFactory = new AccountFactory(entryPoint, msg.sender);
        paymaster = new Paymaster(entryPoint, accountFactory);
        vm.stopBroadcast();
    }
}
