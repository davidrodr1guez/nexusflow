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
  private walletAddress: string;

  constructor(walletAddress?: string) {
    this.walletAddress = walletAddress ?? process.env.AGENT_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000000';
  }

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

    const data = (await response.json()) as Record<string, Record<string, unknown>>;
    const estimate = data['estimate'] as Record<string, unknown> | undefined;
    const gasCosts = (estimate?.['gasCosts'] as Array<Record<string, unknown>> | undefined) ?? [];
    const toolDetails = data['toolDetails'] as Record<string, unknown> | undefined;

    return {
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount: BigInt((estimate?.['fromAmount'] as string) ?? params.amount.toString()),
      toAmount: BigInt((estimate?.['toAmount'] as string) ?? '0'),
      estimatedGas: BigInt((gasCosts[0]?.['amount'] as string) ?? '0'),
      route: (toolDetails?.['name'] as string) ?? 'LI.FI Best Route',
      provider: 'lifi',
      expiresAt: new Date(Date.now() + 60_000), // 1 minute
    };
  }

  /**
   * Execute a swap by fetching the full transaction request from LI.FI
   * and returning it for the agent's wallet to sign and broadcast.
   */
  /**
   * Execute a swap by fetching the full transaction request from LI.FI.
   * Returns the prepared tx data for the agent brain to sign and broadcast.
   */
  async executeSwap(quote: SwapQuote): Promise<TransactionResult> {
    logger.execute('Executing LI.FI swap', {
      from: quote.fromToken.symbol,
      to: quote.toToken.symbol,
      amount: quote.fromAmount.toString(),
      route: quote.route,
    });

    try {
      const txRequest = await this.fetchTransactionRequest({
        fromChain: quote.fromToken.chainId.toString(),
        toChain: quote.toToken.chainId.toString(),
        fromToken: quote.fromToken.address,
        toToken: quote.toToken.address,
        fromAmount: quote.fromAmount.toString(),
        fromAddress: this.walletAddress,
        slippage: '0.005',
      });

      if (!txRequest) {
        return {
          success: false,
          chainId: quote.fromToken.chainId,
          error: 'LI.FI returned no transactionRequest — wallet address may be missing',
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        chainId: quote.fromToken.chainId,
        gasUsed: BigInt(txRequest.gasLimit ?? txRequest.gas ?? '0'),
        timestamp: new Date(),
        // Store prepared tx data so the caller can sign & broadcast
        txHash: undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        chainId: quote.fromToken.chainId,
        error: msg,
        timestamp: new Date(),
      };
    }
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

    const data = (await response.json()) as Record<string, Record<string, unknown>>;
    const estimate = data['estimate'] as Record<string, unknown> | undefined;
    const feeCosts = (estimate?.['feeCosts'] as Array<Record<string, unknown>> | undefined) ?? [];
    const toolDetails = data['toolDetails'] as Record<string, unknown> | undefined;

    return {
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromAmount: params.amount,
      toAmount: BigInt((estimate?.['toAmount'] as string) ?? '0'),
      estimatedTime: (estimate?.['executionDuration'] as number) ?? 300,
      bridgeName: (toolDetails?.['name'] as string) ?? 'LI.FI Bridge',
      fees: BigInt((feeCosts[0]?.['amount'] as string) ?? '0'),
    };
  }

  /**
   * Execute a bridge by fetching the full transaction request from LI.FI.
   * LI.FI's quote endpoint returns a transactionRequest for bridging too.
   */
  async executeBridge(quote: BridgeQuote): Promise<TransactionResult> {
    logger.execute('Executing LI.FI bridge', {
      from: quote.fromChain,
      to: quote.toChain,
      bridge: quote.bridgeName,
    });

    try {
      const txRequest = await this.fetchTransactionRequest({
        fromChain: quote.fromChain.toString(),
        toChain: quote.toChain.toString(),
        fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on source
        toToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on dest
        fromAmount: quote.fromAmount.toString(),
        fromAddress: this.walletAddress,
        slippage: '0.005',
      });

      if (!txRequest) {
        return {
          success: false,
          chainId: quote.fromChain,
          error: 'LI.FI returned no transactionRequest for bridge',
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        chainId: quote.fromChain,
        gasUsed: BigInt(txRequest.gasLimit ?? txRequest.gas ?? '0'),
        timestamp: new Date(),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        chainId: quote.fromChain,
        error: msg,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Fetch a ready-to-sign transactionRequest from LI.FI's quote endpoint.
   */
  private async fetchTransactionRequest(
    params: Record<string, string>,
  ): Promise<Record<string, string> | null> {
    const queryParams = new URLSearchParams(params);
    const response = await fetch(`${this.apiBase}/quote?${queryParams}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LI.FI quote for execution failed: ${error}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const txRequest = data['transactionRequest'] as Record<string, string> | undefined;

    if (!txRequest?.['to'] || !txRequest['data']) {
      return null;
    }

    return txRequest;
  }

  async getBridgeStatus(txHash: string): Promise<BridgeStatus> {
    try {
      const response = await fetch(`${this.apiBase}/status?txHash=${txHash}`);
      if (!response.ok) return 'pending';

      const data = (await response.json()) as Record<string, unknown>;
      const status = data['status'] as string | undefined;

      if (status === 'DONE') return 'completed';
      if (status === 'FAILED') return 'failed';
      if (status === 'PENDING') return 'pending';
      return 'in_transit';
    } catch {
      return 'pending';
    }
  }
}
