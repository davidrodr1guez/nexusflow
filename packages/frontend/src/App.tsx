import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Overview } from './components/Overview';
import { Strategies } from './components/Strategies';
import { Logs } from './components/Logs';
import { TransactionHistory } from './components/TransactionHistory';
import { HookDemo } from './components/HookDemo';
import { ENSIdentityBar } from './components/ENSIdentityBar';
import { useAgentStore } from './stores/agent-store';

type Tab = 'overview' | 'strategies' | 'logs' | 'transactions' | 'hook';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'logs', label: 'Agent Logs' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'hook', label: 'v4 Hook' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { connected, health } = useAgentStore();

  // Start polling on mount
  useEffect(() => {
    useAgentStore.getState().startPolling(5000);
    return () => useAgentStore.getState().stopPolling();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-nexus-bg">
      {/* Header */}
      <header className="border-b border-nexus-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nexus-accent flex items-center justify-center">
              <span className="text-nexus-bg font-bold text-sm font-mono">NF</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">NexusFlow</h1>
              <p className="text-xs text-nexus-muted font-mono">AI-Powered Cross-Chain DeFi Agent</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Agent Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              connected
                ? 'bg-nexus-accent/10 border-nexus-accent/30'
                : 'bg-nexus-error/10 border-nexus-error/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connected ? 'bg-nexus-accent animate-pulse-glow' : 'bg-nexus-error'
              }`} />
              <span className={`text-xs font-mono ${connected ? 'text-nexus-accent' : 'text-nexus-error'}`}>
                {connected
                  ? `AGENT ${health?.agent?.toUpperCase() ?? 'LIVE'}`
                  : 'AGENT OFFLINE'}
              </span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-nexus-border px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-nexus-accent'
                  : 'text-nexus-muted hover:text-nexus-text'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-nexus-accent" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto animate-fade-in">
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'strategies' && <Strategies />}
          {activeTab === 'logs' && <Logs />}
          {activeTab === 'transactions' && <TransactionHistory />}
          {activeTab === 'hook' && <HookDemo />}
        </div>
      </main>

      {/* ENS Identity Footer */}
      <ENSIdentityBar />
    </div>
  );
}
