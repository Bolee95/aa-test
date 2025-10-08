// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {BasePaymaster} from "../lib/account-abstraction/contracts/core/BasePaymaster.sol";
import {PackedUserOperation} from "../lib/account-abstraction/contracts/core/UserOperationLib.sol";
import {IEntryPoint} from "../lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {AccountFactory} from "./AccountFactory.sol";

contract Paymaster is BasePaymaster {
    AccountFactory public immutable accountFactory;

    constructor(IEntryPoint entryPoint_, AccountFactory accountFactory_) BasePaymaster(entryPoint_) {
        accountFactory = accountFactory_;
    }

    function _validatePaymasterUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 maxCost)
        internal
        virtual
        override
        returns (bytes memory context, uint256 validationData)
    {
        // Ensure the caller is the trusted EntryPoint
        require(msg.sender == address(entryPoint), "paymaster: not EntryPoint");

        // Ensure the paymaster has enough ETH deposited in the EntryPoint
        require(this.getDeposit() >= maxCost, "paymaster: insufficient deposit");

        // Custom sponsorship logic:
        // Allow if:
        // 1. Account is registered (created through proper channels)
        require( accountFactory.isRegistedAccount(userOp.sender), "paymaster: account not authorized");

        // For sponsoring paymaster, return empty context
        // EntryPoint will automatically deduct from our deposit
        return ("", 0);
    }

    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal virtual override {
        // For sponsoring paymaster, validate context and acknowledge
        // The EntryPoint automatically deducts from our deposit

        // Log successful postOp execution
        emit PostOpCalled(mode, actualGasCost, actualUserOpFeePerGas);
    }

    event PostOpCalled(PostOpMode mode, uint256 actualGasCost, uint256 actualUserOpFeePerGas);
}
