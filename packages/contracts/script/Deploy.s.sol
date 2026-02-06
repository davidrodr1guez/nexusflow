// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

import {NexusHook} from "../src/NexusHook.sol";

/// @notice Deploys NexusHook to Sepolia using CREATE2 with mined salt
contract DeployNexusHook is Script {
    address constant CREATE2_DEPLOYER = address(0x4e59b44847b379578588920cA78FbF26c0B4956C);
    
    // Uniswap v4 PoolManager on Sepolia
    // Verify at: https://docs.uniswap.org/contracts/v4/deployments
    IPoolManager constant POOLMANAGER = IPoolManager(address(0x8C4BcBE6b9eF47855f97E675296FA3F6fafa5F1A));

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        console.log("PoolManager:", address(POOLMANAGER));

        // NexusHook flags: afterInitialize, beforeSwap, afterSwap
        uint160 flags = uint160(
            Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        );

        // Constructor args: (IPoolManager _poolManager, address _agent)
        // Agent = deployer so they can configure privacy settings
        bytes memory constructorArgs = abi.encode(POOLMANAGER, deployer);

        // Mine a salt that produces a hook address with correct flags
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(NexusHook).creationCode,
            constructorArgs
        );

        console.log("Computed hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        // Deploy the hook using CREATE2
        vm.startBroadcast(deployerPrivateKey);
        NexusHook hook = new NexusHook{salt: salt}(POOLMANAGER, deployer);
        vm.stopBroadcast();

        require(address(hook) == hookAddress, "DeployNexusHook: address mismatch");
        
        console.log("NexusHook deployed at:", address(hook));
        console.log("Agent:", hook.agent());
    }
}
