import { useEffect } from 'react';
import { ExternalLink, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Anchor, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAgentStore } from '../stores/agent-store';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  deposit: <ArrowDownToLine size={14} className="text-nexus-accent" />,
  withdraw: <ArrowUpFromLine size={14} className="text-nexus-warning" />,
  swap: <ArrowLeftRight size={14} className="text-nexus-blue" />,
  bridge: <Anchor size={14} className="text-nexus-blue" />,
  hook: <span className="text-xs">v4</span>,
};

const STATUS_STYLES: Record<string, { icon: React.ReactNode; color: string }> = {
  confirmed: { icon: <CheckCircle size={12} />, color: 'text-nexus-accent' },
  pending: { icon: <Clock size={12} />, color: 'text-nexus-warning' },
  failed: { icon: <XCircle size={12} />, color: 'text-nexus-error' },
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

export function TransactionHistory() {
  const { transactions, startPolling, stopPolling } = useAgentStore();

  useEffect(() => {
    startPolling(5000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  if (transactions.length === 0) {
    return (
      <div className="bg-nexus-surface border border-nexus-border rounded-xl p-8 text-center">
        <span className="text-sm font-mono text-nexus-muted">
          No transactions yet. Deposit ETH to get started.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-nexus-surface border border-nexus-border rounded-xl overflow-hidden">
      <div className="max-h-[500px] overflow-y-auto">
        {transactions.map((tx, i) => {
          const statusStyle = STATUS_STYLES[tx.status] ?? STATUS_STYLES['pending']!;
          return (
            <div
              key={`${tx.txHash}-${i}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-nexus-border/50 hover:bg-nexus-bg/50"
            >
              {/* Type Icon */}
              <div className="w-8 h-8 rounded-lg bg-nexus-bg border border-nexus-border flex items-center justify-center">
                {TYPE_ICONS[tx.type] ?? <ArrowLeftRight size={14} />}
              </div>

              {/* Description */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-nexus-text truncate">{tx.description}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-nexus-muted">{formatTime(tx.timestamp)}</span>
                  {tx.amount && (
                    <span className="text-[10px] font-mono text-nexus-muted">{tx.amount} ETH</span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className={`flex items-center gap-1 ${statusStyle.color}`}>
                {statusStyle.icon}
                <span className="text-[10px] font-mono">{tx.status}</span>
              </div>

              {/* Etherscan Link */}
              <a
                href={tx.etherscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-nexus-muted hover:text-nexus-accent transition-colors"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
