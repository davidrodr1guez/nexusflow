/**
 * Viem blockchain clients for Sepolia testnet.
 * Provides both read-only public client and signing wallet client.
 */

import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('blockchain');

function getRpcUrl(): string {
  if (process.env.SEPOLIA_RPC_URL) {
    return process.env.SEPOLIA_RPC_URL;
  }
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (alchemyKey) {
    return `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  }
  return 'https://rpc.sepolia.org';
}

function getPrivateKey(): `0x${string}` {
  const key = process.env.PRIVATE_KEY;
  if (!key) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }
  return key.startsWith('0x') ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`);
}

let _publicClient: ReturnType<typeof createPublicClient> | null = null;
let _walletClient: ReturnType<typeof createWalletClient> | null = null;
let _account: ReturnType<typeof privateKeyToAccount> | null = null;

export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: sepolia,
      transport: http(getRpcUrl()),
    });
    logger.info('Public client initialized for Sepolia');
  }
  return _publicClient;
}

export function getWalletClient() {
  if (!_walletClient) {
    const account = getAccount();
    _walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(getRpcUrl()),
    });
    logger.info(`Wallet client initialized: ${account.address}`);
  }
  return _walletClient;
}

export function getAccount() {
  if (!_account) {
    _account = privateKeyToAccount(getPrivateKey());
  }
  return _account;
}

export function getAgentAddress(): `0x${string}` {
  return getAccount().address;
}

export async function getEthBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  return client.getBalance({ address });
}

export async function getFormattedBalance(address: `0x${string}`): Promise<string> {
  const balance = await getEthBalance(address);
  return formatEther(balance);
}

export { sepolia, formatEther };
