import { describe, it, expect, beforeEach } from 'vitest';
import { RebalancerStrategy } from '../src/strategies/rebalancer.js';
import type { AgentState, ChainId, ChainBalance } from '../src/types.js';

function createMockState(overrides?: Partial<AgentState>): AgentState {
  return {
    ensName: 'test.eth',
    owner: '0x1234567890123456789012345678901234567890',
    chainBalances: [],
    totalPortfolioUsd: 12847_000000n,
    activeStrategies: ['cross-chain-rebalancer'],
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

function createBalancedState(): AgentState {
  const total = 10000_000000n;
  const chainBalances: ChainBalance[] = [
    { chainId: 1, chainName: 'Ethereum', balances: [], totalUsdValue: 3000_000000n },
    { chainId: 42161, chainName: 'Arbitrum', balances: [], totalUsdValue: 3500_000000n },
    { chainId: 10, chainName: 'Optimism', balances: [], totalUsdValue: 1500_000000n },
    { chainId: 8453, chainName: 'Base', balances: [], totalUsdValue: 2000_000000n },
  ];

  return createMockState({ chainBalances, totalPortfolioUsd: total });
}

function createImbalancedState(): AgentState {
  const total = 10000_000000n;
  const chainBalances: ChainBalance[] = [
    { chainId: 1, chainName: 'Ethereum', balances: [], totalUsdValue: 6000_000000n }, // 60% (target: 30%)
    { chainId: 42161, chainName: 'Arbitrum', balances: [], totalUsdValue: 2000_000000n }, // 20% (target: 35%)
    { chainId: 10, chainName: 'Optimism', balances: [], totalUsdValue: 1000_000000n }, // 10% (target: 15%)
    { chainId: 8453, chainName: 'Base', balances: [], totalUsdValue: 1000_000000n }, // 10% (target: 20%)
  ];

  return createMockState({ chainBalances, totalPortfolioUsd: total });
}

describe('RebalancerStrategy', () => {
  let strategy: RebalancerStrategy;

  beforeEach(() => {
    strategy = new RebalancerStrategy();
  });

  it('should have correct id and name', () => {
    expect(strategy.id).toBe('cross-chain-rebalancer');
    expect(strategy.name).toBe('Cross-Chain Rebalancer');
  });

  it('should start in active status', () => {
    expect(strategy.getStatus()).toBe('active');
  });

  it('should not rebalance when portfolio is balanced', async () => {
    const state = createBalancedState();
    const action = await strategy.evaluate(state);
    expect(action).toBeNull();
  });

  it('should suggest rebalance when portfolio is imbalanced', async () => {
    const state = createImbalancedState();
    const action = await strategy.evaluate(state);

    expect(action).not.toBeNull();
    expect(action?.type).toBe('rebalance');
    expect(action?.strategyId).toBe('cross-chain-rebalancer');
    expect(action?.description).toContain('Rebalance');
    expect(action?.description).toContain('USDC');
  });

  it('should not rebalance when paused', async () => {
    strategy.pause();
    const state = createImbalancedState();
    const action = await strategy.evaluate(state);
    expect(action).toBeNull();
  });

  it('should execute rebalance action', async () => {
    const state = createImbalancedState();
    const action = await strategy.evaluate(state);
    expect(action).not.toBeNull();

    const result = await strategy.execute(action!);
    expect(result.success).toBe(true);
    // txHash is undefined when no adapter is registered (unit test isolation)
  });

  it('should update metrics after execution', async () => {
    const state = createImbalancedState();
    const action = await strategy.evaluate(state);
    expect(action).not.toBeNull();

    await strategy.execute(action!);
    const metrics = strategy.getMetrics();
    expect(metrics.executedTrades).toBe(1);
  });

  it('should accept custom target allocation', () => {
    const custom = new RebalancerStrategy({ 1: 50, 42161: 50 });
    expect(custom.getStatus()).toBe('active');
  });

  it('should allow updating target allocation', () => {
    strategy.setTargetAllocation({ 1: 50, 42161: 50 });
    expect(strategy.getStatus()).toBe('active'); // No error
  });

  it('should pause and resume', () => {
    strategy.pause();
    expect(strategy.getStatus()).toBe('paused');
    strategy.resume();
    expect(strategy.getStatus()).toBe('active');
  });

  it('should return metrics as a copy', () => {
    const m1 = strategy.getMetrics();
    const m2 = strategy.getMetrics();
    expect(m1).not.toBe(m2);
    expect(m1).toEqual(m2);
  });

  it('should return null when portfolio has no balances to rebalance from', async () => {
    const state = createMockState({ totalPortfolioUsd: 0n, chainBalances: [] });
    // With empty chain balances, there's no overweight chain to move funds from
    const action = await strategy.evaluate(state);
    expect(action).toBeNull();
  });
});
