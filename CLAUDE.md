# NexusFlow — AI-Powered Cross-Chain DeFi Agent

## Quick Facts
- **Stack**: TypeScript, Solidity, React 18, Vite, Foundry, Node 20+
- **Architecture**: Monorepo with 3 packages (contracts, agent, frontend)
- **Target**: ETHGlobal HackMoney 2026 — Deadline ~Feb 10, 2026
- **Prize Tracks**: Yellow SDK, Uniswap v4, LI.FI, Arc/Circle, ENS, Finalist

## Terminal Commands

### Root (monorepo)
```bash
npm install                    # Install all dependencies
npm run build                  # Build all packages
npm run test                   # Run all tests
npm run lint                   # Lint all packages
npm run dev                    # Start frontend dev server
```

### Contracts (packages/contracts)
```bash
cd packages/contracts
forge build                    # Compile Solidity
forge test                     # Run contract tests
forge test -vvv                # Verbose test output
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast  # Deploy
```

### Agent (packages/agent)
```bash
cd packages/agent
npm run dev                    # Start agent in dev mode
npm run test                   # Run agent tests
npm run test:watch             # Watch mode
```

### Frontend (packages/frontend)
```bash
cd packages/frontend
npm run dev                    # Vite dev server (port 5173)
npm run build                  # Production build
npm run preview                # Preview production build
```

## Code Style
- TypeScript strict mode everywhere — no `any`, use `unknown` when needed
- ES modules only (import/export), never CommonJS (require)
- Prefer `interface` over `type` for object shapes
- Functional components with hooks for React
- Use `async/await` over `.then()` chains
- Errors: always use custom error classes, never throw raw strings
- Solidity: follow Foundry conventions, NatSpec comments on all public functions

## Naming Conventions
- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for React components
- Variables/functions: `camelCase`
- Types/interfaces: `PascalCase` with `I` prefix only for interfaces that shadow a class
- Constants: `SCREAMING_SNAKE_CASE`
- Solidity: `PascalCase` for contracts, `camelCase` for functions, `UPPER_CASE` for constants
- Git branches: `feat/description`, `fix/description`, `chore/description`
- Commits: Conventional Commits — `feat:`, `fix:`, `chore:`, `docs:`, `test:`

## Architecture Overview
See `docs/architecture/OVERVIEW.md` for full system design.

```
nexusflow/
├── packages/
│   ├── contracts/     # Solidity — Uniswap v4 hooks, ENS resolver
│   ├── agent/         # TypeScript — AI agent brain, strategy engine
│   └── frontend/      # React + Vite — Dashboard UI
├── docs/              # Architecture docs, sponsor guides
└── .claude/           # Claude Code skills, commands, settings
```

### Key Integration Points
1. **ENS** → Agent identity (`nexusflow.eth`), DeFi preferences in text records
2. **LI.FI SDK** → Cross-chain routing (swap + bridge + contract calls)
3. **Uniswap v4** → AMM interaction via hooks (privacy + agentic)
4. **Yellow SDK** → Off-chain instant payments via state channels
5. **Arc/Circle** → USDC cross-chain liquidity hub

## Workflow: Implementing a New Feature
1. Create a feature branch: `git checkout -b feat/feature-name`
2. Write tests first (TDD) — tests go in `test/` dirs alongside source
3. Implement the feature
4. Run `npm run test` from root to verify nothing breaks
5. Run `npm run lint` to ensure style compliance
6. Create PR with conventional commit message

## Workflow: Adding a New Protocol Integration
1. Create adapter in `packages/agent/src/protocols/`
2. Implement the `IProtocolAdapter` interface
3. Add integration tests with mocked RPC responses
4. Register adapter in `packages/agent/src/protocols/index.ts`
5. Update frontend to show new protocol status

## Testing Strategy
- **Contracts**: Foundry tests with fork-testing for mainnet state
- **Agent**: Vitest with mocked protocol responses
- **Frontend**: Vitest + React Testing Library
- **E2E**: Manual testing on testnets (Sepolia, Arbitrum Sepolia, Base Sepolia)

## Environment Variables
See `.env.example` — never commit real keys. Required:
- `ALCHEMY_API_KEY` — RPC provider
- `PRIVATE_KEY` — Deployer wallet (testnet only)
- `YELLOW_API_KEY` — Yellow Network SDK
- `LIFI_API_KEY` — LI.FI SDK (optional, has free tier)

## Important Notes
- Never use `console.log` in production code — use the logger utility
- All protocol interactions must go through adapters, never call SDKs directly
- Frontend state management: Zustand (not Redux, not Context)
- Cross-chain amounts: always use BigInt, never floating point
- Gas estimation: always add 20% buffer
- When unsure about a sponsor SDK, check `docs/sponsor-guides/`
