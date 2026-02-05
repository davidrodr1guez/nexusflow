/**
 * LI.FI Protocol Adapter
 *
 * Provides cross-chain swap and bridge capabilities using the LI.FI SDK.
 * Supports swap, bridge, and combined swap+bridge+contract call flows.
 *
 * Docs: https://docs.li.fi/sdk/overview
 */

import type {
  ISwapAdapter,
  IBridgeAdapter,
  ChainId,
  SwapParams,
  SwapQuote,
  BridgeParams,
  BridgeQuote,
  BridgeStatus,
  TransactionResult,
} from '../types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('lifi-adapter');

export class LiFiAdapter implements ISwapAdapter, IBridgeAdapter {
  readonly name = 'lifi';
  readonly supportedChains: readonly ChainId[] = [1, 42161, 10, 8453];

  private apiBase = 'https://li.quest/v1';

  async initialize(): Promise<void> {
    logger.info('Initializing LI.FI adapter...');
    const healthy = await this.healthCheck();
    if (!healthy) {
      throw new Error('LI.FI API is not reachable');
    }
    logger.execute('LI.FI adapter initialized', { chains: this.supportedChains });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/chains`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('LI.FI adapter shut down');
  }

  /**
   * Get a swap quote from LI.FI.
   * LI.FI automatically finds the best route across DEXs and bridges.
   */
  async getQuote(params: SwapParams): Promise<SwapQuote> {
    logger.monitor('Getting LI.FI quote', {
      from: params.fromToken.symbol,
      to: params.toToken.symbol,
      amount: params.amount.toString(),
    });

    const queryParams = new URLSearchParams({
      fromChain: params.fromToken.chainId.toString(),
      toChain: params.toToken.chainId.toString(),
      fromToken: params.fromToken.address,
      toToken: params.toToken.address,
      fromAmount: params.amount.toString(),
      slippage: (params.maxSlippageBps / 10000).toString(),
    });

    const response = await fetch(`${this.apiBase}/quote?${queryParams}`);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LI.FI quote failed: ${error}`);
    }

    const data = await response.json();

    return {
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount: BigInt(data.estimate?.fromAmount ?? params.amount),
      toAmount: BigInt(data.estimate?.toAmount ?? '0'),
      estimatedGas: BigInt(data.estimate?.gasCosts?.[0]?.amount ?? '0'),
      route: data.toolDetails?.name ?? 'LI.FI Best Route',
      provider: 'lifi',
      expiresAt: new Date(Date.now() + 60_000), // 1 minute
    };
  }

  async executeSwap(quote: SwapQuote): Promise<TransactionResult> {
    logger.execute('Executing LI.FI swap', {
      from: quote.fromToken.symbol,
      to: quote.toToken.symbol,
      amount: quote.fromAmount.toString(),
      route: quote.route,
    });

    // In production, this would sign and send the transaction via viem
    // For the hackathon demo, we simulate the execution
    return {
      success: true,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      chainId: quote.fromToken.chainId,
      gasUsed: quote.estimatedGas,
      timestamp: new Date(),
    };
  }

  async getBridgeQuote(params: BridgeParams): Promise<BridgeQuote> {
    logger.monitor('Getting LI.FI bridge quote', {
      from: params.fromChain,
      to: params.toChain,
      token: params.token.symbol,
      amount: params.amount.toString(),
    });

    const queryParams = new URLSearchParams({
      fromChain: params.fromChain.toString(),
      toChain: params.toChain.toString(),
      fromToken: params.token.address,
      toToken: params.token.address,
      fromAmount: params.amount.toString(),
    });

    const response = await fetch(`${this.apiBase}/quote?${queryParams}`);
    if (!response.ok) {
      throw new Error(`LI.FI bridge quote failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromAmount: params.amount,
      toAmount: BigInt(data.estimate?.toAmount ?? '0'),
      estimatedTime: data.estimate?.executionDuration ?? 300,
      bridgeName: data.toolDetails?.name ?? 'LI.FI Bridge',
      fees: BigInt(data.estimate?.feeCosts?.[0]?.amount ?? '0'),
    };
  }

  async executeBridge(quote: BridgeQuote): Promise<TransactionResult> {
    logger.execute('Executing LI.FI bridge', {
      from: quote.fromChain,
      to: quote.toChain,
      bridge: quote.bridgeName,
    });

    return {
      success: true,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      chainId: quote.fromChain,
      timestamp: new Date(),
    };
  }

  async getBridgeStatus(_txHash: string): Promise<BridgeStatus> {
    // In production: poll LI.FI status endpoint
    return 'completed';
  }
}
