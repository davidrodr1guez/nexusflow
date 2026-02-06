import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiFiAdapter } from '../src/protocols/lifi-adapter.js';
import type { SwapParams, BridgeParams, TokenInfo } from '../src/types.js';

const MOCK_ETH: TokenInfo = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  symbol: 'WETH',
  decimals: 18,
  chainId: 1,
};

const MOCK_USDC: TokenInfo = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  decimals: 6,
  chainId: 1,
};

const MOCK_ARB_USDC: TokenInfo = {
  address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  symbol: 'USDC',
  decimals: 6,
  chainId: 42161,
};

describe('LiFiAdapter', () => {
  let adapter: LiFiAdapter;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    adapter = new LiFiAdapter();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should have correct name and supported chains', () => {
    expect(adapter.name).toBe('lifi');
    expect(adapter.supportedChains).toContain(1);
    expect(adapter.supportedChains).toContain(42161);
    expect(adapter.supportedChains).toContain(8453);
  });

  it('should return true on healthCheck when API is reachable', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.healthCheck();
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/chains'));
  });

  it('should return false on healthCheck when API is down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await adapter.healthCheck();
    expect(result).toBe(false);
  });

  it('should get a swap quote', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        estimate: {
          fromAmount: '1000000000000000000',
          toAmount: '2500000000',
          gasCosts: [{ amount: '50000' }],
        },
        toolDetails: { name: 'Uniswap V3' },
      }),
    });

    const params: SwapParams = {
      fromToken: MOCK_ETH,
      toToken: MOCK_USDC,
      amount: 1000000000000000000n,
      maxSlippageBps: 50,
    };

    const quote = await adapter.getQuote(params);
    expect(quote.fromAmount).toBe(1000000000000000000n);
    expect(quote.toAmount).toBe(2500000000n);
    expect(quote.provider).toBe('lifi');
    expect(quote.route).toBe('Uniswap V3');
  });

  it('should throw on failed swap quote', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Bad Request',
    });

    const params: SwapParams = {
      fromToken: MOCK_ETH,
      toToken: MOCK_USDC,
      amount: 1000000000000000000n,
      maxSlippageBps: 50,
    };

    await expect(adapter.getQuote(params)).rejects.toThrow('LI.FI quote failed');
  });

  it('should execute a swap by fetching transactionRequest from LI.FI', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        transactionRequest: {
          to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
          data: '0xabcdef',
          value: '0',
          gasLimit: '250000',
        },
      }),
    });

    const quote = {
      fromToken: MOCK_ETH,
      toToken: MOCK_USDC,
      fromAmount: 1000000000000000000n,
      toAmount: 2500000000n,
      estimatedGas: 50000n,
      route: 'Uniswap V3',
      provider: 'lifi',
      expiresAt: new Date(),
    };

    const result = await adapter.executeSwap(quote);
    expect(result.success).toBe(true);
    expect(result.chainId).toBe(1);
    expect(result.gasUsed).toBe(250000n);
  });

  it('should return error when LI.FI returns no transactionRequest', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const quote = {
      fromToken: MOCK_ETH,
      toToken: MOCK_USDC,
      fromAmount: 1000000000000000000n,
      toAmount: 2500000000n,
      estimatedGas: 50000n,
      route: 'Uniswap V3',
      provider: 'lifi',
      expiresAt: new Date(),
    };

    const result = await adapter.executeSwap(quote);
    expect(result.success).toBe(false);
    expect(result.error).toContain('transactionRequest');
  });

  it('should get a bridge quote', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        estimate: {
          toAmount: '999500000',
          executionDuration: 120,
          feeCosts: [{ amount: '500000' }],
        },
        toolDetails: { name: 'Stargate' },
      }),
    });

    const params: BridgeParams = {
      fromChain: 1,
      toChain: 42161,
      token: MOCK_USDC,
      amount: 1000000000n,
    };

    const quote = await adapter.getBridgeQuote(params);
    expect(quote.toAmount).toBe(999500000n);
    expect(quote.estimatedTime).toBe(120);
    expect(quote.bridgeName).toBe('Stargate');
    expect(quote.fees).toBe(500000n);
  });

  it('should return completed bridge status when API says DONE', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'DONE' }),
    });
    const status = await adapter.getBridgeStatus('0x123');
    expect(status).toBe('completed');
  });

  it('should return pending bridge status when API is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const status = await adapter.getBridgeStatus('0x123');
    expect(status).toBe('pending');
  });

  it('should shut down cleanly', async () => {
    await expect(adapter.shutdown()).resolves.toBeUndefined();
  });
});
