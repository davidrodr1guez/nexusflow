interface Protocol {
  name: string;
  status: 'connected' | 'degraded' | 'offline';
  description: string;
  chains: string[];
  latency?: string;
}

const PROTOCOLS: Protocol[] = [
  {
    name: 'LI.FI',
    status: 'connected',
    description: 'Cross-chain routing & bridges',
    chains: ['ETH', 'ARB', 'OP', 'BASE'],
    latency: '120ms',
  },
  {
    name: 'Uniswap v4',
    status: 'connected',
    description: 'AMM pools with NexusHook',
    chains: ['ETH', 'ARB'],
    latency: '85ms',
  },
  {
    name: 'Yellow SDK',
    status: 'connected',
    description: 'Off-chain state channels',
    chains: ['ETH', 'ARB'],
    latency: '45ms',
  },
  {
    name: 'Arc / Circle',
    status: 'connected',
    description: 'USDC cross-chain settlement',
    chains: ['ETH', 'ARB', 'OP', 'BASE'],
    latency: '200ms',
  },
  {
    name: 'ENS',
    status: 'connected',
    description: 'Agent identity & preferences',
    chains: ['ETH'],
    latency: '95ms',
  },
];

const STATUS_STYLES = {
  connected: {
    dot: 'bg-nexus-accent',
    label: 'text-nexus-accent',
    text: 'Connected',
  },
  degraded: {
    dot: 'bg-nexus-warning',
    label: 'text-nexus-warning',
    text: 'Degraded',
  },
  offline: {
    dot: 'bg-nexus-error',
    label: 'text-nexus-error',
    text: 'Offline',
  },
};

export function ProtocolStatus() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {PROTOCOLS.map((protocol) => {
        const style = STATUS_STYLES[protocol.status];
        return (
          <div
            key={protocol.name}
            className="bg-nexus-surface border border-nexus-border rounded-xl p-4 hover:border-nexus-accent/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{protocol.name}</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                <span className={`text-[10px] font-mono ${style.label}`}>{style.text}</span>
              </div>
            </div>
            <p className="text-xs text-nexus-muted mb-3">{protocol.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {protocol.chains.map((chain) => (
                  <span
                    key={chain}
                    className="text-[9px] font-mono px-1.5 py-0.5 bg-nexus-bg rounded border border-nexus-border text-nexus-muted"
                  >
                    {chain}
                  </span>
                ))}
              </div>
              {protocol.latency && (
                <span className="text-[10px] font-mono text-nexus-muted">{protocol.latency}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
