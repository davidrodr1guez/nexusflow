import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArcAdapter } from '../src/protocols/arc-adapter.js';

describe('ArcAdapter', () => {
  let adapter: ArcAdapter;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    adapter = new ArcAdapter('test-api-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should have correct name and chains', () => {
    expect(adapter.name).toBe('arc-circle');
    expect(adapter.supportedChains).toContain(1);
    expect(adapter.supportedChains).toContain(42161);
    expect(adapter.supportedChains).toContain(10);
    expect(adapter.supportedChains).toContain(8453);
  });

  it('should create a wallet', async () => {
    const wallet = await adapter.createWallet(1);
    expect(wallet.walletId).toMatch(/^cw_/);
    expect(wallet.address).toMatch(/^0x/);
    expect(wallet.chainId).toBe(1);
    expect(wallet.createdAt).toBeInstanceOf(Date);
  });

  it('should get USDC balance', async () => {
    const wallet = await adapter.createWallet(42161);
    const balance = await adapter.getUsdcBalance(wallet.walletId);
    expect(balance.walletId).toBe(wallet.walletId);
    expect(balance.chainId).toBe(42161);
    expect(balance.balance).toBeGreaterThan(0n);
  });

  it('should throw on balance for non-existent wallet', async () => {
    await expect(adapter.getUsdcBalance('cw_fake')).rejects.toThrow('not found');
  });

  it('should transfer USDC cross-chain', async () => {
    const wallet = await adapter.createWallet(1);
    const transfer = await adapter.transferCrossChain(wallet.walletId, 42161, 1000_000000n);
    expect(transfer.transferId).toMatch(/^ct_/);
    expect(transfer.fromChain).toBe(1);
    expect(transfer.toChain).toBe(42161);
    expect(transfer.amount).toBe(1000_000000n);
    expect(transfer.status).toBe('completed');
    expect(transfer.burnTxHash).toBeDefined();
    expect(transfer.mintTxHash).toBeDefined();
  });

  it('should throw when transferring to same chain', async () => {
    const wallet = await adapter.createWallet(1);
    await expect(
      adapter.transferCrossChain(wallet.walletId, 1, 100_000000n),
    ).rejects.toThrow('different');
  });

  it('should throw on transfer from non-existent wallet', async () => {
    await expect(
      adapter.transferCrossChain('cw_fake', 42161, 100_000000n),
    ).rejects.toThrow('not found');
  });

  it('should get transfer status', async () => {
    const wallet = await adapter.createWallet(10);
    const transfer = await adapter.transferCrossChain(wallet.walletId, 8453, 500_000000n);
    const status = await adapter.getTransferStatus(transfer.transferId);
    expect(status).toBe('completed');
  });

  it('should throw on status for non-existent transfer', async () => {
    await expect(adapter.getTransferStatus('ct_fake')).rejects.toThrow('not found');
  });

  it('should handle healthCheck when API is up', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.healthCheck();
    expect(result).toBe(true);
  });

  it('should handle healthCheck when API is down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const result = await adapter.healthCheck();
    expect(result).toBe(false);
  });

  it('should clean up on shutdown', async () => {
    await adapter.createWallet(1);
    await adapter.shutdown();
    expect(adapter.getWallet('any')).toBeUndefined();
  });
});
