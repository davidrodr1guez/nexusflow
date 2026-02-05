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
import { TrendingUp, Wallet, ArrowLeftRight, Shield, Activity } from 'lucide-react';
import { ProtocolStatus } from './ProtocolStatus';

// Mock portfolio data for demo
const PORTFOLIO_HISTORY = [
  { date: 'Jan 1', value: 10000 },
  { date: 'Jan 5', value: 10200 },
  { date: 'Jan 10', value: 10850 },
  { date: 'Jan 15', value: 10600 },
  { date: 'Jan 20', value: 11200 },
  { date: 'Jan 25', value: 11800 },
  { date: 'Feb 1', value: 12350 },
  { date: 'Feb 5', value: 12847 },
];

const CHAIN_DISTRIBUTION = [
  { name: 'Ethereum', value: 4200, color: '#627EEA' },
  { name: 'Arbitrum', value: 3800, color: '#28A0F0' },
  { name: 'Optimism', value: 2600, color: '#FF0420' },
  { name: 'Base', value: 2247, color: '#0052FF' },
];

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ReactNode;
}

function StatCard({ label, value, change, positive, icon }: StatCardProps) {
  return (
    <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-nexus-muted text-sm">{label}</span>
        <div className="text-nexus-muted">{icon}</div>
      </div>
      <div className="text-2xl font-semibold font-mono tracking-tight">{value}</div>
      {change && (
        <div className={`text-xs font-mono mt-1 ${positive ? 'text-nexus-accent' : 'text-nexus-error'}`}>
          {positive ? '+' : ''}{change}
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
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Portfolio"
          value="$12,847"
          change="28.47% all-time"
          positive
          icon={<Wallet size={18} />}
        />
        <StatCard
          label="24h P&L"
          value="+$247.30"
          change="+1.96%"
          positive
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Active Trades"
          value="7"
          icon={<ArrowLeftRight size={18} />}
        />
        <StatCard
          label="Risk Score"
          value="Medium"
          change="3 strategies running"
          positive
          icon={<Shield size={18} />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Portfolio Chart */}
        <div className="lg:col-span-2 bg-nexus-surface border border-nexus-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-nexus-muted">Portfolio Value</h2>
            <span className="text-xs font-mono text-nexus-accent">+28.47%</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={PORTFOLIO_HISTORY}>
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
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
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
        </div>

        {/* Chain Distribution */}
        <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-nexus-muted mb-4">Chain Distribution</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={CHAIN_DISTRIBUTION}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {CHAIN_DISTRIBUTION.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {CHAIN_DISTRIBUTION.map((chain) => (
              <div key={chain.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chain.color }} />
                  <span className="text-nexus-muted">{chain.name}</span>
                </div>
                <span className="font-mono">${chain.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
