import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YellowAdapter } from '../src/protocols/yellow-adapter.js';

// Mock viem/accounts to return a proper account with signMessage
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const,
    signMessage: vi.fn().mockResolvedValue('0xmocksignature'),
  })),
}));

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  private listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(_url: string) {
    queueMicrotask(() => {
      this.emit('open', {});
    });
  }

  addEventListener(event: string, callback: (event: unknown) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(callback);
    this.listeners.set(event, list);
  }

  send(_message: string): void {
    // Mock: acknowledge messages silently
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {});
  }

  private emit(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event) ?? [];
    for (const cb of callbacks) {
      cb(data);
    }
  }
}

// Install mock WebSocket globally
(globalThis as unknown as Record<string, unknown>)['WebSocket'] = MockWebSocket;

describe('YellowAdapter', () => {
  const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const counterparty = '0x1234567890123456789012345678901234567890' as const;

  let adapter: YellowAdapter;

  beforeEach(async () => {
    adapter = new YellowAdapter(TEST_PRIVATE_KEY, 'sandbox');
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.shutdown();
    vi.restoreAllMocks();
  });

  it('should have correct name and chains', () => {
    expect(adapter.name).toBe('yellow');
    expect(adapter.supportedChains).toContain(1);
    expect(adapter.supportedChains).toContain(42161);
  });

  it('should be connected after initialization', () => {
    expect(adapter.isConnected()).toBe(true);
  });

  it('should create a session', async () => {
    const session = await adapter.createSession(counterparty, 1, 1000000000n);
    expect(session.sessionId).toMatch(/^session_/);
    expect(session.participants).toContain(counterparty);
    expect(session.chainId).toBe(1);
    expect(session.status).toBe('active');
  });

  it('should send a payment on an open session', async () => {
    const session = await adapter.createSession(counterparty, 42161, 500000000n);
    const result = await adapter.sendPayment(session.sessionId, 100000000n, counterparty);
    expect(result.success).toBe(true);
    expect(result.chainId).toBe(42161);
    expect(result.gasUsed).toBe(0n); // Off-chain = no gas
  });

  it('should fail payment on non-existent session', async () => {
    const result = await adapter.sendPayment('nonexistent', 100000000n, counterparty);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should close a session', async () => {
    const session = await adapter.createSession(counterparty, 1, 500000000n);
    const result = await adapter.closeSession(session.sessionId);
    expect(result.success).toBe(true);
    expect(result.gasUsed).toBeGreaterThan(0n);

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

  it('should shut down and clear sessions', async () => {
    await adapter.createSession(counterparty, 1, 100n);
    await adapter.createSession(counterparty, 42161, 200n);
    await adapter.shutdown();
    expect(adapter.getOpenSessions().length).toBe(0);
  });

  it('should report health based on connection', async () => {
    const result = await adapter.healthCheck();
    expect(result).toBe(true);
  });

  it('should not initialize without private key', async () => {
    const noKeyAdapter = new YellowAdapter('', 'sandbox');
    await noKeyAdapter.initialize();
    expect(noKeyAdapter.isConnected()).toBe(false);
  });
});
