/**
 * Real balance reading from Sepolia testnet.
 * Reads ETH balance and known test token balances for the agent wallet.
 */

import { formatEther, formatUnits } from 'viem';
import { getPublicClient, getAgentAddress } from './client.js';
import { createLogger } from '../utils/logger.js';
import type { ChainBalance, ChainId } from '../types.js';

const logger = createLogger('balances');

// Well-known Sepolia token addresses
const SEPOLIA_TOKENS = {
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`,
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
  DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D574' as `0x${string}`,
  LINK: '0x779877A7B0D9E8603169DdbD7836e478b4624789' as `0x${string}`,
} as const;

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface BalanceSnapshot {
  address: `0x${string}`;
  ethBalance: bigint;
  ethFormatted: string;
  ethUsdEstimate: number;
  tokens: TokenBalanceInfo[];
  totalUsdEstimate: number;
  timestamp: Date;
}

export interface TokenBalanceInfo {
  symbol: string;
  address: `0x${string}`;
  balance: bigint;
  formatted: string;
  decimals: number;
}

// Rough USD estimates for display (testnet, so these are approximate)
const ETH_USD_PRICE = 2500;

export async function getAgentBalances(): Promise<BalanceSnapshot> {
  const client = getPublicClient();
  const agentAddress = getAgentAddress();

  // Read ETH balance
  const ethBalance = await client.getBalance({ address: agentAddress });
  const ethFormatted = formatEther(ethBalance);
  const ethUsd = parseFloat(ethFormatted) * ETH_USD_PRICE;

  // Read token balances
  const tokens: TokenBalanceInfo[] = [];

  for (const [symbol, tokenAddress] of Object.entries(SEPOLIA_TOKENS)) {
    try {
      const [balance, decimals] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [agentAddress],
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }),
      ]);

      if (balance > 0n) {
        tokens.push({
          symbol,
          address: tokenAddress,
          balance,
          formatted: formatUnits(balance, decimals),
          decimals,
        });
      }
    } catch {
      // Token may not exist on this network, skip
    }
  }

  const totalUsd = ethUsd; // On testnet, only ETH has meaningful value

  logger.monitor(`Agent balance: ${ethFormatted} ETH (~$${ethUsd.toFixed(2)})`, {
    tokens: tokens.length,
  });

  return {
    address: agentAddress,
    ethBalance,
    ethFormatted,
    ethUsdEstimate: ethUsd,
    tokens,
    totalUsdEstimate: totalUsd,
    timestamp: new Date(),
  };
}

export async function getAddressBalance(address: `0x${string}`): Promise<{
  ethBalance: bigint;
  ethFormatted: string;
}> {
  const client = getPublicClient();
  const ethBalance = await client.getBalance({ address });
  return {
    ethBalance,
    ethFormatted: formatEther(ethBalance),
  };
}

export function balanceToChainBalance(snapshot: BalanceSnapshot): ChainBalance {
  return {
    chainId: 11155111 as ChainId,
    chainName: 'Sepolia',
    balances: [
      {
        token: {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          decimals: 18,
          chainId: 11155111 as ChainId,
        },
        amount: snapshot.ethBalance,
        usdValue: BigInt(Math.floor(snapshot.ethUsdEstimate * 1e6)),
      },
      ...snapshot.tokens.map((t) => ({
        token: {
          address: t.address,
          symbol: t.symbol,
          decimals: t.decimals,
          chainId: 11155111 as ChainId,
        },
        amount: t.balance,
        usdValue: 0n,
      })),
    ],
    totalUsdValue: BigInt(Math.floor(snapshot.ethUsdEstimate * 1e6)),
  };
}
