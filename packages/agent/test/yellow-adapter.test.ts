import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YellowAdapter } from '../src/protocols/yellow-adapter.js';

// Mock viem/accounts to avoid needing a real private key
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  })),
}));

// Mock the nitrolite SDK functions
vi.mock('@erc7824/nitrolite', () => {
  let reqCounter = 0;
  return {
    createECDSAMessageSigner: vi.fn(() => vi.fn().mockResolvedValue('0xmocksig')),
    createAuthRequestMessage: vi.fn(async () => {
      reqCounter++;
      return JSON.stringify({ req: [reqCounter, 'auth_request', {}, Date.now()] });
    }),
    createAuthVerifyMessage: vi.fn(async () => {
      reqCounter++;
      return JSON.stringify({ req: [reqCounter, 'auth_verify', {}, Date.now()] });
    }),
    createAppSessionMessage: vi.fn(async () => {
      reqCounter++;
      return JSON.stringify({ req: [reqCounter, 'create_app_session', {}, Date.now()] });
    }),
    createCloseAppSessionMessage: vi.fn(async () => {
      reqCounter++;
      return JSON.stringify({ req: [reqCounter, 'close_app_session', {}, Date.now()] });
    }),
    createPingMessage: vi.fn(async () => {
      reqCounter++;
      return JSON.stringify({ req: [reqCounter, 'ping', {}, Date.now()] });
    }),
    createTransferMessage: vi.fn(async () => {
      reqCounter++;
      return JSON.stringify({ req: [reqCounter, 'transfer', {}, Date.now()] });
    }),
    parseAnyRPCResponse: vi.fn((raw: string) => {
      const data = JSON.parse(raw);
      if (data.res) {
        const method = data.res[1] as string;
        const params = data.res[2] as Record<string, unknown>;
        if (method === 'error') return { method: 'error', params: { error: params?.['error'] ?? 'Unknown error' } };
        if (method === 'auth_challenge') return { method: 'auth_challenge', params: { challengeMessage: 'sign-me' } };
        if (method === 'auth_verify') return { method: 'auth_verify', params: { success: true } };
        if (method === 'create_app_session') return { method: 'create_app_session', params: { appSessionId: params?.['appSessionId'] ?? '0xabc123' } };
        if (method === 'close_app_session') return { method: 'close_app_session', params: { appSessionId: '0xabc123', status: 'closed' } };
        if (method === 'transfer') return { method: 'transfer', params: { transactions: [] } };
        if (method === 'pong') return { method: 'pong', params: {} };
      }
      return { method: 'error', params: { error: 'Unknown' } };
    }),
    RPCMethod: {
      Error: 'error',
      AuthChallenge: 'auth_challenge',
      AuthVerify: 'auth_verify',
      CreateAppSession: 'create_app_session',
      CloseAppSession: 'close_app_session',
      Transfer: 'transfer',
      Ping: 'ping',
      Pong: 'pong',
    },
    RPCProtocolVersion: {
      NitroRPC_0_2: 'NitroRPC/0.2',
    },
  };
});

