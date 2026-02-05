---
name: new-strategy
description: Scaffold a new trading/DeFi strategy for the agent
disable-model-invocation: true
---

Create a new agent strategy for: $ARGUMENTS

1. Create strategy file at `packages/agent/src/strategies/$ARGUMENTS-strategy.ts`
2. Implement the `IStrategy` interface from `./types.ts`
3. Include: `evaluate()`, `execute()`, `getStatus()` methods
4. Create test file at `packages/agent/test/$ARGUMENTS-strategy.test.ts`
5. Register strategy in `packages/agent/src/strategies/index.ts`
6. Add strategy card to frontend dashboard

Follow TDD — write tests first, then implement.
