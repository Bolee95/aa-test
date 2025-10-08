// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IEntryPoint} from "../lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {ISenderCreator} from "../lib/account-abstraction/contracts/interfaces/ISenderCreator.sol";
import {SimpleAccount} from "../lib/account-abstraction/contracts/accounts/SimpleAccount.sol";
import {Ownable} from "../lib/openzeppelin-contracts/contracts/access/Ownable.sol";

import {ERC1967Proxy} from "../lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Create2} from "../lib/openzeppelin-contracts/contracts/utils/Create2.sol";

contract AccountFactory is Ownable {
    SimpleAccount public immutable accountImplementation;
    ISenderCreator public immutable senderCreator;

    constructor(IEntryPoint _entryPoint, address owner) Ownable(owner) {
        accountImplementation = new SimpleAccount(_entryPoint);
        senderCreator = _entryPoint.senderCreator();
    }

    mapping(address => bool) private _registeredAccounts;

    event AccountRegistered(address account);
    event AccountRevoked(address account);

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(address accountOwner, uint256 salt) public returns (SimpleAccount ret) {
        address addr = getAddress(accountOwner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }
        // Create account
        ret = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation), abi.encodeCall(SimpleAccount.initialize, (accountOwner))
                )
            )
        );

         // Only register if the creation is requested from the owner
         // This is a temp solution until we dont figure out a proper way to
         // protect the paymaster (without the signature) to not be used by an
         // arbitrary accounts, as opening up the `AccountFactory` would enable anyone to
         // register account if called via `EntryPoint` contract
        if (msg.sender == owner()) {
            _registeredAccounts[addr] = true;
            emit AccountRegistered(addr);
        }
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(address owner, uint256 salt) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(address(accountImplementation), abi.encodeCall(SimpleAccount.initialize, (owner)))
                )
            )
        );
    }

    function revokeRegisterdAccount(address account) external {
        require(isRegistedAccount(account), "account-factory: account not registered");

        _registeredAccounts[account] = false;

        emit AccountRevoked(account);
    }

    function isRegistedAccount(address account) public view returns (bool) {
        return _registeredAccounts[account];
    }
}