// Mock WebSocket — delivers responses via microtask to keep async behavior predictable
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  private listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(_url: string) {
    // Fire open on next microtask so listeners can be attached first
    queueMicrotask(() => {
      this.emit('open', {});
    });
  }

  addEventListener(event: string, callback: (event: unknown) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(callback);
    this.listeners.set(event, list);
  }

  send(message: string): void {
    const parsed = JSON.parse(message) as { req?: [number, string, unknown, number?] };
    const reqId = parsed.req?.[0] ?? 0;
    const method = parsed.req?.[1] ?? '';

    let responseMethod = method;
    let responseParams: Record<string, unknown> = {};

    if (method === 'auth_request') {
      responseMethod = 'auth_challenge';
      responseParams = { challengeMessage: 'sign-this-challenge' };
    } else if (method === 'auth_verify') {
      responseMethod = 'auth_verify';
      responseParams = { success: true, address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' };
    } else if (method === 'create_app_session') {
      responseMethod = 'create_app_session';
      responseParams = { appSessionId: `0x${reqId.toString(16).padStart(64, '0')}` };
    } else if (method === 'close_app_session') {
      responseMethod = 'close_app_session';
      responseParams = { appSessionId: '0x', status: 'closed' };
    } else if (method === 'transfer') {
      responseMethod = 'transfer';
      responseParams = { transactions: [] };
    } else if (method === 'ping') {
      responseMethod = 'pong';
      responseParams = {};
    }

    const responseData = JSON.stringify({
      res: [reqId, responseMethod, responseParams, Date.now()],
    });

    // Use queueMicrotask so the response is delivered after send returns
    // but before any macrotask — making await work predictably in tests
    queueMicrotask(() => {
      this.emit('message', { data: responseData });
    });
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
  const token = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;

  let adapter: YellowAdapter;

  beforeEach(async () => {
    adapter = new YellowAdapter(TEST_PRIVATE_KEY, 'wss://mock.test/ws');
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
    expect(session.appSessionId).toMatch(/^0x/);
    expect(session.counterparty).toBe(counterparty);
    expect(session.chainId).toBe(1);
    expect(session.status).toBe('open');
  });

  it('should send a payment on an open session', async () => {
    const session = await adapter.createSession(counterparty, 42161, 500000000n);
    const result = await adapter.sendPayment(session.appSessionId, 100000000n, token);
    expect(result.success).toBe(true);
    expect(result.chainId).toBe(42161);
    expect(result.gasUsed).toBe(0n);
  });

  it('should fail payment on non-existent session', async () => {
    const result = await adapter.sendPayment('0xnonexistent', 100000000n, token);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should fail payment on closed session', async () => {
    const session = await adapter.createSession(counterparty, 1, 500000000n);
    await adapter.closeSession(session.appSessionId);
    const result = await adapter.sendPayment(session.appSessionId, 100000000n, token);
    expect(result.success).toBe(false);
    expect(result.error).toContain('closed');
  });

  it('should get session balance', async () => {
    const session = await adapter.createSession(counterparty, 1, 1000000000n);
    const balance = await adapter.getSessionBalance(session.appSessionId, token);
    expect(balance.sessionId).toBe(session.appSessionId);
    expect(balance.token).toBe(token);
  });

  it('should throw on balance of non-existent session', async () => {
    await expect(adapter.getSessionBalance('0xfake', token)).rejects.toThrow('not found');
  });

  it('should close a session', async () => {
    const session = await adapter.createSession(counterparty, 1, 500000000n);
    const result = await adapter.closeSession(session.appSessionId);
    expect(result.success).toBe(true);
    expect(result.gasUsed).toBeGreaterThan(0n);

    const updated = adapter.getSession(session.appSessionId);
    expect(updated?.status).toBe('closed');
  });

  it('should track open sessions', async () => {
    await adapter.createSession(counterparty, 1, 100n);
    await adapter.createSession(counterparty, 42161, 200n);
    expect(adapter.getOpenSessions().length).toBe(2);

    const sessions = adapter.getOpenSessions();
    await adapter.closeSession(sessions[0]!.appSessionId);
    expect(adapter.getOpenSessions().length).toBe(1);
  });

  it('should shut down and close open sessions', async () => {
    await adapter.createSession(counterparty, 1, 100n);
    await adapter.createSession(counterparty, 42161, 200n);
    await adapter.shutdown();
    expect(adapter.getOpenSessions().length).toBe(0);
  });

  it('should handle healthCheck via ping', async () => {
    const result = await adapter.healthCheck();
    expect(result).toBe(true);
  });

  it('should not initialize without private key', async () => {
    const noKeyAdapter = new YellowAdapter('', 'wss://mock.test/ws');
    await noKeyAdapter.initialize();
    expect(noKeyAdapter.isConnected()).toBe(false);
  });
});
