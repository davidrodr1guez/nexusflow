#!/usr/bin/env node

/**
 * NexusFlow MCP Server
 *
 * Exposes the NexusFlow AI DeFi agent as MCP tools so any
 * MCP-compatible client (Claude Desktop, Cursor, VS Code, etc.)
 * can interact with cross-chain DeFi operations.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Demo data helpers — in production these would call real adapters
// ---------------------------------------------------------------------------

interface ChainPortfolio {
  chainId: number;
  chainName: string;
  balanceUsd: string;
  tokens: { symbol: string; balance: string; valueUsd: string }[];
}

interface YieldOpportunity {
  protocol: string;
  chainId: number;
  chainName: string;
  pool: string;
  apy: number;
  tvl: string;
  riskLevel: string;
}

function getPortfolioData(): { totalValueUsd: string; chains: ChainPortfolio[] } {
  return {
    totalValueUsd: '12,847.00',
    chains: [
      {
        chainId: 1,
        chainName: 'Ethereum',
        balanceUsd: '4,512.30',
        tokens: [
          { symbol: 'USDC', balance: '2,500.00', valueUsd: '2,500.00' },
          { symbol: 'WETH', balance: '0.82', valueUsd: '2,012.30' },
        ],
      },
      {
        chainId: 42161,
        chainName: 'Arbitrum',
        balanceUsd: '3,890.50',
        tokens: [
          { symbol: 'USDC', balance: '1,890.50', valueUsd: '1,890.50' },
          { symbol: 'ARB', balance: '1,200', valueUsd: '2,000.00' },
        ],
      },
      {
        chainId: 10,
        chainName: 'Optimism',
        balanceUsd: '2,344.20',
        tokens: [
          { symbol: 'USDC', balance: '1,344.20', valueUsd: '1,344.20' },
          { symbol: 'OP', balance: '500', valueUsd: '1,000.00' },
        ],
      },
      {
        chainId: 8453,
        chainName: 'Base',
        balanceUsd: '2,100.00',
        tokens: [
          { symbol: 'USDC', balance: '2,100.00', valueUsd: '2,100.00' },
        ],
      },
    ],
  };
}

function getYieldData(): YieldOpportunity[] {
  return [
    { protocol: 'Uniswap v4', chainId: 42161, chainName: 'Arbitrum', pool: 'USDC/WETH', apy: 12.4, tvl: '$48.2M', riskLevel: 'medium' },
    { protocol: 'Aave v3', chainId: 1, chainName: 'Ethereum', pool: 'USDC Supply', apy: 8.2, tvl: '$1.2B', riskLevel: 'low' },
    { protocol: 'Uniswap v4', chainId: 8453, chainName: 'Base', pool: 'USDC/WETH', apy: 15.1, tvl: '$12.7M', riskLevel: 'medium' },
    { protocol: 'Aerodrome', chainId: 8453, chainName: 'Base', pool: 'USDC/USDbC', apy: 6.8, tvl: '$95.3M', riskLevel: 'low' },
    { protocol: 'GMX v2', chainId: 42161, chainName: 'Arbitrum', pool: 'GLP', apy: 18.3, tvl: '$320M', riskLevel: 'high' },
    { protocol: 'Exactly', chainId: 10, chainName: 'Optimism', pool: 'USDC Market', apy: 9.1, tvl: '$28.5M', riskLevel: 'low' },
  ];
}

function getAgentMetrics(): Record<string, unknown> {
  return {
    status: 'running',
    uptime: '4h 23m',
    strategies: {
      'yield-optimizer': { status: 'active', executedTrades: 3, totalPnl: '+$42.18', apy: '8.2%' },
      'cross-chain-rebalancer': { status: 'active', executedTrades: 1, totalPnl: '+$12.50', apy: '4.1%' },
    },
    protocols: {
      'lifi': { status: 'connected', latency: '120ms' },
      'yellow-sdk': { status: 'connected', latency: '45ms' },
      'ens': { status: 'connected', latency: '80ms' },
      'arc-circle': { status: 'connected', latency: '95ms' },
    },
    lastTick: new Date().toISOString(),
    totalTransactions: 4,
    successRate: '100%',
  };
}

function getEnsPreferences(): Record<string, string> {
  return {
    ensName: 'nexusflow.eth',
    'nexusflow:swap-pref': 'low-gas',
    'nexusflow:risk': 'medium',
    'nexusflow:chains': '1,42161,10,8453',
    'nexusflow:max-slippage': '50',
    'nexusflow:rebalance-threshold': '5',
  };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'nexusflow',
  version: '0.1.0',
});

// ---------------------------------------------------------------------------
// Tool 1: nexusflow_portfolio
// ---------------------------------------------------------------------------
server.registerTool(
  'nexusflow_portfolio',
  {
    description:
      'Get the NexusFlow agent portfolio — total value and per-chain balances including individual token holdings.',
    inputSchema: {
      chainId: z.number().optional().describe('Filter by chain ID (1=Ethereum, 42161=Arbitrum, 10=Optimism, 8453=Base). Omit for all chains.'),
    },
  },
  async ({ chainId }) => {
    const portfolio = getPortfolioData();

    if (chainId !== undefined) {
      const chain = portfolio.chains.find((c) => c.chainId === chainId);
      if (!chain) {
        return {
          content: [{ type: 'text' as const, text: `No portfolio data for chain ID ${chainId}. Supported: 1 (Ethereum), 42161 (Arbitrum), 10 (Optimism), 8453 (Base).` }],
        };
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ totalValueUsd: portfolio.totalValueUsd, chain }, null, 2),
        }],
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(portfolio, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool 2: nexusflow_yields
// ---------------------------------------------------------------------------
server.registerTool(
  'nexusflow_yields',
  {
    description:
      'Get the best cross-chain yield opportunities available to the NexusFlow agent. Returns APY, TVL, risk level, and protocol information.',
    inputSchema: {
      chainId: z.number().optional().describe('Filter yields by chain ID.'),
      minApy: z.number().optional().describe('Minimum APY percentage to include (e.g. 10 for 10%).'),
      riskLevel: z.enum(['low', 'medium', 'high']).optional().describe('Filter by risk level.'),
    },
  },
  async ({ chainId, minApy, riskLevel }) => {
    let yields = getYieldData();

    if (chainId !== undefined) {
      yields = yields.filter((y) => y.chainId === chainId);
    }
    if (minApy !== undefined) {
      yields = yields.filter((y) => y.apy >= minApy);
    }
    if (riskLevel !== undefined) {
      yields = yields.filter((y) => y.riskLevel === riskLevel);
    }

    yields.sort((a, b) => b.apy - a.apy);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ count: yields.length, yields }, null, 2),
      }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool 3: nexusflow_swap
// ---------------------------------------------------------------------------
server.registerTool(
  'nexusflow_swap',
  {
    description:
      'Execute a token swap on a single chain via the LI.FI adapter. Returns a simulated transaction result.',
    inputSchema: {
      fromToken: z.string().describe('Token symbol to sell (e.g. "USDC", "WETH").'),
      toToken: z.string().describe('Token symbol to buy.'),
      amount: z.string().describe('Amount to swap in human-readable units (e.g. "100.5").'),
      chainId: z.number().default(1).describe('Chain ID to swap on (default: 1 Ethereum).'),
      maxSlippageBps: z.number().default(50).describe('Max slippage in basis points (default: 50 = 0.5%).'),
    },
  },
  async ({ fromToken, toToken, amount, chainId, maxSlippageBps }) => {
    // Simulate swap via LI.FI
    const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

    const result = {
      success: true,
      action: 'swap',
      fromToken,
      toToken,
      amount,
      chainId,
      maxSlippageBps,
      estimatedOutput: `${(parseFloat(amount) * 0.998).toFixed(4)} ${toToken}`,
      txHash,
      gasUsed: '185,000',
      route: `LI.FI → best DEX on chain ${chainId}`,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool 4: nexusflow_bridge
// ---------------------------------------------------------------------------
server.registerTool(
  'nexusflow_bridge',
  {
    description:
      'Bridge assets cross-chain via LI.FI or Arc/Circle CCTP. Moves tokens from one chain to another.',
    inputSchema: {
      token: z.string().describe('Token symbol to bridge (e.g. "USDC").'),
      amount: z.string().describe('Amount to bridge in human-readable units.'),
      fromChainId: z.number().describe('Source chain ID.'),
      toChainId: z.number().describe('Destination chain ID.'),
      useCircleCCTP: z.boolean().default(false).describe('Use Circle CCTP for USDC bridging (faster, no slippage). Default: false (uses LI.FI).'),
    },
  },
  async ({ token, amount, fromChainId, toChainId, useCircleCCTP }) => {
    const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

    const bridgeProvider = useCircleCCTP && token.toUpperCase() === 'USDC'
      ? 'Arc/Circle CCTP (burn & mint)'
      : 'LI.FI (best bridge route)';

    const estimatedTime = useCircleCCTP ? '~2 minutes' : '~5-15 minutes';

    const chainNames: Record<number, string> = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 8453: 'Base' };

    const result = {
      success: true,
      action: 'bridge',
      token,
      amount,
      from: { chainId: fromChainId, name: chainNames[fromChainId] ?? `Chain ${fromChainId}` },
      to: { chainId: toChainId, name: chainNames[toChainId] ?? `Chain ${toChainId}` },
      provider: bridgeProvider,
      estimatedTime,
      txHash,
      gasUsed: '250,000',
      timestamp: new Date().toISOString(),
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool 5: nexusflow_preferences
// ---------------------------------------------------------------------------
server.registerTool(
  'nexusflow_preferences',
  {
    description:
      'Read or update the NexusFlow agent preferences stored as ENS text records on nexusflow.eth.',
    inputSchema: {
      action: z.enum(['read', 'write']).default('read').describe('Read current preferences or write new ones.'),
      key: z.string().optional().describe('Specific preference key to read/write (e.g. "nexusflow:risk"). Omit to read all.'),
      value: z.string().optional().describe('New value to set (required when action=write).'),
    },
  },
  async ({ action, key, value }) => {
    const prefs = getEnsPreferences();

    if (action === 'read') {
      if (key !== undefined) {
        const val = prefs[key];
        if (val === undefined) {
          return {
            content: [{ type: 'text' as const, text: `Preference "${key}" not found. Available keys: ${Object.keys(prefs).join(', ')}` }],
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ key, value: val }, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(prefs, null, 2) }],
      };
    }

    // action === 'write'
    if (key === undefined || value === undefined) {
      return {
        content: [{ type: 'text' as const, text: 'Error: both "key" and "value" are required when action=write.' }],
      };
    }

    const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          action: 'setTextRecord',
          ensName: 'nexusflow.eth',
          key,
          value,
          txHash,
          timestamp: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool 6: nexusflow_agent_status
// ---------------------------------------------------------------------------
server.registerTool(
  'nexusflow_agent_status',
  {
    description:
      'Get the NexusFlow agent runtime status — whether it is running, strategy metrics, protocol health, and recent activity.',
    inputSchema: {},
  },
  async () => {
    const metrics = getAgentMetrics();

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(metrics, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NexusFlow MCP server running on stdio');
}

main().catch((err: unknown) => {
  console.error('Fatal error starting NexusFlow MCP server:', err);
  process.exit(1);
});
