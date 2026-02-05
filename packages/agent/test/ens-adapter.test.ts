import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ENSAdapter } from '../src/protocols/ens-adapter.js';

describe('ENSAdapter', () => {
  let adapter: ENSAdapter;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    adapter = new ENSAdapter('https://mock-rpc.test');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should have correct name and chains', () => {
    expect(adapter.name).toBe('ens');
    expect(adapter.supportedChains).toEqual([1]);
  });

  it('should initialize without errors', async () => {
    await expect(adapter.initialize()).resolves.toBeUndefined();
  });

  it('should return default swap-pref text record', async () => {
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:swap-pref');
    expect(value).toBe('uniswap');
  });

  it('should return default risk text record', async () => {
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(value).toBe('medium');
  });

  it('should return default chains text record', async () => {
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:chains');
    expect(value).toBe('1,42161,10,8453');
  });

  it('should return null for unknown text record key', async () => {
    const value = await adapter.getTextRecord('nexusflow.eth', 'unknown:key');
    expect(value).toBeNull();
  });

  it('should parse agent preferences from text records', async () => {
    const prefs = await adapter.getAgentPreferences('nexusflow.eth');
    expect(prefs.riskLevel).toBe('medium');
    expect(prefs.preferredChains).toEqual([1, 42161, 10, 8453]);
  });

  it('should set a text record and cache it', async () => {
    const result = await adapter.setTextRecord('nexusflow.eth', 'nexusflow:risk', 'high');
    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();

    // Should now read the new value from cache
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(value).toBe('high');
  });

  it('should cache text records on second read', async () => {
    await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    const value2 = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(value2).toBe('medium');
  });

  it('should clear cache on shutdown', async () => {
    await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    await adapter.shutdown();
    // After shutdown caches are cleared — but defaults still work
    const value = await adapter.getTextRecord('nexusflow.eth', 'nexusflow:risk');
    expect(value).toBe('medium');
  });

  it('should handle healthCheck when RPC is down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const result = await adapter.healthCheck();
    expect(result).toBe(false);
  });

  it('should handle healthCheck when RPC is up', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.healthCheck();
    expect(result).toBe(true);
  });

  it('should resolve ENS name (returns null without real RPC)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: '0x' }),
    });
    const address = await adapter.resolveName('nexusflow.eth');
    expect(address).toBeNull();
  });

  it('should resolve ENS name when address is returned', async () => {
    const mockAddress = '0000000000000000000000001234567890abcdef1234567890abcdef12345678';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: `0x${mockAddress}` }),
    });
    const address = await adapter.resolveName('vitalik.eth');
    expect(address).toMatch(/^0x/);
  });
});
