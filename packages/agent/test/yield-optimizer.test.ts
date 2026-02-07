import { describe, it, expect, beforeEach } from 'vitest';
import { YieldOptimizerStrategy } from '../src/strategies/yield-optimizer.js';
import type { AgentState, ChainId } from '../src/types.js';

function createMockState(overrides?: Partial<AgentState>): AgentState {
  return {
    ensName: 'test.eth',
    owner: '0x1234567890123456789012345678901234567890',
    chainBalances: [],
    totalPortfolioUsd: 10000_000000n,
    activeStrategies: ['yield-optimizer'],
    preferences: {
      maxSlippageBps: 50,
      riskLevel: 'medium',
      preferredChains: [1, 42161, 10, 8453] as ChainId[],
      maxGasPerTx: 500000n,
      rebalanceThresholdPct: 5,
    },
    lastUpdated: new Date(),
    ...overrides,
  };
}

describe('YieldOptimizerStrategy', () => {
  let strategy: YieldOptimizerStrategy;

  beforeEach(() => {
    strategy = new YieldOptimizerStrategy();
  });

  it('should have correct id and name', () => {
    expect(strategy.id).toBe('yield-optimizer');
    expect(strategy.name).toBe('Yield Optimizer');
  });

  it('should start in active status', () => {
    expect(strategy.getStatus()).toBe('active');
  });

  it('should suggest action when better yield exists', async () => {
    const state = createMockState();
    const action = await strategy.evaluate(state);

    expect(action).not.toBeNull();
    expect(action?.strategyId).toBe('yield-optimizer');
    expect(action?.type).toBe('bridge'); // Best yield is on Arbitrum, needs bridge
    expect(action?.estimatedProfit).toBeGreaterThan(0n);
    expect(action?.description).toContain('Uniswap v4');
  });

  it('should not suggest action when paused', async () => {
    strategy.pause();
    const state = createMockState();
    const action = await strategy.evaluate(state);
    expect(action).toBeNull();
    expect(strategy.getStatus()).toBe('paused');
  });

  it('should resume from paused state', () => {
    strategy.pause();
    expect(strategy.getStatus()).toBe('paused');
    strategy.resume();
    expect(strategy.getStatus()).toBe('active');
  });

  it('should not suggest action when no preferred chains match', async () => {
    const state = createMockState({
      preferences: {
        maxSlippageBps: 50,
        riskLevel: 'medium',
        preferredChains: [11155111] as ChainId[], // Sepolia only
        maxGasPerTx: 500000n,
        rebalanceThresholdPct: 5,
      },
    });
    const action = await strategy.evaluate(state);
    expect(action).toBeNull();
  });

  it('should execute action and update metrics', async () => {
    const state = createMockState();
    const action = await strategy.evaluate(state);
    expect(action).not.toBeNull();

    const result = await strategy.execute(action!);
    expect(result.success).toBe(true);
    // txHash is undefined when no adapter is registered (unit test isolation)

    const metrics = strategy.getMetrics();
    expect(metrics.executedTrades).toBe(1);
    expect(metrics.totalPnl).toBeGreaterThan(0n);
  });

  it('should return metrics as a copy', () => {
    const m1 = strategy.getMetrics();
    const m2 = strategy.getMetrics();
    expect(m1).not.toBe(m2);
    expect(m1).toEqual(m2);
  });
});
