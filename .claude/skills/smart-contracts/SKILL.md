---
name: smart-contracts
description: Use when writing, deploying, or testing Solidity smart contracts. Covers Uniswap v4 hooks, ENS integration, Foundry workflow, and security patterns.
---

# Smart Contract Development

## When to Use
- Writing or modifying Solidity contracts
- Creating Uniswap v4 hooks
- Working with ENS resolvers
- Deploying to testnets
- Auditing contract security

## Uniswap v4 Hook Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

contract NexusHook is BaseHook {
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,      // Privacy: validate swap before execution
            afterSwap: true,       // Agentic: log and analyze post-swap
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }
}
```

## Security Checklist
- [ ] No reentrancy vulnerabilities (use checks-effects-interactions)
- [ ] Integer overflow protection (Solidity 0.8+ has built-in)
- [ ] Access control on privileged functions
- [ ] Events emitted for all state changes
- [ ] NatSpec documentation on all public/external functions
- [ ] No hardcoded addresses (use constructor params or immutables)

## Deployment
- Always deploy to testnet first
- Save deployment addresses in `deployments/{chainId}.json`
- Verify contracts on block explorers
- Use deterministic deployment (CREATE2) when possible
