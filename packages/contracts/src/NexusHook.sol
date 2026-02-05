// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";

/**
 * @title NexusHook
 * @notice Uniswap v4 Hook for NexusFlow — AI-Powered DeFi Agent
 * @dev Implements:
 *   - beforeSwap: Privacy-preserving swap validation + agent preference enforcement
 *   - afterSwap: Trade logging and analytics for the agent brain
 *
 * Prize Tracks:
 *   - Uniswap Foundation: Agentic Finance + Privacy DeFi
 */
contract NexusHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    // ============================================================
    // State
    // ============================================================

    /// @notice Agent address that controls this hook
    address public immutable agent;

    /// @notice Maximum swap size in token0 units (privacy: prevent large info-leaking trades)
    mapping(PoolId => uint256) public maxSwapSize;

    /// @notice Number of swaps per pool (analytics for agent)
    mapping(PoolId => uint256) public swapCount;

    /// @notice Cumulative volume per pool
    mapping(PoolId => uint256) public cumulativeVolume;

    /// @notice Whether privacy mode is enabled for a pool
    mapping(PoolId => bool) public privacyModeEnabled;

    // ============================================================
    // Events
    // ============================================================

    event SwapExecuted(
        PoolId indexed poolId, address indexed sender, bool zeroForOne, int256 amountSpecified, uint256 timestamp
    );

    event PrivacyModeToggled(PoolId indexed poolId, bool enabled);
    event MaxSwapSizeUpdated(PoolId indexed poolId, uint256 newMaxSize);

    // ============================================================
    // Errors
    // ============================================================

    error OnlyAgent();
    error SwapTooLarge(uint256 size, uint256 maxAllowed);

    // ============================================================
    // Constructor
    // ============================================================

    constructor(IPoolManager _poolManager, address _agent) BaseHook(_poolManager) {
        agent = _agent;
    }

    // ============================================================
    // Hook Permissions
    // ============================================================

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============================================================
    // Hook Callbacks (override internal _xxx methods)
    // ============================================================

    /// @notice Set default config when pool is initialized
    function _afterInitialize(address, PoolKey calldata key, uint160, int24)
        internal
        override
        returns (bytes4)
    {
        PoolId poolId = key.toId();
        maxSwapSize[poolId] = type(uint256).max;
        return BaseHook.afterInitialize.selector;
    }

    /**
     * @notice Privacy-preserving swap validation
     * @dev When privacy mode is enabled, enforces maximum swap size
     */
    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId poolId = key.toId();

        if (privacyModeEnabled[poolId]) {
            uint256 swapSize =
                params.amountSpecified > 0 ? uint256(params.amountSpecified) : uint256(-params.amountSpecified);

            uint256 maxSize = maxSwapSize[poolId];
            if (swapSize > maxSize) {
                revert SwapTooLarge(swapSize, maxSize);
            }
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /**
     * @notice Post-swap analytics for the agent brain
     * @dev Logs trade data that the off-chain agent uses for strategy optimization
     */
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();

        swapCount[poolId]++;
        uint256 volume =
            params.amountSpecified > 0 ? uint256(params.amountSpecified) : uint256(-params.amountSpecified);
        cumulativeVolume[poolId] += volume;

        emit SwapExecuted(poolId, sender, params.zeroForOne, params.amountSpecified, block.timestamp);

        return (BaseHook.afterSwap.selector, 0);
    }

    // ============================================================
    // Agent Configuration
    // ============================================================

    modifier onlyAgent() {
        if (msg.sender != agent) revert OnlyAgent();
        _;
    }

    /// @notice Toggle privacy mode for a pool
    function setPrivacyMode(PoolKey calldata key, bool enabled) external onlyAgent {
        PoolId poolId = key.toId();
        privacyModeEnabled[poolId] = enabled;
        emit PrivacyModeToggled(poolId, enabled);
    }

    /// @notice Set maximum swap size for privacy protection
    function setMaxSwapSize(PoolKey calldata key, uint256 newMaxSize) external onlyAgent {
        PoolId poolId = key.toId();
        maxSwapSize[poolId] = newMaxSize;
        emit MaxSwapSizeUpdated(poolId, newMaxSize);
    }

    // ============================================================
    // View Functions (for agent brain)
    // ============================================================

    /// @notice Get pool analytics for strategy evaluation
    function getPoolAnalytics(PoolKey calldata key)
        external
        view
        returns (uint256 swaps, uint256 volume, bool privacy)
    {
        PoolId poolId = key.toId();
        return (swapCount[poolId], cumulativeVolume[poolId], privacyModeEnabled[poolId]);
    }
}
