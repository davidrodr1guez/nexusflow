/**
 * Agent HTTP API Server
 *
 * Exposes the agent's state, logs, balances, and controls
 * to the frontend dashboard via a simple REST API.
 * Runs on port 3001 with CORS enabled.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getAgentAddress, getWalletClient, getPublicClient, getAccount } from './blockchain/client.js';
import { getAgentBalances, getAddressBalance } from './blockchain/balances.js';
import { createLogger } from './utils/logger.js';
import type { AgentBrain } from './agent-brain.js';
import { parseEther } from 'viem';
import { sepolia } from 'viem/chains';

const logger = createLogger('server');

const PORT = parseInt(process.env.AGENT_PORT ?? '3001', 10);
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:4173', 'http://127.0.0.1:5173'];

import { addTransaction, getTransactions, findTransaction } from './transaction-store.js';

export { addTransaction };

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function json(res: ServerResponse, data: unknown, status = 200, origin?: string): void {
  if (res.headersSent) return;
  const headers = corsHeaders(origin);
  res.writeHead(status, headers);
  res.end(JSON.stringify(data, bigintReplacer));
}

const MAX_BODY_SIZE = 1024 * 64; // 64 KB

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function startServer(agent: AgentBrain): void {
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      const headers = corsHeaders(origin);
      res.writeHead(204, headers);
      res.end();
      return;
    }

    try {
      // GET /api/health
      if (path === '/api/health' && method === 'GET') {
        const protocolHealth = await agent.getProtocolHealth();
        json(res, {
          status: 'ok',
          agent: agent.isRunning() ? 'running' : 'stopped',
          address: getAgentAddress(),
          protocols: protocolHealth,
          uptime: process.uptime(),
        }, 200, origin);
        return;
      }

      // GET /api/state
      if (path === '/api/state' && method === 'GET') {
        const state = agent.getState();
        json(res, {
          ...state,
          totalPortfolioUsd: state.totalPortfolioUsd.toString(),
          chainBalances: state.chainBalances.map((cb) => ({
            ...cb,
            totalUsdValue: cb.totalUsdValue.toString(),
            balances: cb.balances.map((b) => ({
              ...b,
              amount: b.amount.toString(),
              usdValue: b.usdValue.toString(),
            })),
          })),
        }, 200, origin);
        return;
      }

      // GET /api/logs
      if (path === '/api/logs' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
        const logs = agent.getLogs(limit);
        json(res, logs.map((l) => ({
          ...l,
          timestamp: l.timestamp.toISOString(),
        })), 200, origin);
        return;
      }

      // GET /api/balances
      if (path === '/api/balances' && method === 'GET') {
        const balances = await getAgentBalances();
        json(res, {
          address: balances.address,
          ethBalance: balances.ethBalance.toString(),
          ethFormatted: balances.ethFormatted,
          ethUsdEstimate: balances.ethUsdEstimate,
          tokens: balances.tokens.map((t) => ({
            ...t,
            balance: t.balance.toString(),
          })),
          totalUsdEstimate: balances.totalUsdEstimate,
          timestamp: balances.timestamp.toISOString(),
        }, 200, origin);
        return;
      }

      // GET /api/balances/:address
      if (path.startsWith('/api/balances/0x') && method === 'GET') {
        const address = path.split('/')[3] as `0x${string}`;
        const bal = await getAddressBalance(address);
        json(res, {
          address,
          ethBalance: bal.ethBalance.toString(),
          ethFormatted: bal.ethFormatted,
        }, 200, origin);
        return;
      }

      // GET /api/transactions
      if (path === '/api/transactions' && method === 'GET') {
        json(res, getTransactions(), 200, origin);
        return;
      }

      // POST /api/withdraw
      if (path === '/api/withdraw' && method === 'POST') {
        const body = await parseBody(req);
        const toAddress = body['to'] as `0x${string}` | undefined;
        const amountEth = body['amount'] as string | undefined;

        if (!toAddress || !amountEth) {
          json(res, { error: 'Missing "to" address or "amount" in ETH' }, 400, origin);
          return;
        }

        logger.execute(`Withdraw request: ${amountEth} ETH to ${toAddress}`);

        const walletClient = getWalletClient();
        const value = parseEther(amountEth);

        const txHash = await walletClient.sendTransaction({
          account: getAccount(),
          chain: sepolia,
          to: toAddress,
          value,
        });

        logger.execute(`Withdraw tx sent: ${txHash}`);

        addTransaction({
          txHash,
          type: 'withdraw',
          description: `Withdraw ${amountEth} ETH to ${toAddress.slice(0, 8)}...`,
          amount: amountEth,
          from: getAgentAddress(),
          to: toAddress,
          chainId: 11155111,
          timestamp: new Date().toISOString(),
          status: 'pending',
        });

        // Wait for confirmation
        const publicClient = getPublicClient();
        publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` }).then(() => {
          const tx = findTransaction(txHash);
          if (tx) tx.status = 'confirmed';
          logger.execute(`Withdraw confirmed: ${txHash}`);
        }).catch(() => {
          const tx = findTransaction(txHash);
          if (tx) tx.status = 'failed';
        });

        json(res, {
          success: true,
          txHash,
          etherscanUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
        }, 200, origin);
        return;
      }

      // POST /api/agent/start
      if (path === '/api/agent/start' && method === 'POST') {
        if (!agent.isRunning()) {
          await agent.start();
        }
        json(res, { status: 'running' }, 200, origin);
        return;
      }

      // POST /api/agent/stop
      if (path === '/api/agent/stop' && method === 'POST') {
        if (agent.isRunning()) {
          await agent.stop();
        }
        json(res, { status: 'stopped' }, 200, origin);
        return;
      }

      // GET /api/hook
      if (path === '/api/hook' && method === 'GET') {
        json(res, {
          address: '0xA23275CC359aF643f81Ed6d557C1d479f6Dc90c0',
          chainId: 11155111,
          agent: getAgentAddress(),
          etherscanUrl: 'https://sepolia.etherscan.io/address/0xA23275CC359aF643f81Ed6d557C1d479f6Dc90c0',
        }, 200, origin);
        return;
      }

      // 404
      json(res, { error: 'Not found' }, 404, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error(`API error: ${message}`);
      json(res, { error: message }, 500, origin);
    }
  });

  server.listen(PORT, () => {
    logger.execute(`Agent API server listening on http://localhost:${PORT}`);
    logger.info('Endpoints:');
    logger.info('  GET  /api/health');
    logger.info('  GET  /api/state');
    logger.info('  GET  /api/logs');
    logger.info('  GET  /api/balances');
    logger.info('  GET  /api/transactions');
    logger.info('  POST /api/withdraw');
    logger.info('  POST /api/agent/start');
    logger.info('  POST /api/agent/stop');
    logger.info('  GET  /api/hook');
  });
}
