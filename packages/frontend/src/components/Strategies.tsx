import { TrendingUp, RefreshCw, Zap, Shield } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  description: string;
  apy: string;
  risk: 'Low' | 'Medium' | 'High';
  status: 'active' | 'paused';
  pnl: string;
  trades: number;
  icon: React.ReactNode;
}

const STRATEGIES: Strategy[] = [
  {
    id: 'yield-optimizer',
    name: 'Yield Optimizer',
    description: 'Scans top yield opportunities across Ethereum, Arbitrum, and Base. Auto-compounds rewards and rebalances into highest APY pools.',
    apy: '12.4%',
    risk: 'Medium',
    status: 'active',
    pnl: '+$1,247.80',
    trades: 34,
    icon: <TrendingUp size={20} />,
  },
  {
    id: 'cross-chain-rebalancer',
    name: 'Cross-Chain Rebalancer',
    description: 'Maintains target allocation across chains using LI.FI bridges. Triggers when deviation exceeds 5% threshold.',
    apy: '8.2%',
    risk: 'Low',
    status: 'active',
    pnl: '+$623.40',
    trades: 12,
    icon: <RefreshCw size={20} />,
  },
  {
    id: 'arb-scanner',
    name: 'Arbitrage Scanner',
    description: 'Monitors price discrepancies between Uniswap v4 pools across chains. Executes via Yellow SDK state channels for instant settlement.',
    apy: '24.7%',
    risk: 'High',
    status: 'active',
    pnl: '+$2,103.50',
    trades: 87,
    icon: <Zap size={20} />,
  },
  {
    id: 'privacy-shield',
    name: 'Privacy Shield',
    description: 'Routes large trades through NexusHook privacy mode. Splits orders to minimize information leakage on-chain.',
    apy: '—',
    risk: 'Low',
    status: 'paused',
    pnl: '$0.00',
    trades: 0,
    icon: <Shield size={20} />,
  },
];

const RISK_COLORS = {
  Low: 'text-nexus-accent border-nexus-accent/30 bg-nexus-accent/10',
  Medium: 'text-nexus-warning border-nexus-warning/30 bg-nexus-warning/10',
  High: 'text-nexus-error border-nexus-error/30 bg-nexus-error/10',
};

export function Strategies() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-nexus-muted">Active Strategies</h2>
        <span className="text-xs font-mono text-nexus-accent">
          3 active / 1 paused
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {STRATEGIES.map((strategy) => (
          <div
            key={strategy.id}
            className={`bg-nexus-surface border rounded-xl p-5 transition-all animate-slide-up ${
              strategy.status === 'active'
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
                        strategy.status === 'active' ? 'bg-nexus-accent' : 'bg-nexus-muted'
                      }`}
                    />
                    <span className="text-[10px] font-mono text-nexus-muted uppercase">
                      {strategy.status}
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
                <span className="text-sm font-mono font-semibold text-nexus-accent">{strategy.apy}</span>
              </div>
              <div>
                <span className="text-[10px] text-nexus-muted block">P&L</span>
                <span className="text-sm font-mono font-semibold">{strategy.pnl}</span>
              </div>
              <div>
                <span className="text-[10px] text-nexus-muted block">Trades</span>
                <span className="text-sm font-mono font-semibold">{strategy.trades}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
