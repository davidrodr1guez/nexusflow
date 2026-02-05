/**
 * Protocol adapter registry.
 * All protocol integrations are registered here and accessed through this module.
 */

import type { IProtocolAdapter } from '../types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('protocols');

class ProtocolRegistry {
  private adapters = new Map<string, IProtocolAdapter>();

  register(adapter: IProtocolAdapter): void {
    if (this.adapters.has(adapter.name)) {
      logger.warn(`Adapter "${adapter.name}" already registered, replacing`);
    }
    this.adapters.set(adapter.name, adapter);
    logger.info(`Registered adapter: ${adapter.name} (chains: ${adapter.supportedChains.join(', ')})`);
  }

  get(name: string): IProtocolAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Protocol adapter "${name}" not found. Available: ${this.listNames().join(', ')}`);
    }
    return adapter;
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  listNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  async initializeAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.entries()).map(async ([name, adapter]) => {
        logger.info(`Initializing ${name}...`);
        await adapter.initialize();
        logger.info(`✅ ${name} initialized`);
      })
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error(`${failures.length} adapter(s) failed to initialize`);
      failures.forEach((f) => {
        if (f.status === 'rejected') logger.error(f.reason);
      });
    }
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [name, adapter] of this.adapters) {
      try {
        results[name] = await adapter.healthCheck();
      } catch {
        results[name] = false;
      }
    }
    return results;
  }

  async shutdownAll(): Promise<void> {
    for (const [name, adapter] of this.adapters) {
      try {
        await adapter.shutdown();
        logger.info(`${name} shut down`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to shut down ${name}: ${msg}`);
      }
    }
  }
}

/** Singleton registry instance */
export const protocolRegistry = new ProtocolRegistry();
