/**
 * AgentBrain — The core orchestrator of NexusFlow.
 *
 * Implements the Monitor -> Decide -> Execute loop:
 * 1. Monitor: Scan real Sepolia balances and cross-chain state
 * 2. Decide: Evaluate strategies against current state
 * 3. Execute: Perform the highest-value action via protocol adapters
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
import { getAgentBalances, balanceToChainBalance } from './blockchain/balances.js';
import { addTransaction } from './transaction-store.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('agent-brain');

export interface AgentBrainConfig {
  ensName: string;
  owner: `0x${string}`;
  preferences: AgentPreferences;
  tickIntervalMs: number;
}

const DEFAULT_PREFERENCES: AgentPreferences = {
  maxSlippageBps: 50,
  riskLevel: 'medium',
  preferredChains: [1, 42161, 10, 8453, 11155111] as ChainId[],
  maxGasPerTx: 500000n,
  rebalanceThresholdPct: 5,
};

export class AgentBrain {
  private config: AgentBrainConfig;
  private state: AgentState;
  private running = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private logs: AgentLog[] = [];
  private tickCount = 0;

  constructor(config: Partial<AgentBrainConfig> & { ensName: string; owner: `0x${string}` }) {
    this.config = {
      ensName: config.ensName,
      owner: config.owner,
      preferences: config.preferences ?? DEFAULT_PREFERENCES,
      tickIntervalMs: config.tickIntervalMs ?? 30_000,
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
  // Monitor -> Decide -> Execute Loop
  // ============================================================

  private async tick(): Promise<void> {
    if (!this.running) return;
    this.tickCount++;

    try {
      // 1. MONITOR — Update state with real data
      await this.monitor();

      // 2. DECIDE — Evaluate strategies
      const action = await this.decide();

      // 3. EXECUTE — If there's a worthwhile action
      if (action) {
        await this.execute(action);
      } else {
        this.addLog('monitor', `Tick #${this.tickCount} complete. No action needed. Next scan in ${this.config.tickIntervalMs / 1000}s.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error in agent tick';
      logger.error(message);
      this.addLog('error', message);
    }
  }

  private async monitor(): Promise<void> {
    this.addLog('monitor', `Tick #${this.tickCount}: Scanning Sepolia chain state...`);

    try {
      // Fetch real balances from Sepolia
      const balances = await getAgentBalances();
      const chainBalance = balanceToChainBalance(balances);

      this.state.chainBalances = [chainBalance];
      this.state.totalPortfolioUsd = chainBalance.totalUsdValue;

      this.addLog('monitor', `Agent balance: ${balances.ethFormatted.slice(0, 8)} ETH (~$${balances.ethUsdEstimate.toFixed(2)})`, 'Sepolia');

      if (balances.tokens.length > 0) {
        for (const token of balances.tokens) {
          this.addLog('monitor', `  ${token.symbol}: ${token.formatted.slice(0, 10)}`, 'Sepolia');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read balances';
      this.addLog('error', `Balance read failed: ${msg}`);
    }

    // Update active strategies list
    this.state.activeStrategies = strategyRegistry.getActive().map((s) => s.id);
    this.state.lastUpdated = new Date();
  }

  private async decide(): Promise<StrategyAction | null> {
    const activeStrategies = strategyRegistry.getActive();
    if (activeStrategies.length === 0) {
      return null;
    }

    this.addLog('decide', `Evaluating ${activeStrategies.length} active strategies...`);

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
      this.addLog('decide', 'No profitable actions found above gas threshold. Holding positions.');
      return null;
    }

    // Pick the action with highest estimated profit
    candidates.sort((a, b) => {
      if (b.estimatedProfit > a.estimatedProfit) return 1;
      if (b.estimatedProfit < a.estimatedProfit) return -1;
      return 0;
    });

    const best = candidates[0]!;
    this.addLog('decide', `Selected action: ${best.description} (est. profit: ${best.estimatedProfit})`);
    return best;
  }

  private async execute(action: StrategyAction): Promise<TransactionResult> {
    this.addLog('execute', `Executing: ${action.description}`);

    const strategy = strategyRegistry.get(action.strategyId);
    const result = await strategy.execute(action);

    if (result.success) {
      this.addLog('execute', `Success: ${action.description}`, result.chainId.toString(), result.txHash);

      // Record transaction
      if (result.txHash) {
        addTransaction({
          txHash: result.txHash,
          type: action.type === 'bridge' ? 'bridge' : 'swap',
          description: action.description,
          chainId: result.chainId,
          timestamp: new Date().toISOString(),
          status: 'confirmed',
        });
      }
    } else {
      this.addLog('error', `Failed: ${action.description} — ${result.error}`);
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
    this.logs.unshift(log);
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 500);
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

  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Execute a strategy on-demand (called from API).
   * Evaluates the strategy to produce an action, then executes it.
   * If the strategy finds no action, returns an error result.
   */
  async executeStrategy(strategyId: string): Promise<TransactionResult> {
    const strategy = strategyRegistry.get(strategyId);

    this.addLog('execute', `Manual execution requested for "${strategy.name}"`);

    // Refresh state before evaluating
    await this.monitor();

    const action = await strategy.evaluate(this.state);
    if (!action) {
      this.addLog('decide', `Strategy "${strategy.name}" found no actionable opportunity right now`);
      return {
        success: false,
        chainId: 11155111 as ChainId,
        error: 'No actionable opportunity found. Conditions not met for execution.',
        timestamp: new Date(),
      };
    }

    this.addLog('decide', `Strategy "${strategy.name}" suggests: ${action.description}`);
    return this.execute(action);
  }

  /**
   * Get strategy status and metrics for all registered strategies.
   */
  getStrategies(): Array<{ id: string; name: string; status: string; metrics: Record<string, unknown> }> {
    return strategyRegistry.getAll().map((s) => ({
      id: s.id,
      name: s.name,
      status: s.getStatus(),
      metrics: {
        ...s.getMetrics(),
        totalPnl: s.getMetrics().totalPnl.toString(),
        allocatedCapital: s.getMetrics().allocatedCapital.toString(),
      },
    }));
  }

  /**
   * Pause or resume a strategy.
   */
  setStrategyStatus(strategyId: string, active: boolean): void {
    const strategy = strategyRegistry.get(strategyId);
    if (active) {
      strategy.resume();
      this.addLog('execute', `Strategy "${strategy.name}" resumed`);
    } else {
      strategy.pause();
      this.addLog('execute', `Strategy "${strategy.name}" paused`);
    }
  }
}
