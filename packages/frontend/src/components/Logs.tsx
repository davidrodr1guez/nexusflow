import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

type LogLevel = 'monitor' | 'decide' | 'execute' | 'error';

interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  chain?: string;
  txHash?: string;
}

// Mock log feed simulating a full agent cycle
const MOCK_LOGS: Omit<LogEntry, 'id' | 'timestamp'>[] = [
  { level: 'monitor', message: 'Scanning cross-chain state across ETH, ARB, OP, BASE...' },
  { level: 'monitor', message: 'ETH balance: 2.45 ETH ($4,200) | ARB: 1,800 USDC | OP: 950 USDC', chain: 'multi' },
  { level: 'monitor', message: 'Yield opportunity detected: Arbitrum USDC/ETH pool APY 14.2%', chain: 'Arbitrum' },
  { level: 'monitor', message: 'Reading ENS preferences for nexusflow.eth — risk: medium, slippage: 0.5%', chain: 'Ethereum' },
  { level: 'decide', message: 'Evaluating 3 active strategies against current market state...' },
  { level: 'decide', message: 'YieldOptimizer suggests: Bridge 500 USDC from Base to Arbitrum (est. profit: $12.40)', chain: 'Arbitrum' },
  { level: 'decide', message: 'Rebalancer suggests: Rebalance portfolio (5.2% deviation detected)', chain: 'multi' },
  { level: 'decide', message: 'Selected: YieldOptimizer — Bridge + Deposit to ARB USDC/ETH pool' },
  { level: 'execute', message: 'Requesting LI.FI bridge quote: Base → Arbitrum, 500 USDC', chain: 'Base' },
  { level: 'execute', message: 'LI.FI quote received: 499.75 USDC via Stargate, est. 2min', chain: 'Base' },
  { level: 'execute', message: 'Initiating Yellow SDK state channel for instant settlement', chain: 'Arbitrum' },
  { level: 'execute', message: 'Bridge tx submitted', chain: 'Base', txHash: '0x1a2b3c...4d5e6f' },
  { level: 'monitor', message: 'Bridge in transit — monitoring status via LI.FI...', chain: 'multi' },
  { level: 'execute', message: 'Bridge completed! 499.75 USDC arrived on Arbitrum', chain: 'Arbitrum' },
  { level: 'execute', message: 'Depositing 499.75 USDC into Uniswap v4 USDC/ETH pool via NexusHook', chain: 'Arbitrum', txHash: '0x7f8e9d...0a1b2c' },
  { level: 'execute', message: 'LP position created. Privacy mode enabled on NexusHook.', chain: 'Arbitrum' },
  { level: 'monitor', message: 'USDC settlement recorded via Arc/Circle — cross-chain balance updated', chain: 'multi' },
  { level: 'monitor', message: 'Cycle complete. Portfolio: $12,847 (+$12.40). Next scan in 30s.' },
  { level: 'error', message: 'Rate limit warning: LI.FI API approaching 80% quota' },
  { level: 'monitor', message: 'Scanning cross-chain state across ETH, ARB, OP, BASE...' },
  { level: 'decide', message: 'No profitable actions found above gas threshold. Holding positions.' },
  { level: 'monitor', message: 'Idle cycle complete. Next scan in 30s.' },
];

const LEVEL_STYLES: Record<LogLevel, { color: string; bg: string; label: string }> = {
  monitor: { color: 'text-nexus-blue', bg: 'bg-nexus-blue/10', label: 'MONITOR' },
  decide: { color: 'text-nexus-warning', bg: 'bg-nexus-warning/10', label: 'DECIDE' },
  execute: { color: 'text-nexus-accent', bg: 'bg-nexus-accent/10', label: 'EXECUTE' },
  error: { color: 'text-nexus-error', bg: 'bg-nexus-error/10', label: 'ERROR' },
};

function formatTime(idx: number): string {
  const base = new Date();
  base.setSeconds(base.getSeconds() - (MOCK_LOGS.length - idx) * 3);
  return base.toISOString().slice(11, 23);
}

export function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [search, setSearch] = useState('');

  // Animate logs appearing one by one
  useEffect(() => {
    const entries = MOCK_LOGS.map((log, i) => ({
      ...log,
      id: i,
      timestamp: formatTime(i),
    }));

    let idx = 0;
    setLogs([]);

    const interval = setInterval(() => {
      if (idx < entries.length) {
        const entry = entries[idx];
        if (entry) {
          setLogs((prev) => [entry, ...prev]);
        }
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const filtered = logs.filter((log) => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input
            type="text"
            placeholder="Filter logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-nexus-surface border border-nexus-border rounded-lg text-nexus-text placeholder:text-nexus-muted focus:outline-none focus:border-nexus-accent/50"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'monitor', 'decide', 'execute', 'error'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2.5 py-1.5 text-[10px] font-mono rounded-md transition-colors ${
                filter === level
                  ? 'bg-nexus-accent/20 text-nexus-accent border border-nexus-accent/30'
                  : 'bg-nexus-surface text-nexus-muted border border-nexus-border hover:text-nexus-text'
              }`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-nexus-surface border border-nexus-border rounded-xl overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {filtered.map((log) => {
            const style = LEVEL_STYLES[log.level];
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 px-4 py-2.5 border-b border-nexus-border/50 hover:bg-nexus-bg/50 animate-slide-up"
              >
                <span className="text-[10px] font-mono text-nexus-muted whitespace-nowrap mt-0.5">
                  {log.timestamp}
                </span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${style.bg} ${style.color} whitespace-nowrap mt-0.5`}>
                  {style.label}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono text-nexus-text">{log.message}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {log.chain && (
                      <span className="text-[9px] font-mono text-nexus-muted">
                        chain:{log.chain}
                      </span>
                    )}
                    {log.txHash && (
                      <span className="text-[9px] font-mono text-nexus-accent/70 cursor-pointer hover:text-nexus-accent">
                        tx:{log.txHash}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-nexus-muted font-mono">
              No logs matching filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
