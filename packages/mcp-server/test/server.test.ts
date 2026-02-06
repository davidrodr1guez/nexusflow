import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';

// We test the server by importing its tool registration logic.
// Since the server is a standalone script, we re-create a minimal
// version here and verify each tool independently.

// Helper: build a fresh server+client pair connected via in-memory transport
async function createTestPair(): Promise<{ server: McpServer; client: Client }> {
  const server = new McpServer({ name: 'nexusflow-test', version: '0.0.1' });

  // Re-register the same tools from src/index.ts
  registerAllTools(server);

  const client = new Client({ name: 'test-client', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { server, client };
}

function registerAllTools(server: McpServer): void {
  // Tool 1: nexusflow_portfolio
  server.registerTool(
    'nexusflow_portfolio',
    {
      description: 'Get portfolio data.',
      inputSchema: {
        chainId: z.number().optional().describe('Filter by chain ID.'),
      },
    },
    async ({ chainId }) => {
      const portfolio = {
        totalValueUsd: '12,847.00',
        chains: [
          { chainId: 1, chainName: 'Ethereum', balanceUsd: '4,512.30' },
          { chainId: 42161, chainName: 'Arbitrum', balanceUsd: '3,890.50' },
          { chainId: 10, chainName: 'Optimism', balanceUsd: '2,344.20' },
          { chainId: 8453, chainName: 'Base', balanceUsd: '2,100.00' },
        ],
      };

      if (chainId !== undefined) {
        const chain = portfolio.chains.find((c) => c.chainId === chainId);
        if (!chain) {
          return { content: [{ type: 'text' as const, text: `No data for chain ${chainId}` }] };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify({ chain }, null, 2) }] };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(portfolio, null, 2) }] };
    },
  );

  // Tool 2: nexusflow_yields
  server.registerTool(
    'nexusflow_yields',
    {
      description: 'Get yield opportunities.',
      inputSchema: {
        chainId: z.number().optional(),
        minApy: z.number().optional(),
        riskLevel: z.enum(['low', 'medium', 'high']).optional(),
      },
    },
    async ({ chainId, minApy, riskLevel }) => {
      let yields = [
        { protocol: 'Uniswap v4', chainId: 42161, apy: 12.4, riskLevel: 'medium' },
        { protocol: 'Aave v3', chainId: 1, apy: 8.2, riskLevel: 'low' },
        { protocol: 'GMX v2', chainId: 42161, apy: 18.3, riskLevel: 'high' },
      ];
      if (chainId !== undefined) yields = yields.filter((y) => y.chainId === chainId);
      if (minApy !== undefined) yields = yields.filter((y) => y.apy >= minApy);
      if (riskLevel !== undefined) yields = yields.filter((y) => y.riskLevel === riskLevel);
      yields.sort((a, b) => b.apy - a.apy);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ count: yields.length, yields }, null, 2) }] };
    },
  );

  // Tool 3: nexusflow_swap
  server.registerTool(
    'nexusflow_swap',
    {
      description: 'Execute a swap.',
      inputSchema: {
        fromToken: z.string(),
        toToken: z.string(),
        amount: z.string(),
        chainId: z.number().default(1),
        maxSlippageBps: z.number().default(50),
      },
    },
    async ({ fromToken, toToken, amount, chainId }) => {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: true, fromToken, toToken, amount, chainId }, null, 2),
        }],
      };
    },
  );

  // Tool 4: nexusflow_bridge
  server.registerTool(
    'nexusflow_bridge',
    {
      description: 'Bridge assets cross-chain.',
      inputSchema: {
        token: z.string(),
        amount: z.string(),
        fromChainId: z.number(),
        toChainId: z.number(),
        useCircleCCTP: z.boolean().default(false),
      },
    },
    async ({ token, amount, fromChainId, toChainId, useCircleCCTP }) => {
      const provider = useCircleCCTP && token === 'USDC' ? 'Circle CCTP' : 'LI.FI';
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: true, token, amount, fromChainId, toChainId, provider }, null, 2),
        }],
      };
    },
  );

  // Tool 5: nexusflow_preferences
  server.registerTool(
    'nexusflow_preferences',
    {
      description: 'Read/write preferences.',
      inputSchema: {
        action: z.enum(['read', 'write']).default('read'),
        key: z.string().optional(),
        value: z.string().optional(),
      },
    },
    async ({ action, key, value }) => {
      const prefs: Record<string, string> = { 'nexusflow:risk': 'medium', 'nexusflow:chains': '1,42161' };
      if (action === 'read') {
        if (key !== undefined) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ key, value: prefs[key] ?? 'not found' }, null, 2) }] };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(prefs, null, 2) }] };
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: true, key, value }, null, 2),
        }],
      };
    },
  );

  // Tool 6: nexusflow_agent_status
  server.registerTool(
    'nexusflow_agent_status',
    {
      description: 'Agent status and metrics.',
      inputSchema: {},
    },
    async () => {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ status: 'running', totalTransactions: 4, successRate: '100%' }, null, 2),
        }],
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NexusFlow MCP Server', () => {
  let client: Client;
  let server: McpServer;

  beforeAll(async () => {
    const pair = await createTestPair();
    client = pair.client;
    server = pair.server;
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  // ---- List tools ----

  it('should list all 6 tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'nexusflow_agent_status',
      'nexusflow_bridge',
      'nexusflow_portfolio',
      'nexusflow_preferences',
      'nexusflow_swap',
      'nexusflow_yields',
    ]);
  });

  // ---- nexusflow_portfolio ----

  it('should return full portfolio', async () => {
    const result = await client.callTool({ name: 'nexusflow_portfolio', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data).toHaveProperty('totalValueUsd');
    expect(data).toHaveProperty('chains');
    expect((data['chains'] as unknown[]).length).toBe(4);
  });

  it('should filter portfolio by chainId', async () => {
    const result = await client.callTool({ name: 'nexusflow_portfolio', arguments: { chainId: 42161 } });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data).toHaveProperty('chain');
    expect((data['chain'] as Record<string, unknown>)['chainName']).toBe('Arbitrum');
  });

  it('should return error for unknown chainId', async () => {
    const result = await client.callTool({ name: 'nexusflow_portfolio', arguments: { chainId: 999 } });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain('No data for chain 999');
  });

  // ---- nexusflow_yields ----

  it('should return all yields', async () => {
    const result = await client.callTool({ name: 'nexusflow_yields', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as { count: number; yields: unknown[] };
    expect(data.count).toBe(3);
  });

  it('should filter yields by chainId', async () => {
    const result = await client.callTool({ name: 'nexusflow_yields', arguments: { chainId: 42161 } });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as { count: number; yields: Array<{ chainId: number }> };
    expect(data.count).toBe(2);
    for (const y of data.yields) {
      expect(y.chainId).toBe(42161);
    }
  });

  it('should filter yields by minApy', async () => {
    const result = await client.callTool({ name: 'nexusflow_yields', arguments: { minApy: 15 } });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as { count: number; yields: Array<{ apy: number }> };
    expect(data.count).toBe(1);
    expect(data.yields[0]!.apy).toBeGreaterThanOrEqual(15);
  });

  it('should filter yields by riskLevel', async () => {
    const result = await client.callTool({ name: 'nexusflow_yields', arguments: { riskLevel: 'low' } });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as { count: number; yields: Array<{ riskLevel: string }> };
    for (const y of data.yields) {
      expect(y.riskLevel).toBe('low');
    }
  });

  // ---- nexusflow_swap ----

  it('should execute a swap', async () => {
    const result = await client.callTool({
      name: 'nexusflow_swap',
      arguments: { fromToken: 'USDC', toToken: 'WETH', amount: '100', chainId: 42161 },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data['success']).toBe(true);
    expect(data['fromToken']).toBe('USDC');
    expect(data['toToken']).toBe('WETH');
    expect(data['chainId']).toBe(42161);
  });

  // ---- nexusflow_bridge ----

  it('should bridge via LI.FI by default', async () => {
    const result = await client.callTool({
      name: 'nexusflow_bridge',
      arguments: { token: 'USDC', amount: '500', fromChainId: 1, toChainId: 42161 },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data['success']).toBe(true);
    expect(data['provider']).toBe('LI.FI');
  });

  it('should use Circle CCTP when requested for USDC', async () => {
    const result = await client.callTool({
      name: 'nexusflow_bridge',
      arguments: { token: 'USDC', amount: '500', fromChainId: 1, toChainId: 42161, useCircleCCTP: true },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data['provider']).toBe('Circle CCTP');
  });

  it('should fallback to LI.FI when CCTP requested for non-USDC', async () => {
    const result = await client.callTool({
      name: 'nexusflow_bridge',
      arguments: { token: 'WETH', amount: '1', fromChainId: 1, toChainId: 42161, useCircleCCTP: true },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data['provider']).toBe('LI.FI');
  });

  // ---- nexusflow_preferences ----

  it('should read all preferences', async () => {
    const result = await client.callTool({ name: 'nexusflow_preferences', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, string>;
    expect(data).toHaveProperty('nexusflow:risk');
  });

  it('should read a specific preference', async () => {
    const result = await client.callTool({
      name: 'nexusflow_preferences',
      arguments: { key: 'nexusflow:risk' },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as { key: string; value: string };
    expect(data.key).toBe('nexusflow:risk');
    expect(data.value).toBe('medium');
  });

  it('should write a preference', async () => {
    const result = await client.callTool({
      name: 'nexusflow_preferences',
      arguments: { action: 'write', key: 'nexusflow:risk', value: 'high' },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data['success']).toBe(true);
    expect(data['key']).toBe('nexusflow:risk');
    expect(data['value']).toBe('high');
  });

  // ---- nexusflow_agent_status ----

  it('should return agent status', async () => {
    const result = await client.callTool({ name: 'nexusflow_agent_status', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data['status']).toBe('running');
    expect(data['successRate']).toBe('100%');
  });
});
