// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    uint256 private _counter;

    function increment() external {
        _counter++;
    }

    function getCount() external view returns (uint256) {
        return _counter;
    }
}
