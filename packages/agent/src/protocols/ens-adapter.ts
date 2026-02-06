/**
 * ENS Protocol Adapter
 *
 * Provides ENS name resolution and text record management for the agent.
 * Uses viem's built-in ENS actions to read on-chain data from mainnet.
 * The agent's identity and DeFi preferences are stored as ENS text records:
 *   - nexusflow:swap-pref — Preferred swap protocol
 *   - nexusflow:risk — Risk tolerance (low/medium/high)
 *   - nexusflow:chains — Comma-separated preferred chain IDs
 *
 * Docs: https://docs.ens.domains/
 */

import type { IProtocolAdapter, ChainId, AgentPreferences } from '../types.js';
import { createLogger } from '../utils/logger.js';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const logger = createLogger('ens-adapter');

export interface ENSTextRecords {
  'nexusflow:swap-pref'?: string;
  'nexusflow:risk'?: string;
  'nexusflow:chains'?: string;
  [key: string]: string | undefined;
}

export class ENSAdapter implements IProtocolAdapter {
  readonly name = 'ens';
  readonly supportedChains: readonly ChainId[] = [1]; // ENS is on mainnet

  private rpcUrl: string;
  private client: ReturnType<typeof createPublicClient>;
  private resolverCache = new Map<string, `0x${string}`>();
  private textRecordCache = new Map<string, string>();

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl ?? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(this.rpcUrl),
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing ENS adapter...');
    const healthy = await this.healthCheck();
    if (!healthy) {
      logger.decide('ENS RPC unreachable — text record reads will fail');
    }
    logger.execute('ENS adapter initialized', { chains: this.supportedChains });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    this.resolverCache.clear();
    this.textRecordCache.clear();
    logger.info('ENS adapter shut down');
  }

  /**
   * Resolve an ENS name to an Ethereum address using viem.
   */
  async resolveName(ensName: string): Promise<`0x${string}` | null> {
    logger.monitor('Resolving ENS name', { name: ensName });

    const cached = this.resolverCache.get(ensName);
    if (cached) return cached;

    try {
      const address = await this.client.getEnsAddress({
        name: normalize(ensName),
      });

      if (address) {
        this.resolverCache.set(ensName, address);
      }

      return address;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to resolve ENS name: ${ensName}`, { error: msg });
      return null;
    }
  }

  /**
   * Get a text record from an ENS name by reading on-chain via viem.
   */
  async getTextRecord(ensName: string, key: string): Promise<string | null> {
    logger.monitor('Reading ENS text record', { name: ensName, key });

    const cacheKey = `${ensName}:${key}`;
    const cached = this.textRecordCache.get(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const value = await this.client.getEnsText({
        name: normalize(ensName),
        key,
      });

      if (value) {
        this.textRecordCache.set(cacheKey, value);
      }

      return value;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to read ENS text record: ${ensName} / ${key}`, { error: msg });
      return null;
    }
  }

  /**
   * Read all NexusFlow-specific preferences from ENS text records.
   * These records define how the agent behaves on behalf of the user.
   */
  async getAgentPreferences(ensName: string): Promise<Partial<AgentPreferences>> {
    logger.monitor('Reading agent preferences from ENS', { name: ensName });

    const [swapPref, riskLevel, chains] = await Promise.all([
      this.getTextRecord(ensName, 'nexusflow:swap-pref'),
      this.getTextRecord(ensName, 'nexusflow:risk'),
      this.getTextRecord(ensName, 'nexusflow:chains'),
    ]);

    const preferences: Partial<AgentPreferences> = {};

    if (riskLevel && ['low', 'medium', 'high'].includes(riskLevel)) {
      preferences.riskLevel = riskLevel as 'low' | 'medium' | 'high';
    }

    if (chains) {
      const chainIds = chains
        .split(',')
        .map((c) => parseInt(c.trim(), 10))
        .filter((id): id is ChainId => [1, 42161, 10, 8453, 11155111].includes(id));
      if (chainIds.length > 0) {
        preferences.preferredChains = chainIds;
      }
    }

    logger.decide('Agent preferences loaded', {
      riskLevel: preferences.riskLevel,
      chains: preferences.preferredChains,
      swapPref,
    });

    return preferences;
  }

  /**
   * Set a text record on an ENS name (requires wallet signing).
   * In production this would submit an on-chain transaction.
   */
  async setTextRecord(
    ensName: string,
    key: string,
    value: string,
  ): Promise<{ success: boolean; txHash?: string }> {
    logger.execute('Setting ENS text record', { name: ensName, key, value });

    // Writing ENS text records requires a wallet transaction to the resolver.
    // For now, update the local cache and log the intent.
    const cacheKey = `${ensName}:${key}`;
    this.textRecordCache.set(cacheKey, value);

    return { success: true };
  }

  clearCache(): void {
    this.resolverCache.clear();
    this.textRecordCache.clear();
  }
}
