/**
 * Core type definitions for the NexusFlow agent.
 * All protocol adapters and strategies implement these interfaces.
 */

// ============================================================
// Chain & Token Types
// ============================================================

export type ChainId = 1 | 42161 | 10 | 8453 | 11155111; // ETH, ARB, OP, BASE, Sepolia

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  chainId: ChainId;
}

export interface ChainBalance {
  chainId: ChainId;
  chainName: string;
  balances: TokenBalance[];
  totalUsdValue: bigint; // 6 decimals (USDC standard)
}

export interface TokenBalance {
  token: TokenInfo;
  amount: bigint;
  usdValue: bigint;
}

// ============================================================
// Protocol Adapter Interface
// ============================================================

export interface IProtocolAdapter {
  /** Human-readable protocol name */
  readonly name: string;

  /** Chain IDs this adapter supports */
  readonly supportedChains: readonly ChainId[];

  /** Initialize connections, validate config */
  initialize(): Promise<void>;

  /** Check if the protocol is reachable and functional */
  healthCheck(): Promise<boolean>;

  /** Clean shutdown */
  shutdown(): Promise<void>;
}

export interface ISwapAdapter extends IProtocolAdapter {
  getQuote(params: SwapParams): Promise<SwapQuote>;
  executeSwap(quote: SwapQuote): Promise<TransactionResult>;
}

export interface IBridgeAdapter extends IProtocolAdapter {
  getBridgeQuote(params: BridgeParams): Promise<BridgeQuote>;
  executeBridge(quote: BridgeQuote): Promise<TransactionResult>;
  getBridgeStatus(txHash: string): Promise<BridgeStatus>;
}

export interface ILiquidityAdapter extends IProtocolAdapter {
  addLiquidity(params: AddLiquidityParams): Promise<TransactionResult>;
  removeLiquidity(params: RemoveLiquidityParams): Promise<TransactionResult>;
  getPositions(owner: `0x${string}`): Promise<LiquidityPosition[]>;
}

// ============================================================
// Strategy Interface
// ============================================================

export type StrategyStatus = 'active' | 'paused' | 'stopped' | 'error';

export interface IStrategy {
  /** Unique strategy identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Current status */
  getStatus(): StrategyStatus;

  /**
   * Evaluate current market conditions and decide if action is needed.
   * Returns null if no action should be taken.
   */
  evaluate(state: AgentState): Promise<StrategyAction | null>;

  /** Execute the decided action */
  execute(action: StrategyAction): Promise<TransactionResult>;

  /** Get current performance metrics */
  getMetrics(): StrategyMetrics;
}

export interface StrategyAction {
  strategyId: string;
  type: 'swap' | 'bridge' | 'addLiquidity' | 'removeLiquidity' | 'rebalance' | 'yellowPayment';
  description: string;
  estimatedGasCost: bigint;
  estimatedProfit: bigint;
  params: Record<string, unknown>;
}

export interface StrategyMetrics {
  totalPnl: bigint;
  apy: number; // Percentage as decimal (0.12 = 12%)
  executedTrades: number;
  successRate: number;
  allocatedCapital: bigint;
}

// ============================================================
// Agent State
// ============================================================

export interface AgentState {
  ensName: string;
  owner: `0x${string}`;
  chainBalances: ChainBalance[];
  totalPortfolioUsd: bigint;
  activeStrategies: string[];
  preferences: AgentPreferences;
  lastUpdated: Date;
}

export interface AgentPreferences {
  maxSlippageBps: number; // Basis points (50 = 0.5%)
  riskLevel: 'low' | 'medium' | 'high';
  preferredChains: ChainId[];
  maxGasPerTx: bigint;
  rebalanceThresholdPct: number; // Percentage deviation to trigger rebalance
}

// ============================================================
// Transaction Types
// ============================================================

export interface SwapParams {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  amount: bigint;
  maxSlippageBps: number;
}

export interface SwapQuote {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: bigint;
  toAmount: bigint;
  estimatedGas: bigint;
  route: string; // Human-readable route description
  provider: string;
  expiresAt: Date;
}

export interface BridgeParams {
  fromChain: ChainId;
  toChain: ChainId;
  token: TokenInfo;
  amount: bigint;
}

export interface BridgeQuote {
  fromChain: ChainId;
  toChain: ChainId;
  fromAmount: bigint;
  toAmount: bigint;
  estimatedTime: number; // seconds
  bridgeName: string;
  fees: bigint;
}

export type BridgeStatus = 'pending' | 'in_transit' | 'completed' | 'failed';

export interface AddLiquidityParams {
  token0: TokenInfo;
  token1: TokenInfo;
  amount0: bigint;
  amount1: bigint;
  tickLower: number;
  tickUpper: number;
}

export interface RemoveLiquidityParams {
  positionId: bigint;
  percentage: number; // 0-100
}

export interface LiquidityPosition {
  id: bigint;
  token0: TokenInfo;
  token1: TokenInfo;
  liquidity: bigint;
  feesEarned: bigint;
  currentValue: bigint;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  chainId: ChainId;
  gasUsed?: bigint;
  error?: string;
  timestamp: Date;
}

// ============================================================
// Agent Log Types
// ============================================================

export type LogLevel = 'monitor' | 'decide' | 'execute' | 'error';

export interface AgentLog {
  timestamp: Date;
  level: LogLevel;
  message: string;
  chain?: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
}
