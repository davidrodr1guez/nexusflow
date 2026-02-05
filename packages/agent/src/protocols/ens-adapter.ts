/**
 * ENS Protocol Adapter
 *
 * Provides ENS name resolution and text record management for the agent.
 * The agent's identity and DeFi preferences are stored as ENS text records:
 *   - nexusflow:swap-pref — Preferred swap protocol
 *   - nexusflow:risk — Risk tolerance (low/medium/high)
 *   - nexusflow:chains — Comma-separated preferred chain IDs
 *
 * Docs: https://docs.ens.domains/
 */

import type { IProtocolAdapter, ChainId, AgentPreferences } from '../types.js';
import { createLogger } from '../utils/logger.js';

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
  private resolverCache = new Map<string, `0x${string}`>();
  private textRecordCache = new Map<string, string>();

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl ?? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing ENS adapter...');
    logger.execute('ENS adapter initialized', { chains: this.supportedChains });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      });
      return response.ok;
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
   * Resolve an ENS name to an Ethereum address.
   */
  async resolveName(ensName: string): Promise<`0x${string}` | null> {
    logger.monitor('Resolving ENS name', { name: ensName });

    const cached = this.resolverCache.get(ensName);
    if (cached) return cached;

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63', // ENS Universal Resolver
              data: this.encodeResolve(ensName),
            },
            'latest',
          ],
          id: 1,
        }),
      });

      if (!response.ok) return null;

      const result = (await response.json()) as { result?: string };
      if (result.result && result.result !== '0x') {
        const address = `0x${result.result.slice(-40)}` as `0x${string}`;
        this.resolverCache.set(ensName, address);
        return address;
      }

      return null;
    } catch {
      logger.error(`Failed to resolve ENS name: ${ensName}`);
      return null;
    }
  }

  /**
   * Get a text record from an ENS name.
   */
  async getTextRecord(ensName: string, key: string): Promise<string | null> {
    logger.monitor('Reading ENS text record', { name: ensName, key });

    const cacheKey = `${ensName}:${key}`;
    const cached = this.textRecordCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // In production, this would use viem/ensjs to read text records
    // For hackathon demo, we return simulated values for known keys
    const defaultRecords: ENSTextRecords = {
      'nexusflow:swap-pref': 'uniswap',
      'nexusflow:risk': 'medium',
      'nexusflow:chains': '1,42161,10,8453',
    };

    const value = defaultRecords[key] ?? null;
    if (value !== null) {
      this.textRecordCache.set(cacheKey, value);
    }
    return value;
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

    // Simulated for hackathon — in production, sign and submit via viem
    const cacheKey = `${ensName}:${key}`;
    this.textRecordCache.set(cacheKey, value);

    return {
      success: true,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    };
  }

  private encodeResolve(_name: string): string {
    // Simplified ABI encoding for the resolve function
    // In production, use viem's encodeFunctionData
    return '0x';
  }

  clearCache(): void {
    this.resolverCache.clear();
    this.textRecordCache.clear();
  }
}
