# Architecture Overview

## System Design Principles

1. **Adapter Pattern**: Every protocol interaction goes through a typed adapter — never call SDKs directly
2. **Strategy Pattern**: Trading strategies are pluggable modules that implement `IStrategy`
3. **Registry Pattern**: Both adapters and strategies are registered centrally for discovery
4. **Event-Driven Logging**: All agent actions produce structured logs for the dashboard

## Data Flow

```
ENS Text Records (preferences)
        │
        ▼
   Agent Brain
   ┌─────────────────┐
   │ 1. MONITOR       │──→ Read chain balances, yields, prices
   │ 2. DECIDE        │──→ Evaluate strategies against state
   │ 3. EXECUTE       │──→ Call protocol adapters
   └─────────────────┘
        │
        ├──→ LI.FI Adapter ──→ Cross-chain swaps/bridges
        ├──→ Uniswap v4 ──→ AMM via NexusHook (on-chain)
        ├──→ Yellow SDK ──→ Off-chain instant payments
        └──→ Arc/Circle ──→ USDC cross-chain settlement
```

## Cross-Chain Transaction Example

1. Agent detects higher yield on Arbitrum vs Ethereum
2. Checks ENS text record: `swap-preference: low-slippage`
3. Gets LI.FI quote for bridging USDC from ETH → ARB
4. Yellow SDK handles micro-payment for monitoring service (gas-free)
5. LI.FI executes the bridge
6. On Arbitrum, agent swaps USDC → ETH via Uniswap v4 pool
7. NexusHook validates swap size (privacy mode)
8. NexusHook logs trade data (afterSwap analytics)
9. Agent updates portfolio state

## Security Model

- Agent wallet holds funds, not the hook contract
- NexusHook is non-custodial — it validates and logs, never holds tokens
- ENS preferences are on-chain and verifiable
- Yellow state channels have on-chain settlement fallback
- All transactions require agent wallet signature
