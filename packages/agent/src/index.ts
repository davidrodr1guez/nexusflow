/**
 * NexusFlow Agent — Entry Point
 *
 * Initializes protocol adapters, registers strategies,
 * starts the agent brain loop, and launches the HTTP API server.
 */

import dotenv from 'dotenv';
import { resolve } from 'node:path';

// Load .env from monorepo root
dotenv.config({ path: resolve(import.meta.dirname, '../../../.env') });

import { AgentBrain } from './agent-brain.js';
import { protocolRegistry } from './protocols/index.js';
import { strategyRegistry } from './strategies/index.js';
import { LiFiAdapter } from './protocols/lifi-adapter.js';
import { YellowAdapter } from './protocols/yellow-adapter.js';
import { ENSAdapter } from './protocols/ens-adapter.js';
import { ArcAdapter } from './protocols/arc-adapter.js';
import { YieldOptimizerStrategy } from './strategies/yield-optimizer.js';
import { RebalancerStrategy } from './strategies/rebalancer.js';
import { startServer } from './server.js';
import { getAgentAddress } from './blockchain/client.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('main');

async function main(): Promise<void> {
  logger.info('NexusFlow Agent starting...');

  // Show agent wallet address
  const agentAddress = getAgentAddress();
  logger.execute(`Agent wallet: ${agentAddress}`);

  // Register protocol adapters
  protocolRegistry.register(new LiFiAdapter());
  protocolRegistry.register(new YellowAdapter());
  protocolRegistry.register(new ENSAdapter());
  protocolRegistry.register(new ArcAdapter());

  // Register strategies
  strategyRegistry.register(new YieldOptimizerStrategy());
  strategyRegistry.register(new RebalancerStrategy());

  // Create agent
  const agent = new AgentBrain({
    ensName: process.env.ENS_NAME ?? 'nexusflow.eth',
    owner: agentAddress,
    tickIntervalMs: Number(process.env.AGENT_TICK_INTERVAL_MS ?? 30_000),
  });

  // Start HTTP API server
  startServer(agent);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await agent.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start agent brain loop
  await agent.start();
  logger.execute('NexusFlow Agent is live');
}

main().catch((err) => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});

export { AgentBrain } from './agent-brain.js';
export type * from './types.js';
