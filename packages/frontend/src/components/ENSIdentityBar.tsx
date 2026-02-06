import { Globe, ExternalLink } from 'lucide-react';
import { useAgentStore } from '../stores/agent-store';
import { AGENT_WALLET_ADDRESS, ETHERSCAN_SEPOLIA } from '../lib/constants';

export function ENSIdentityBar() {
  const { connected, health } = useAgentStore();

  return (
    <footer className="border-t border-nexus-border px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Globe size={14} className={connected ? 'text-nexus-accent' : 'text-nexus-error'} />
            <span className="text-xs font-mono text-nexus-accent">nexusflow.eth</span>
          </div>
          <span className="text-nexus-border">|</span>
          <div className="flex items-center gap-4 text-[10px] font-mono text-nexus-muted">
            <span>risk: <span className="text-nexus-warning">medium</span></span>
            <span>slippage: <span className="text-nexus-text">0.5%</span></span>
            <span>network: <span className="text-nexus-text">Sepolia</span></span>
            <span>agent: <a href={`${ETHERSCAN_SEPOLIA}/address/${AGENT_WALLET_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-nexus-accent hover:underline">
              {AGENT_WALLET_ADDRESS.slice(0, 8)}...
            </a></span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {connected && health && (
            <span className="text-[10px] font-mono text-nexus-muted">
              uptime: {Math.floor(health.uptime)}s
            </span>
          )}
          <a
            href="https://app.ens.domains/nexusflow.eth"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-nexus-muted hover:text-nexus-accent transition-colors"
          >
            ENS Profile <ExternalLink size={10} />
          </a>
          <span className="text-[10px] font-mono text-nexus-muted">
            ETHGlobal HackMoney 2026
          </span>
        </div>
      </div>
    </footer>
  );
}
