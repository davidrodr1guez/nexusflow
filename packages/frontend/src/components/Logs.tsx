import { useState, useEffect } from 'react';
import { Search, ExternalLink, Radio } from 'lucide-react';
import { useAgentStore } from '../stores/agent-store';
import { ETHERSCAN_SEPOLIA } from '../lib/constants';

type LogLevel = 'monitor' | 'decide' | 'execute' | 'error';

const LEVEL_STYLES: Record<LogLevel, { color: string; bg: string; label: string }> = {
  monitor: { color: 'text-nexus-blue', bg: 'bg-nexus-blue/10', label: 'MONITOR' },
  decide: { color: 'text-nexus-warning', bg: 'bg-nexus-warning/10', label: 'DECIDE' },
  execute: { color: 'text-nexus-accent', bg: 'bg-nexus-accent/10', label: 'EXECUTE' },
  error: { color: 'text-nexus-error', bg: 'bg-nexus-error/10', label: 'ERROR' },
};

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toISOString().slice(11, 23);
  } catch {
    return ts;
  }
}

export function Logs() {
  const { logs, connected, startPolling, stopPolling } = useAgentStore();
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    startPolling(3000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const filtered = logs.filter((log) => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Live indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={14} className={connected ? 'text-nexus-accent animate-pulse' : 'text-nexus-error'} />
          <span className="text-xs font-mono text-nexus-muted">
            {connected ? 'Live feed from agent' : 'Agent disconnected — start with: npm run dev:agent'}
          </span>
        </div>
        <span className="text-xs font-mono text-nexus-muted">
          {logs.length} entries
        </span>
      </div>

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
          {filtered.map((log, i) => {
            const style = LEVEL_STYLES[log.level];
            return (
              <div
                key={`${log.timestamp}-${i}`}
                className="flex items-start gap-3 px-4 py-2.5 border-b border-nexus-border/50 hover:bg-nexus-bg/50"
              >
                <span className="text-[10px] font-mono text-nexus-muted whitespace-nowrap mt-0.5">
                  {formatTimestamp(log.timestamp)}
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
                      <a
                        href={`${ETHERSCAN_SEPOLIA}/tx/${log.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-mono text-nexus-accent/70 hover:text-nexus-accent flex items-center gap-0.5"
                      >
                        tx:{log.txHash.slice(0, 10)}... <ExternalLink size={8} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-nexus-muted font-mono">
              {connected ? 'No logs matching filter' : 'Waiting for agent connection...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
