import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock viem to control the public client
const mockGetBlockNumber = vi.fn().mockResolvedValue(12345n);
const mockGetEnsAddress = vi.fn();
const mockGetEnsText = vi.fn();

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...(actual as object),
    createPublicClient: vi.fn(() => ({
      getBlockNumber: mockGetBlockNumber,
      getEnsAddress: mockGetEnsAddress,
      getEnsText: mockGetEnsText,
    })),
  };
});

vi.mock('viem/ens', () => ({
  normalize: vi.fn((name: string) => name),
}));

import { ENSAdapter } from '../src/protocols/ens-adapter.js';

describe('ENSAdapter', () => {
  let adapter: ENSAdapter;

  beforeEach(() => {
    adapter = new ENSAdapter('https://mock-rpc.test');
    vi.clearAllMocks();

    // Default mock implementations for text records
    mockGetEnsText.mockImplementation(async ({ key }: { name: string; key: string }) => {
      const records: Record<string, string> = {
        'nexusflow:swap-pref': 'uniswap',
        'nexusflow:risk': 'medium',
        'nexusflow:chains': '1,42161,10,8453',
      };
      return records[key] ?? null;
    });

    mockGetEnsAddress.mockImplementation(async ({ name }: { name: string }) => {
      if (name === 'vitalik.eth') return '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct name and chains', () => {
    expect(adapter.name).toBe('ens');
    expect(adapter.supportedChains).toEqual([1]);
  });

  it('should initialize without errors', async () => {
    await expect(adapter.initialize()).resolves.toBeUndefined();
  });

  it('should read swap-pref text record from chain via viem', async () => {
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:swap-pref');
    expect(value).toBe('uniswap');
    expect(mockGetEnsText).toHaveBeenCalledWith({
      name: 'nexusflow.eth',
      key: 'nexusflow:swap-pref',
    });
  });

  it('should read risk text record from chain via viem', async () => {
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(value).toBe('medium');
  });

  it('should read chains text record from chain via viem', async () => {
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:chains');
    expect(value).toBe('1,42161,10,8453');
  });

  it('should return null for unknown text record key', async () => {
    const value = await adapter.getTextRecord('nexusflow.eth', 'unknown:key');
    expect(value).toBeNull();
  });

  it('should parse agent preferences from on-chain text records', async () => {
    const prefs = await adapter.getAgentPreferences('nexusflow.eth');
    expect(prefs.riskLevel).toBe('medium');
    expect(prefs.preferredChains).toEqual([1, 42161, 10, 8453]);
  });

  it('should set a text record and cache it', async () => {
    const result = await adapter.setTextRecord('nexusflow.eth', 'nexusflow:risk', 'high');
    expect(result.success).toBe(true);

    // Should now read from cache (not call viem again)
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(value).toBe('high');
  });

  it('should cache text records on second read', async () => {
    await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    const value2 = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(value2).toBe('medium');
    // getEnsText should be called only once due to caching
    expect(mockGetEnsText).toHaveBeenCalledTimes(1);
  });

  it('should clear cache on shutdown', async () => {
    await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    await adapter.shutdown();
    // After shutdown, cache is cleared — next call will re-fetch
    await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(mockGetEnsText).toHaveBeenCalledTimes(2);
  });

  it('should handle healthCheck when RPC is down', async () => {
    mockGetBlockNumber.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await adapter.healthCheck();
    expect(result).toBe(false);
  });

  it('should handle healthCheck when RPC is up', async () => {
    const result = await adapter.healthCheck();
    expect(result).toBe(true);
  });

  it('should resolve ENS name via viem getEnsAddress', async () => {
    const address = await adapter.resolveName('vitalik.eth');
    expect(address).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(mockGetEnsAddress).toHaveBeenCalledWith({ name: 'vitalik.eth' });
  });

  it('should return null for unregistered ENS name', async () => {
    const address = await adapter.resolveName('nonexistent-name-xyz.eth');
    expect(address).toBeNull();
  });

  it('should handle getTextRecord errors gracefully', async () => {
    mockGetEnsText.mockRejectedValueOnce(new Error('RPC error'));
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(value).toBeNull();
  });
});
