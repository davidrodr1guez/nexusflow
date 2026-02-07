/**
 * Zustand store for agent state management.
 * Polls the agent HTTP API for real-time data.
 */

import { create } from 'zustand';
import { AGENT_API_URL } from '../lib/constants';

// ============================================================
// Types
// ============================================================

interface AgentHealth {
  status: string;
  agent: string;
  address: string;
  protocols: Record<string, boolean>;
  uptime: number;
}

interface AgentBalances {
  address: string;
  ethBalance: string;
  ethFormatted: string;
  ethUsdEstimate: number;
  tokens: Array<{
    symbol: string;
    address: string;
    balance: string;
    formatted: string;
    decimals: number;
  }>;
  totalUsdEstimate: number;
  timestamp: string;
}

interface AgentLog {
  timestamp: string;
  level: 'monitor' | 'decide' | 'execute' | 'error';
  message: string;
  chain?: string;
  txHash?: string;
}

interface TransactionRecord {
  txHash: string;
  type: string;
  description: string;
  amount?: string;
  from?: string;
  to?: string;
  chainId: number;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  etherscanUrl: string;
}

interface AgentState {
  ensName: string;
  owner: string;
  totalPortfolioUsd: string;
  activeStrategies: string[];
  lastUpdated: string;
}

interface StrategyInfo {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'stopped' | 'error';
  metrics: {
    totalPnl: string;
    apy: number;
    executedTrades: number;
    successRate: number;
    allocatedCapital: string;
  };
}

interface StrategyExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  etherscanUrl?: string;
}

// ============================================================
// Store
// ============================================================

interface AgentStore {
  // Connection status
  connected: boolean;
  error: string | null;

  // Agent data
  health: AgentHealth | null;
  balances: AgentBalances | null;
  logs: AgentLog[];
  transactions: TransactionRecord[];
  agentState: AgentState | null;
  strategies: StrategyInfo[];

  // Polling
  pollInterval: ReturnType<typeof setInterval> | null;

  // Actions
  fetchHealth: () => Promise<void>;
  fetchBalances: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchState: () => Promise<void>;
  fetchStrategies: () => Promise<void>;
  fetchAll: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  withdraw: (to: string, amount: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  executeStrategy: (strategyId: string) => Promise<StrategyExecutionResult>;
  toggleStrategy: (strategyId: string, active: boolean) => Promise<void>;
}

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  connected: false,
  error: null,
  health: null,
  balances: null,
  logs: [],
  transactions: [],
  agentState: null,
  strategies: [],
  pollInterval: null,

  fetchHealth: async () => {
    const data = await safeFetch<AgentHealth>(`${AGENT_API_URL}/api/health`);
    set({
      health: data,
      connected: data !== null,
      error: data ? null : 'Agent not reachable',
    });
  },

  fetchBalances: async () => {
    const data = await safeFetch<AgentBalances>(`${AGENT_API_URL}/api/balances`);
    if (data) set({ balances: data });
  },

  fetchLogs: async () => {
    const data = await safeFetch<AgentLog[]>(`${AGENT_API_URL}/api/logs?limit=200`);
    if (data) set({ logs: data });
  },

  fetchTransactions: async () => {
    const data = await safeFetch<TransactionRecord[]>(`${AGENT_API_URL}/api/transactions`);
    if (data) set({ transactions: data });
  },

  fetchState: async () => {
    const data = await safeFetch<AgentState>(`${AGENT_API_URL}/api/state`);
    if (data) set({ agentState: data });
  },

  fetchStrategies: async () => {
    const data = await safeFetch<StrategyInfo[]>(`${AGENT_API_URL}/api/strategies`);
    if (data) set({ strategies: data });
  },

  fetchAll: async () => {
    const store = get();
    await Promise.all([
      store.fetchHealth(),
      store.fetchBalances(),
      store.fetchLogs(),
      store.fetchTransactions(),
      store.fetchState(),
      store.fetchStrategies(),
    ]);
  },

  startPolling: (intervalMs = 5000) => {
    const existing = get().pollInterval;
    if (existing) clearInterval(existing);

    // Fetch immediately
    get().fetchAll();

    const id = setInterval(() => {
      get().fetchAll();
    }, intervalMs);

    set({ pollInterval: id });
  },

  stopPolling: () => {
    const id = get().pollInterval;
    if (id) {
      clearInterval(id);
      set({ pollInterval: null });
    }
  },

  withdraw: async (to: string, amount: string) => {
    try {
      const res = await fetch(`${AGENT_API_URL}/api/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, amount }),
      });
      const data = (await res.json()) as { success?: boolean; txHash?: string; error?: string };
      if (data.success) {
        setTimeout(() => get().fetchAll(), 2000);
        return { success: true, txHash: data.txHash };
      }
      return { success: false, error: data.error ?? 'Withdrawal failed' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  },

  executeStrategy: async (strategyId: string) => {
    try {
      const res = await fetch(`${AGENT_API_URL}/api/strategy/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      });
      const data = (await res.json()) as StrategyExecutionResult;
      setTimeout(() => get().fetchAll(), 2000);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  },

  toggleStrategy: async (strategyId: string, active: boolean) => {
    try {
      await fetch(`${AGENT_API_URL}/api/strategy/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId, active }),
      });
      setTimeout(() => get().fetchAll(), 1000);
    } catch {
      // silent fail — next poll will reflect state
    }
  },
}));
