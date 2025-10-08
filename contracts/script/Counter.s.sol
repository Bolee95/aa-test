// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Counter} from "../src/Counter.sol";

import {Script} from "forge-std/Script.sol";

contract CounterScript is Script {
    function run() public {
        vm.startBroadcast();

        new Counter();

        vm.stopBroadcast();
    }
}
