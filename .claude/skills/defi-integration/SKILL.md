---
name: defi-integration
description: Use when integrating DeFi protocols (LI.FI, Uniswap v4, Yellow SDK, Arc/Circle, ENS). Covers SDK setup, adapter patterns, error handling, and cross-chain flows.
---

# DeFi Protocol Integration Skill

## When to Use
- Adding a new protocol adapter
- Working with cross-chain transactions
- Handling token approvals, slippage, gas estimation
- Interacting with any sponsor SDK

## Adapter Pattern (REQUIRED)

Every protocol interaction MUST go through an adapter. Never call SDKs directly from business logic.

```typescript
// packages/agent/src/protocols/types.ts
export interface IProtocolAdapter {
  name: string;
  supportedChains: number[];
  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

// Example: LI.FI Adapter
// packages/agent/src/protocols/lifi-adapter.ts
import type { IProtocolAdapter } from './types';

export class LiFiAdapter implements IProtocolAdapter {
  name = 'lifi';
  supportedChains = [1, 42161, 10, 8453]; // ETH, ARB, OP, BASE

  async initialize(): Promise<void> { /* ... */ }
  async healthCheck(): Promise<boolean> { /* ... */ }

  async getQuote(params: SwapParams): Promise<Quote> { /* ... */ }
  async executeSwap(quote: Quote): Promise<TxResult> { /* ... */ }
}
```

## Cross-Chain Transaction Flow
1. Get quote from routing protocol (LI.FI or Arc)
2. Check token approval — approve if needed
3. Estimate gas with 20% buffer
4. Execute transaction
5. Monitor for confirmation
6. Log result and update state

## Error Handling
- Always wrap SDK calls in try/catch
- Use exponential backoff for RPC failures (3 retries, 1s/2s/4s)
- Timeout cross-chain bridge operations at 5 minutes
- Log all failures with chain ID, tx hash, and error code

## Amount Handling
- ALWAYS use BigInt for token amounts
- NEVER use floating point for financial calculations
- Use `parseUnits` / `formatUnits` from viem
- USDC has 6 decimals, ETH has 18 — always verify

## Sponsor SDK Quick Reference
- **LI.FI**: `@lifi/sdk` — docs at https://docs.li.fi/sdk/overview
- **Yellow**: `@aspect-build/aspect-sdk` — docs at https://docs.yellow.org
- **Uniswap v4**: Solidity hooks — template at https://github.com/uniswapfoundation/v4-template
- **ENS**: `@ensdomains/ensjs` — docs at https://docs.ens.domains
- **Arc/Circle**: Circle Developer SDK — docs at https://developers.circle.com
