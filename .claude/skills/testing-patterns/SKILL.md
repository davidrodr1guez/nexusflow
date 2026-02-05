---
name: testing-patterns
description: Use when writing or modifying tests. Covers Vitest for TypeScript, Foundry for Solidity, mocking patterns for protocol adapters, and E2E testing strategy.
---

# Testing Patterns

## When to Use
- Creating new test files
- Adding tests for protocol adapters
- Writing Solidity contract tests
- Setting up mocks for external SDKs

## File Structure
- Tests live alongside source: `src/foo.ts` → `test/foo.test.ts`
- Test helpers: `test/helpers/`
- Fixtures/mocks: `test/fixtures/`

## TypeScript Tests (Vitest)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentBrain } from '../src/agent-brain';

describe('AgentBrain', () => {
  let agent: AgentBrain;

  beforeEach(() => {
    agent = new AgentBrain({ /* test config */ });
    vi.clearAllMocks();
  });

  it('should detect yield opportunity above threshold', async () => {
    const opportunity = await agent.scanForOpportunities();
    expect(opportunity).toBeDefined();
    expect(opportunity.apy).toBeGreaterThan(0.05);
  });
});
```

## Mocking Protocol Adapters

```typescript
// Mock the entire adapter
vi.mock('../src/protocols/lifi-adapter', () => ({
  LiFiAdapter: vi.fn().mockImplementation(() => ({
    name: 'lifi',
    getQuote: vi.fn().mockResolvedValue({ estimatedGas: 150000n }),
    executeSwap: vi.fn().mockResolvedValue({ txHash: '0x...' }),
  })),
}));
```

## Solidity Tests (Foundry)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/NexusHook.sol";

contract NexusHookTest is Test {
    NexusHook hook;

    function setUp() public {
        hook = new NexusHook();
    }

    function test_hookPermissions() public view {
        // Verify hook has correct permissions
        Hooks.Permissions memory perms = hook.getHookPermissions();
        assertTrue(perms.beforeSwap);
    }
}
```

## Rules
- Every new module needs tests BEFORE implementation (TDD)
- Mock external services, never call real RPCs in unit tests
- Use `forge fork-test` for integration tests that need mainnet state
- Minimum: test happy path + one error case per public function
- Run `npm run test` from root before every commit
