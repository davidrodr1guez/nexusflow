/**
 * AgentBrain — The core orchestrator of NexusFlow.
 *
 * Implements the Monitor → Decide → Execute loop:
 * 1. Monitor: Scan cross-chain state, prices, yield opportunities
 * 2. Decide: Evaluate strategies against current state
 * 3. Execute: Perform the highest-value action via protocol adapters
 *
 * Integrations used:
 * - LI.FI: Cross-chain routing
 * - Uniswap v4: AMM pools + hooks
 * - Yellow SDK: Off-chain instant payments
 * - Arc/Circle: USDC cross-chain settlement
 * - ENS: Agent identity + preference storage
 */

import type {
  AgentState,
  AgentPreferences,
  AgentLog,
  StrategyAction,
  TransactionResult,
  ChainId,
} from './types.js';
import { protocolRegistry } from './protocols/index.js';
import { strategyRegistry } from './strategies/index.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('agent-brain');

export interface AgentBrainConfig {
  ensName: string;
  owner: `0x${string}`;
  preferences: AgentPreferences;
  tickIntervalMs: number; // How often the agent loop runs
}

const DEFAULT_PREFERENCES: AgentPreferences = {
  maxSlippageBps: 50, // 0.5%
  riskLevel: 'medium',
  preferredChains: [1, 42161, 10, 8453] as ChainId[],
  maxGasPerTx: 500000n,
  rebalanceThresholdPct: 5,
};

export class AgentBrain {
  private config: AgentBrainConfig;
  private state: AgentState;
  private running = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private logs: AgentLog[] = [];

  constructor(config: Partial<AgentBrainConfig> & { ensName: string; owner: `0x${string}` }) {
    this.config = {
      ensName: config.ensName,
      owner: config.owner,
      preferences: config.preferences ?? DEFAULT_PREFERENCES,
      tickIntervalMs: config.tickIntervalMs ?? 30_000, // 30 seconds
    };

    this.state = {
      ensName: this.config.ensName,
      owner: this.config.owner,
      chainBalances: [],
      totalPortfolioUsd: 0n,
      activeStrategies: [],
      preferences: this.config.preferences,
      lastUpdated: new Date(),
    };
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  async start(): Promise<void> {
    logger.execute(`Starting NexusFlow agent: ${this.config.ensName}`);

    // Initialize all protocol adapters
    await protocolRegistry.initializeAll();

    // Health check
    const health = await protocolRegistry.healthCheckAll();
    logger.info('Protocol health check', health);

    // Start the agent loop
    this.running = true;
    this.tickTimer = setInterval(() => this.tick(), this.config.tickIntervalMs);

    // Run first tick immediately
    await this.tick();

    logger.execute('Agent started successfully', {
      ensName: this.config.ensName,
      strategies: strategyRegistry.getAll().map((s) => s.name),
    });
  }

  async stop(): Promise<void> {
    logger.info('Stopping agent...');
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    await protocolRegistry.shutdownAll();
    logger.info('Agent stopped');
  }

  // ============================================================
  // Monitor → Decide → Execute Loop
  // ============================================================

  private async tick(): Promise<void> {
    if (!this.running) return;

    try {
      // 1. MONITOR — Update state
      await this.monitor();

      // 2. DECIDE — Evaluate strategies
      const action = await this.decide();

      // 3. EXECUTE — If there's a worthwhile action
      if (action) {
        await this.execute(action);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error in agent tick';
      logger.error(message);
      this.addLog('error', message);
    }
  }

  private async monitor(): Promise<void> {
    this.addLog('monitor', 'Scanning cross-chain state across all connected chains...');

    // TODO: Fetch real balances from each chain via viem
    // TODO: Fetch ENS text records for preferences
    // TODO: Update yield rates from protocols

    this.state.lastUpdated = new Date();
  }

  private async decide(): Promise<StrategyAction | null> {
    const activeStrategies = strategyRegistry.getActive();
    if (activeStrategies.length === 0) {
      return null;
    }

    this.addLog('monitor', `Evaluating ${activeStrategies.length} active strategies...`);

    // Evaluate all strategies and pick the best action
    const candidates: StrategyAction[] = [];

    for (const strategy of activeStrategies) {
      try {
        const action = await strategy.evaluate(this.state);
        if (action) {
          candidates.push(action);
          this.addLog('decide', `Strategy "${strategy.name}" suggests: ${action.description}`, action.params.chain as string);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Strategy evaluation failed';
        logger.error(`Strategy "${strategy.name}" failed: ${msg}`);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Pick the action with highest estimated profit
    candidates.sort((a, b) => {
      if (b.estimatedProfit > a.estimatedProfit) return 1;
      if (b.estimatedProfit < a.estimatedProfit) return -1;
      return 0;
    });

    const best = candidates[0];
    this.addLog('decide', `Selected action: ${best.description} (est. profit: ${best.estimatedProfit})`);
    return best;
  }

  private async execute(action: StrategyAction): Promise<TransactionResult> {
    this.addLog('execute', `Executing: ${action.description}`);

    const strategy = strategyRegistry.get(action.strategyId);
    const result = await strategy.execute(action);

    if (result.success) {
      this.addLog('execute', `✅ Success: ${action.description}`, result.chainId.toString(), result.txHash);
    } else {
      this.addLog('error', `❌ Failed: ${action.description} — ${result.error}`);
    }

    return result;
  }

  // ============================================================
  // Log Management
  // ============================================================

  private addLog(level: AgentLog['level'], message: string, chain?: string, txHash?: string): void {
    const log: AgentLog = {
      timestamp: new Date(),
      level,
      message,
      chain,
      txHash,
    };
    this.logs.unshift(log); // Most recent first
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 500); // Trim to prevent memory issues
    }
  }

  // ============================================================
  // Public API (for frontend)
  // ============================================================

  getState(): AgentState {
    return { ...this.state };
  }

  getLogs(limit = 50): AgentLog[] {
    return this.logs.slice(0, limit);
  }

  isRunning(): boolean {
    return this.running;
  }

  getProtocolHealth(): Promise<Record<string, boolean>> {
    return protocolRegistry.healthCheckAll();
  }
}
