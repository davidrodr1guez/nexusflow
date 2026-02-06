# 🌊 NexusFlow — AI-Powered Cross-Chain DeFi Agent

> _Your AI financial agent with a name, not just an address._

[![ETHGlobal](https://img.shields.io/badge/ETHGlobal-HackMoney%202026-blue)](https://ethglobal.com/events/hackmoney2026)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🎯 What is NexusFlow?

NexusFlow is an autonomous AI-powered DeFi agent that manages cross-chain liquidity with a human-readable ENS identity. It monitors opportunities across multiple chains, makes intelligent decisions, and executes transactions — all while preserving privacy and minimizing gas costs.

**The agent doesn't just have an address — it has a name: `nexusflow.eth`**

### Key Features

- **🧠 AI Agent Brain**: Monitor → Decide → Execute loop that evaluates strategies in real-time
- **🔗 Cross-Chain Native**: Seamlessly moves assets across Ethereum, Arbitrum, Optimism, and Base
- **🏷️ ENS Identity**: Agent preferences (risk level, slippage, preferred chains) stored as ENS text records
- **⚡ Instant Payments**: Off-chain state channel transactions via Yellow Network — zero gas, instant settlement
- **🔒 Privacy-Preserving**: Uniswap v4 hooks that enforce swap size limits to prevent information leakage
- **💵 USDC Hub**: Arc/Circle integration for cross-chain USDC liquidity management

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  NexusFlow Dashboard                 │
│               (React + Vite + Zustand)               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  ENS Identity │  │  Agent Brain │  │  Strategy  │ │
│  │  + Text Recs  │  │  (AI Logic)  │  │  Engine    │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                  │                 │        │
│  ┌──────▼──────────────────▼─────────────────▼─────┐ │
│  │              Protocol Adapter Layer              │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │ │
│  │  │ LI.FI  │ │Uniswap │ │ Yellow │ │   Arc    │ │ │
│  │  │ SDK    │ │  v4    │ │  SDK   │ │ (Circle) │ │ │
│  │  └────────┘ └────────┘ └────────┘ └──────────┘ │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │         Solidity: NexusHook (Uniswap v4)        │ │
│  │    Privacy validation · Trade analytics hooks    │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 🏆 Prize Tracks

| Sponsor | Track | Integration |
|---------|-------|-------------|
| **Yellow Network** | Integrate Yellow SDK | Off-chain instant payments via state channels |
| **Uniswap Foundation** | Agentic Finance + Privacy DeFi | v4 Hooks for agent-controlled privacy swaps |
| **LI.FI** | AI × LI.FI Smart App | Cross-chain routing as agent execution layer |
| **Arc (Circle)** | Chain-Abstracted USDC | USDC liquidity hub across chains |
| **ENS** | Creative DeFi Use | Agent identity + DeFi preferences in text records |

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for Solidity contracts)
- An Alchemy API key (free tier works)

### Setup

```bash
# Clone the repo
git clone https://github.com/your-team/nexusflow.git
cd nexusflow

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Install Foundry dependencies
cd packages/contracts
forge install uniswap/v4-core uniswap/v4-periphery
cd ../..

# Start the frontend
npm run dev

# In another terminal, start the agent
npm run dev:agent
```

### Running Tests

```bash
# All tests
npm run test

# Contract tests only
cd packages/contracts && forge test -vvv

# Agent tests only
cd packages/agent && npm run test
```

## 📂 Project Structure

```
nexusflow/
├── CLAUDE.md                        # Claude Code project context
├── .claude/
│   ├── settings.json                # Hooks, permissions, quality gates
│   ├── skills/                      # Domain-specific knowledge
│   │   ├── defi-integration/        # Protocol adapter patterns
│   │   ├── testing-patterns/        # Test conventions
│   │   └── smart-contracts/         # Solidity best practices
│   └── commands/                    # Custom slash commands
│       ├── new-adapter.md           # Scaffold new protocol adapter
│       ├── new-strategy.md          # Scaffold new trading strategy
│       └── submit-check.md          # Hackathon submission validator
├── packages/
│   ├── contracts/                   # Solidity (Foundry)
│   │   └── src/NexusHook.sol        # Uniswap v4 hook
│   ├── agent/                       # TypeScript agent
│   │   └── src/
│   │       ├── agent-brain.ts       # Core orchestrator
│   │       ├── types.ts             # Shared type definitions
│   │       ├── protocols/           # Protocol adapters
│   │       │   ├── lifi-adapter.ts  # LI.FI cross-chain
│   │       │   └── index.ts         # Adapter registry
│   │       ├── strategies/          # Trading strategies
│   │       │   └── index.ts         # Strategy registry
│   │       └── utils/
│   │           └── logger.ts        # Structured logging
│   └── frontend/                    # React dashboard
│       └── src/
└── docs/
    ├── architecture/
    └── sponsor-guides/
```

## 🎬 Demo Video

> [📹 Watch the 3-minute demo →](TODO_ADD_LINK)

## 🔗 Deployed Contracts

| Contract | Network | Address |
|----------|---------|---------|
| **NexusHook** | Sepolia | [`0xA23275CC359aF643f81Ed6d557C1d479f6Dc90c0`](https://sepolia.etherscan.io/address/0xA23275CC359aF643f81Ed6d557C1d479f6Dc90c0) |
| **Agent Wallet** | Sepolia | [`0xDBe5C802df8656995646AD55d2306aB05b7fc2d4`](https://sepolia.etherscan.io/address/0xDBe5C802df8656995646AD55d2306aB05b7fc2d4) |

## 👥 Team

- **David Rodriguez** — Vibecoder + Vision

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

_Built with 💚 at ETHGlobal HackMoney 2026_
