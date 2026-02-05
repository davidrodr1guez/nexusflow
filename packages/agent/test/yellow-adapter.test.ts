import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YellowAdapter } from '../src/protocols/yellow-adapter.js';

describe('YellowAdapter', () => {
  let adapter: YellowAdapter;
  const originalFetch = globalThis.fetch;
  const counterparty = '0x1234567890123456789012345678901234567890' as const;
  const token = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;

  beforeEach(() => {
    adapter = new YellowAdapter('test-api-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should have correct name and chains', () => {
    expect(adapter.name).toBe('yellow');
    expect(adapter.supportedChains).toContain(1);
    expect(adapter.supportedChains).toContain(42161);
  });

  it('should create a session', async () => {
    const session = await adapter.createSession(counterparty, 1, 1000000000n);
    expect(session.sessionId).toMatch(/^ys_/);
    expect(session.counterparty).toBe(counterparty);
    expect(session.chainId).toBe(1);
    expect(session.status).toBe('open');
    expect(session.channelAddress).toMatch(/^0x/);
  });

  it('should send a payment on an open session', async () => {
    const session = await adapter.createSession(counterparty, 42161, 500000000n);
    const result = await adapter.sendPayment(session.sessionId, 100000000n, token);
    expect(result.success).toBe(true);
    expect(result.chainId).toBe(42161);
    expect(result.gasUsed).toBe(0n); // off-chain = no gas
    expect(result.txHash).toBeDefined();
  });

  it('should fail payment on non-existent session', async () => {
    const result = await adapter.sendPayment('ys_nonexistent', 100000000n, token);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should fail payment on closed session', async () => {
    const session = await adapter.createSession(counterparty, 1, 500000000n);
    await adapter.closeSession(session.sessionId);
    const result = await adapter.sendPayment(session.sessionId, 100000000n, token);
    expect(result.success).toBe(false);
    expect(result.error).toContain('closed');
  });

  it('should get session balance', async () => {
    const session = await adapter.createSession(counterparty, 1, 1000000000n);
    const balance = await adapter.getSessionBalance(session.sessionId, token);
    expect(balance.sessionId).toBe(session.sessionId);
    expect(balance.myBalance).toBeGreaterThan(0n);
    expect(balance.token).toBe(token);
  });

  it('should throw on balance of non-existent session', async () => {
    await expect(adapter.getSessionBalance('ys_fake', token)).rejects.toThrow('not found');
  });

  it('should close a session', async () => {
    const session = await adapter.createSession(counterparty, 1, 500000000n);
    const result = await adapter.closeSession(session.sessionId);
    expect(result.success).toBe(true);
    expect(result.gasUsed).toBeGreaterThan(0n); // on-chain settlement costs gas

    const updated = adapter.getSession(session.sessionId);
    expect(updated?.status).toBe('closed');
  });

  it('should track open sessions', async () => {
    await adapter.createSession(counterparty, 1, 100n);
    await adapter.createSession(counterparty, 42161, 200n);
    expect(adapter.getOpenSessions().length).toBe(2);

    const sessions = adapter.getOpenSessions();
    await adapter.closeSession(sessions[0]!.sessionId);
    expect(adapter.getOpenSessions().length).toBe(1);
  });

  it('should handle healthCheck when API is down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const result = await adapter.healthCheck();
    expect(result).toBe(false);
  });

  it('should shut down and close open sessions', async () => {
    await adapter.createSession(counterparty, 1, 100n);
    await adapter.createSession(counterparty, 42161, 200n);
    await adapter.shutdown();
    expect(adapter.getOpenSessions().length).toBe(0);
  });
});
