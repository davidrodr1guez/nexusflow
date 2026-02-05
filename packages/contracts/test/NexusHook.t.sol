// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {NexusHook} from "../src/NexusHook.sol";

contract NexusHookTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;

    NexusHook hook;
    PoolKey poolKey;
    PoolId poolId;
    address agent = address(0xA6E47);

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        uint160 flags = uint160(
            Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(
            address(this),
            flags,
            type(NexusHook).creationCode,
            abi.encode(address(manager), agent)
        );

        hook = new NexusHook{salt: salt}(manager, agent);
        require(address(hook) == hookAddress, "Hook address mismatch");

        (poolKey, poolId) = initPool(
            currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1
        );
    }

    /// @notice Test 1: Pool initializes with default maxSwapSize = type(uint256).max
    function test_afterInitialize_setsDefaults() public view {
        assertEq(hook.maxSwapSize(poolId), type(uint256).max);
        assertEq(hook.swapCount(poolId), 0);
        assertEq(hook.cumulativeVolume(poolId), 0);
        assertFalse(hook.privacyModeEnabled(poolId));
    }

    /// @notice Test 2: Swap increments analytics counters
    function test_afterSwap_updatesAnalytics() public {
        swap(poolKey, true, -1e18, "");

        assertEq(hook.swapCount(poolId), 1);
        assertEq(hook.cumulativeVolume(poolId), 1e18);

        swap(poolKey, false, -0.5e18, "");

        assertEq(hook.swapCount(poolId), 2);
        assertEq(hook.cumulativeVolume(poolId), 1.5e18);
    }

    /// @notice Test 3: Only agent can toggle privacy mode
    function test_setPrivacyMode_onlyAgent() public {
        vm.expectRevert(NexusHook.OnlyAgent.selector);
        hook.setPrivacyMode(poolKey, true);

        vm.prank(agent);
        hook.setPrivacyMode(poolKey, true);
        assertTrue(hook.privacyModeEnabled(poolId));
    }

    /// @notice Test 4: Privacy mode enforces max swap size
    function test_beforeSwap_privacyEnforcesMaxSize() public {
        vm.startPrank(agent);
        hook.setPrivacyMode(poolKey, true);
        hook.setMaxSwapSize(poolKey, 0.5e18);
        vm.stopPrank();

        // Small swap should succeed
        swap(poolKey, true, -0.1e18, "");

        // Large swap should revert (PoolManager wraps hook errors in WrappedError)
        vm.expectRevert();
        swap(poolKey, true, -1e18, "");
    }

    /// @notice Test 5: getPoolAnalytics returns correct values
    function test_getPoolAnalytics() public {
        swap(poolKey, true, -1e18, "");
        swap(poolKey, false, -2e18, "");

        vm.prank(agent);
        hook.setPrivacyMode(poolKey, true);

        (uint256 swaps, uint256 volume, bool privacy) = hook.getPoolAnalytics(poolKey);
        assertEq(swaps, 2);
        assertEq(volume, 3e18);
        assertTrue(privacy);
    }
}
