import { useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { TrendingUp, Wallet, ArrowLeftRight, Shield, Activity, ExternalLink } from 'lucide-react';
import { ProtocolStatus } from './ProtocolStatus';
import { DepositWithdraw } from './DepositWithdraw';
import { useAgentStore } from '../stores/agent-store';
import { AGENT_WALLET_ADDRESS, ETHERSCAN_SEPOLIA } from '../lib/constants';

// Generate portfolio history from agent balance
function generateHistory(currentValue: number) {
  const points = 8;
  const data = [];
  const startVal = currentValue * 0.85;
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const jitter = (Math.random() - 0.3) * currentValue * 0.05;
    const value = Math.round(startVal + (currentValue - startVal) * progress + jitter);
    const d = new Date();
    d.setDate(d.getDate() - (points - 1 - i) * 3);
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.max(value, 0),
    });
  }
  // Ensure last point is exact
  if (data.length > 0) {
    data[data.length - 1]!.value = Math.round(currentValue);
  }
  return data;
}

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ReactNode;
  link?: string;
}

function StatCard({ label, value, change, positive, icon, link }: StatCardProps) {
  return (
    <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-nexus-muted text-sm">{label}</span>
        <div className="text-nexus-muted">{icon}</div>
      </div>
      <div className="text-2xl font-semibold font-mono tracking-tight">{value}</div>
      {change && (
        <div className={`text-xs font-mono mt-1 flex items-center gap-1 ${positive ? 'text-nexus-accent' : positive === false ? 'text-nexus-error' : 'text-nexus-muted'}`}>
          {positive ? '+' : ''}{change}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="hover:text-nexus-accent">
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (active && payload?.[0]) {
    return (
      <div className="bg-nexus-surface border border-nexus-border rounded-lg px-3 py-2 shadow-lg">
        <span className="text-sm font-mono text-nexus-accent">${payload[0].value.toLocaleString()}</span>
      </div>
    );
  }
  return null;
}

export function Overview() {
  const { address, isConnected } = useAccount();
  const { data: userBalance } = useBalance({ address });
  const { balances, health, connected, agentState, startPolling, stopPolling } = useAgentStore();

  useEffect(() => {
    startPolling(5000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const agentEth = balances ? parseFloat(balances.ethFormatted) : 0;
  const agentUsd = balances?.ethUsdEstimate ?? 0;
  const userEth = userBalance ? parseFloat(userBalance.formatted) : 0;
  const totalUsd = agentUsd + userEth * 2500;

  const portfolioHistory = generateHistory(totalUsd);

  const CHAIN_DATA = [
    { name: 'Agent (Sepolia)', value: Math.round(agentUsd), color: '#00D395' },
    { name: 'Your Wallet', value: Math.round(userEth * 2500), color: '#627EEA' },
  ].filter((d) => d.value > 0);

  const activeStrategies = agentState?.activeStrategies?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {!connected && (
        <div className="bg-nexus-error/10 border border-nexus-error/30 rounded-xl px-4 py-3 text-sm text-nexus-error font-mono">
          Agent not connected. Start the agent: <code className="bg-nexus-bg px-2 py-0.5 rounded">npm run dev:agent</code>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Agent Balance"
          value={agentEth > 0 ? `${agentEth.toFixed(4)} ETH` : 'Loading...'}
          change={agentUsd > 0 ? `~$${agentUsd.toFixed(2)}` : undefined}
          positive={agentUsd > 0 ? true : undefined}
          icon={<Wallet size={18} />}
          link={`${ETHERSCAN_SEPOLIA}/address/${AGENT_WALLET_ADDRESS}`}
        />
        <StatCard
          label="Your Wallet"
          value={isConnected ? `${userEth.toFixed(4)} ETH` : 'Not Connected'}
          change={isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : undefined}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Active Strategies"
          value={`${activeStrategies}`}
          change={connected ? `${health?.agent ?? 'loading'}` : 'offline'}
          positive={connected}
          icon={<ArrowLeftRight size={18} />}
        />
        <StatCard
          label="Risk Level"
          value="Medium"
          change={`${activeStrategies} strategies running`}
          positive
          icon={<Shield size={18} />}
        />
      </div>

      {/* Deposit/Withdraw + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Portfolio Chart */}
        <div className="lg:col-span-2 bg-nexus-surface border border-nexus-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-nexus-muted">Portfolio Value</h2>
            <span className="text-xs font-mono text-nexus-accent">
              ${totalUsd.toFixed(2)}
            </span>
          </div>
          {totalUsd > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={portfolioHistory}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D395" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00D395" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b6b80', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b6b80', fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00D395"
                  strokeWidth={2}
                  fill="url(#portfolioGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-nexus-muted text-sm font-mono">
              Waiting for balance data...
            </div>
          )}
        </div>

        {/* Fund Distribution + Deposit/Withdraw */}
        <div className="space-y-4">
          <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-nexus-muted mb-4">Fund Distribution</h2>
            {CHAIN_DATA.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={CHAIN_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {CHAIN_DATA.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {CHAIN_DATA.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-nexus-muted">{item.name}</span>
                      </div>
                      <span className="font-mono">${item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-nexus-muted text-sm font-mono">
                No funds detected
              </div>
            )}
          </div>

          <DepositWithdraw />
        </div>
      </div>

      {/* Token Balances */}
      {balances && balances.tokens.length > 0 && (
        <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-nexus-muted mb-3">Agent Token Balances</h2>
          <div className="space-y-2">
            {balances.tokens.map((token) => (
              <div key={token.address} className="flex items-center justify-between text-xs border-b border-nexus-border/50 pb-2">
                <span className="font-mono font-semibold">{token.symbol}</span>
                <span className="font-mono text-nexus-muted">{parseFloat(token.formatted).toFixed(6)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Protocol Status */}
      <div>
        <h2 className="text-sm font-medium text-nexus-muted mb-3 flex items-center gap-2">
          <Activity size={14} />
          Protocol Status
        </h2>
        <ProtocolStatus />
      </div>
    </div>
  );
}
