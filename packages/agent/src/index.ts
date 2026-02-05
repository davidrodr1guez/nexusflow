/**
 * NexusFlow Agent — Entry Point
 *
 * Initializes protocol adapters, registers strategies,
 * and starts the agent brain loop.
 */

import { AgentBrain } from './agent-brain.js';
import { protocolRegistry } from './protocols/index.js';
import { strategyRegistry } from './strategies/index.js';
import { LiFiAdapter } from './protocols/lifi-adapter.js';
import { YellowAdapter } from './protocols/yellow-adapter.js';
import { ENSAdapter } from './protocols/ens-adapter.js';
import { ArcAdapter } from './protocols/arc-adapter.js';
import { YieldOptimizerStrategy } from './strategies/yield-optimizer.js';
import { RebalancerStrategy } from './strategies/rebalancer.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('main');

async function main(): Promise<void> {
  logger.info('🌊 NexusFlow Agent starting...');

  // Register protocol adapters
  protocolRegistry.register(new LiFiAdapter());
  protocolRegistry.register(new YellowAdapter());
  protocolRegistry.register(new ENSAdapter());
  protocolRegistry.register(new ArcAdapter());

  // Register strategies
  strategyRegistry.register(new YieldOptimizerStrategy());
  strategyRegistry.register(new RebalancerStrategy());

  // Create and start agent
  const agent = new AgentBrain({
    ensName: process.env.ENS_NAME ?? 'nexusflow.eth',
    owner: (process.env.AGENT_ADDRESS as `0x${string}`) ?? '0x0000000000000000000000000000000000000000',
    tickIntervalMs: Number(process.env.AGENT_TICK_INTERVAL_MS ?? 30_000),
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await agent.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await agent.start();
  logger.execute('🚀 NexusFlow Agent is live');
}

main().catch((err) => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});

export { AgentBrain } from './agent-brain.js';
export type * from './types.js';
