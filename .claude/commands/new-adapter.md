---
name: new-adapter
description: Scaffold a new protocol adapter with tests and registration
disable-model-invocation: true
---

Create a new protocol adapter for: $ARGUMENTS

1. Create adapter file at `packages/agent/src/protocols/$ARGUMENTS-adapter.ts`
2. Implement the `IProtocolAdapter` interface from `./types.ts`
3. Create test file at `packages/agent/test/$ARGUMENTS-adapter.test.ts`
4. Register the adapter in `packages/agent/src/protocols/index.ts`
5. Add any required environment variables to `.env.example`
6. Update the frontend protocol status display if applicable

Follow the patterns in `.claude/skills/defi-integration/SKILL.md`.
