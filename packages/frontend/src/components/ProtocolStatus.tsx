import { useAgentStore } from '../stores/agent-store';

interface Protocol {
  key: string;
  name: string;
  description: string;
  chains: string[];
}

const PROTOCOLS: Protocol[] = [
  { key: 'lifi', name: 'LI.FI', description: 'Cross-chain routing & bridges', chains: ['ETH', 'ARB', 'OP', 'BASE'] },
  { key: 'ens', name: 'ENS', description: 'Agent identity & preferences', chains: ['ETH'] },
  { key: 'yellow', name: 'Yellow SDK', description: 'Off-chain state channels', chains: ['ETH', 'ARB'] },
  { key: 'arc-circle', name: 'Arc / Circle', description: 'USDC cross-chain settlement', chains: ['ETH', 'ARB', 'OP', 'BASE'] },
];

const STATUS_STYLES = {
  connected: { dot: 'bg-nexus-accent', label: 'text-nexus-accent', text: 'Connected' },
  degraded: { dot: 'bg-nexus-warning', label: 'text-nexus-warning', text: 'Degraded' },
  offline: { dot: 'bg-nexus-error', label: 'text-nexus-error', text: 'Offline' },
  unknown: { dot: 'bg-nexus-muted', label: 'text-nexus-muted', text: 'Unknown' },
};

export function ProtocolStatus() {
  const { health, connected } = useAgentStore();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {PROTOCOLS.map((protocol) => {
        let status: keyof typeof STATUS_STYLES = 'unknown';
        if (connected && health?.protocols) {
          const isHealthy = health.protocols[protocol.key];
          status = isHealthy ? 'connected' : 'offline';
        } else if (!connected) {
          status = 'offline';
        }
        const style = STATUS_STYLES[status];

        return (
          <div
            key={protocol.key}
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
          </div>
        );
      })}
    </div>
  );
}
