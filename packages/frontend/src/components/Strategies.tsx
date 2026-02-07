import { useEffect, useState } from 'react';
import { TrendingUp, RefreshCw, Zap, Shield, Play, Pause, Loader2 } from 'lucide-react';
import { useAgentStore } from '../stores/agent-store';

interface StrategyDisplay {
  id: string;
  name: string;
  description: string;
  defaultApy: string;
  risk: 'Low' | 'Medium' | 'High';
  icon: React.ReactNode;
  executable: boolean;
}

const STRATEGIES: StrategyDisplay[] = [
  {
    id: 'yield-optimizer',
    name: 'Yield Optimizer',
    description: 'Scans yield opportunities across Ethereum, Arbitrum, and Base. Uses LI.FI to bridge capital to the highest APY pools.',
    defaultApy: '12.4%',
    risk: 'Medium',
    icon: <TrendingUp size={20} />,
    executable: true,
  },
  {
    id: 'cross-chain-rebalancer',
    name: 'Cross-Chain Rebalancer',
    description: 'Maintains target allocation across chains using Arc/Circle CCTP. Triggers when deviation exceeds 5% threshold.',
    defaultApy: '8.2%',
    risk: 'Low',
    icon: <RefreshCw size={20} />,
    executable: true,
  },
  {
    id: 'arb-scanner',
    name: 'Arbitrage Scanner',
    description: 'Monitors price discrepancies between Uniswap v4 pools across chains. Executes via Yellow SDK state channels for instant settlement.',
    defaultApy: '24.7%',
    risk: 'High',
    icon: <Zap size={20} />,
    executable: false,
  },
  {
    id: 'privacy-shield',
    name: 'Privacy Shield',
    description: 'Routes large trades through NexusHook privacy mode. Splits orders to minimize information leakage on-chain.',
    defaultApy: '\u2014',
    risk: 'Low',
    icon: <Shield size={20} />,
    executable: false,
  },
];

const RISK_COLORS = {
  Low: 'text-nexus-accent border-nexus-accent/30 bg-nexus-accent/10',
  Medium: 'text-nexus-warning border-nexus-warning/30 bg-nexus-warning/10',
  High: 'text-nexus-error border-nexus-error/30 bg-nexus-error/10',
};

export function Strategies() {
  const { agentState, connected, strategies, startPolling, stopPolling, executeStrategy, toggleStrategy } = useAgentStore();
  const [executing, setExecuting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    startPolling(5000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const activeIds = new Set(agentState?.activeStrategies ?? []);
  const activeCount = activeIds.size;
  const pausedCount = STRATEGIES.length - activeCount;

  const handleExecute = async (strategyId: string) => {
    setExecuting(strategyId);
    setLastResult((prev) => ({ ...prev, [strategyId]: { success: true, message: 'Executing...' } }));

    const result = await executeStrategy(strategyId);

    setLastResult((prev) => ({
      ...prev,
      [strategyId]: {
        success: result.success,
        message: result.success
          ? `Executed${result.txHash ? ` \u2014 ${result.txHash.slice(0, 10)}...` : ''}`
          : result.error ?? 'Execution failed',
      },
    }));
    setExecuting(null);
  };

  const handleToggle = async (strategyId: string, currentlyActive: boolean) => {
    await toggleStrategy(strategyId, !currentlyActive);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-nexus-muted">Agent Strategies</h2>
        <span className="text-xs font-mono text-nexus-accent">
          {connected ? `${activeCount} active / ${pausedCount} paused` : 'Agent offline'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {STRATEGIES.map((strategy) => {
          const isAgentActive = activeIds.has(strategy.id);
          const liveData = strategies.find((s) => s.id === strategy.id);
          const displayStatus = connected
            ? (liveData?.status ?? (isAgentActive ? 'active' : 'paused'))
            : 'paused';
          const isActive = displayStatus === 'active';
          const isExecuting = executing === strategy.id;
          const result = lastResult[strategy.id];

          const apy = liveData
            ? `${(liveData.metrics.apy * 100).toFixed(1)}%`
            : strategy.defaultApy;
          const pnl = liveData
            ? `${Number(liveData.metrics.totalPnl) >= 0 ? '+' : ''}$${(Number(liveData.metrics.totalPnl) / 1e6).toFixed(2)}`
            : '$0.00';
          const trades = liveData?.metrics.executedTrades ?? 0;

          return (
            <div
              key={strategy.id}
              className={`bg-nexus-surface border rounded-xl p-5 transition-all animate-slide-up ${
                isActive
                  ? 'border-nexus-border hover:border-nexus-accent/30'
                  : 'border-nexus-border/50 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-nexus-bg border border-nexus-border flex items-center justify-center text-nexus-accent">
                    {strategy.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{strategy.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActive ? 'bg-nexus-accent animate-pulse' : 'bg-nexus-muted'
                        }`}
                      />
                      <span className="text-[10px] font-mono text-nexus-muted uppercase">
                        {displayStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${RISK_COLORS[strategy.risk]}`}>
                  {strategy.risk} Risk
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-nexus-muted leading-relaxed mb-4">
                {strategy.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-nexus-border">
                <div>
                  <span className="text-[10px] text-nexus-muted block">APY</span>
                  <span className="text-sm font-mono font-semibold text-nexus-accent">{apy}</span>
                </div>
                <div>
                  <span className="text-[10px] text-nexus-muted block">P&L</span>
                  <span className="text-sm font-mono font-semibold">{pnl}</span>
                </div>
                <div>
                  <span className="text-[10px] text-nexus-muted block">Trades</span>
                  <span className="text-sm font-mono font-semibold">{trades}</span>
                </div>
              </div>

              {/* Action buttons */}
              {connected && strategy.executable && (
                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-nexus-border">
                  <button
                    onClick={() => handleExecute(strategy.id)}
                    disabled={isExecuting || !isActive}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg bg-nexus-accent/10 text-nexus-accent border border-nexus-accent/20 hover:bg-nexus-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isExecuting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Play size={12} />
                    )}
                    {isExecuting ? 'Executing...' : 'Execute Now'}
                  </button>
                  <button
                    onClick={() => handleToggle(strategy.id, isActive)}
                    disabled={isExecuting}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-nexus-warning/10 text-nexus-warning border-nexus-warning/20 hover:bg-nexus-warning/20'
                        : 'bg-nexus-accent/10 text-nexus-accent border-nexus-accent/20 hover:bg-nexus-accent/20'
                    }`}
                  >
                    {isActive ? <Pause size={12} /> : <Play size={12} />}
                    {isActive ? 'Pause' : 'Resume'}
                  </button>
                </div>
              )}

              {/* Execution result */}
              {result && (
                <div className={`mt-2 text-[10px] font-mono px-2 py-1 rounded ${
                  result.success ? 'text-nexus-accent bg-nexus-accent/5' : 'text-nexus-error bg-nexus-error/5'
                }`}>
                  {result.message}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
