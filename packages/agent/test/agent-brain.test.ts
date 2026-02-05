import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentBrain } from '../src/agent-brain.js';
import { protocolRegistry } from '../src/protocols/index.js';
import { strategyRegistry } from '../src/strategies/index.js';
import type { IProtocolAdapter, IStrategy, StrategyAction, AgentState, StrategyMetrics, TransactionResult, StrategyStatus, ChainId } from '../src/types.js';

function createMockAdapter(name: string): IProtocolAdapter {
  return {
    name,
    supportedChains: [1, 42161] as readonly ChainId[],
    initialize: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockStrategy(
  id: string,
  action: StrategyAction | null = null,
): IStrategy {
  let status: StrategyStatus = 'active';
  return {
    id,
    name: `Test Strategy ${id}`,
    getStatus: () => status,
    evaluate: vi.fn().mockResolvedValue(action),
    execute: vi.fn().mockResolvedValue({
      success: true,
      txHash: '0xabc123',
      chainId: 1 as ChainId,
      gasUsed: 21000n,
      timestamp: new Date(),
    } satisfies TransactionResult),
    getMetrics: () => ({
      totalPnl: 0n,
      apy: 0.1,
      executedTrades: 0,
      successRate: 1,
      allocatedCapital: 0n,
    } satisfies StrategyMetrics),
  };
}

describe('AgentBrain', () => {
  let brain: AgentBrain;

  beforeEach(() => {
    // Clear registries between tests
    vi.useFakeTimers();
    brain = new AgentBrain({
      ensName: 'test.eth',
      owner: '0x1234567890123456789012345678901234567890',
      tickIntervalMs: 60_000,
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with correct state', () => {
    const state = brain.getState();
    expect(state.ensName).toBe('test.eth');
    expect(state.owner).toBe('0x1234567890123456789012345678901234567890');
    expect(state.chainBalances).toEqual([]);
    expect(state.totalPortfolioUsd).toBe(0n);
    expect(state.preferences.riskLevel).toBe('medium');
  });

  it('should report running status correctly', () => {
    expect(brain.isRunning()).toBe(false);
  });

  it('should return empty logs initially', () => {
    const logs = brain.getLogs();
    expect(logs).toEqual([]);
  });

  it('should return logs with limit', () => {
    const logs = brain.getLogs(10);
    expect(logs.length).toBeLessThanOrEqual(10);
  });

  it('should return a copy of state (not a reference)', () => {
    const state1 = brain.getState();
    const state2 = brain.getState();
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });

  it('should have default preferences', () => {
    const state = brain.getState();
    expect(state.preferences.maxSlippageBps).toBe(50);
    expect(state.preferences.riskLevel).toBe('medium');
    expect(state.preferences.preferredChains).toContain(1);
    expect(state.preferences.preferredChains).toContain(42161);
    expect(state.preferences.maxGasPerTx).toBe(500000n);
    expect(state.preferences.rebalanceThresholdPct).toBe(5);
  });

  it('should accept custom preferences', () => {
    const customBrain = new AgentBrain({
      ensName: 'custom.eth',
      owner: '0x0000000000000000000000000000000000000001',
      preferences: {
        maxSlippageBps: 100,
        riskLevel: 'high',
        preferredChains: [1] as ChainId[],
        maxGasPerTx: 1000000n,
        rebalanceThresholdPct: 10,
      },
    });
    const state = customBrain.getState();
    expect(state.preferences.maxSlippageBps).toBe(100);
    expect(state.preferences.riskLevel).toBe('high');
  });
});
