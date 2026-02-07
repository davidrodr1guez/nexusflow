import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArcAdapter } from '../src/protocols/arc-adapter.js';

// Mock viem/accounts
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const,
  })),
}));

// Mock viem clients
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn().mockResolvedValue(1000000000n), // 1000 USDC
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
    })),
    createWalletClient: vi.fn(() => ({
      sendTransaction: vi.fn().mockResolvedValue('0xmocktxhash'),
    })),
  };
});

describe('ArcAdapter', () => {
  const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  let adapter: ArcAdapter;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    // Mock fetch for attestation API - return 404 for health check, which is expected
    globalThis.fetch = vi.fn().mockResolvedValue({ 
      status: 404, 
      ok: false,
      json: vi.fn().mockResolvedValue({ messages: [] }),
    });
    
    adapter = new ArcAdapter(TEST_PRIVATE_KEY);
    await adapter.initialize();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await adapter.shutdown();
    vi.restoreAllMocks();
  });

  it('should have correct name and supported testnet chains', () => {
    expect(adapter.name).toBe('arc-circle');
    // Now supports testnet chains
    expect(adapter.supportedChains).toContain(11155111); // Sepolia
    expect(adapter.supportedChains).toContain(421614);   // Arb Sepolia
    expect(adapter.supportedChains).toContain(84532);    // Base Sepolia
    expect(adapter.supportedChains).toContain(11155420); // OP Sepolia
  });

  it('should get USDC balance for a chain', async () => {
    const balance = await adapter.getUsdcBalance(11155111);
    expect(balance).toBe(1000000000n); // Mocked value
  });

  it('should return 0 balance for unsupported chain', async () => {
    const balance = await adapter.getUsdcBalance(999);
    expect(balance).toBe(0n);
  });

  it('should handle healthCheck when attestation API returns 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false });
    const result = await adapter.healthCheck();
    expect(result).toBe(true); // 404 means API is reachable
  });

  it('should handle healthCheck when API is down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const result = await adapter.healthCheck();
    expect(result).toBe(false);
  });

  it('should throw on transfer for unsupported chain pair', async () => {
    await expect(
      adapter.transferCrossChain(999, 11155111, 100_000000n),
    ).rejects.toThrow('not supported');
  });

  it('should get undefined for non-existent transfer', () => {
    const transfer = adapter.getTransfer('nonexistent');
    expect(transfer).toBeUndefined();
  });

  it('should clean up on shutdown', async () => {
    await adapter.shutdown();
    expect(adapter.getTransfer('any')).toBeUndefined();
  });

  it('should not initialize without private key', async () => {
    const noKeyAdapter = new ArcAdapter('');
    await noKeyAdapter.initialize();
    // Should still work but account will be null
    const balance = await noKeyAdapter.getUsdcBalance(11155111);
    expect(balance).toBe(0n);
  });
});
