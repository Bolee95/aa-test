// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {EntryPoint} from "../lib/account-abstraction/contracts/core/EntryPoint.sol";

import {Script} from "forge-std/Script.sol";

contract EntryPointScript is Script {
    EntryPoint public entryPoint;

    function run() public {
        vm.startBroadcast();

        entryPoint = new EntryPoint();

        vm.stopBroadcast();
    }
}
