/**
 * Strategy registry and base types.
 */

import type { IStrategy, StrategyStatus } from '../types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('strategies');

class StrategyRegistry {
  private strategies = new Map<string, IStrategy>();

  register(strategy: IStrategy): void {
    this.strategies.set(strategy.id, strategy);
    logger.info(`Registered strategy: ${strategy.name} (${strategy.id})`);
  }

  get(id: string): IStrategy {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      throw new Error(`Strategy "${id}" not found`);
    }
    return strategy;
  }

  getActive(): IStrategy[] {
    return Array.from(this.strategies.values())
      .filter((s) => s.getStatus() === 'active');
  }

  getAll(): IStrategy[] {
    return Array.from(this.strategies.values());
  }

  getStatusSummary(): Record<string, StrategyStatus> {
    const summary: Record<string, StrategyStatus> = {};
    for (const [id, strategy] of this.strategies) {
      summary[id] = strategy.getStatus();
    }
    return summary;
  }
}

export const strategyRegistry = new StrategyRegistry();
