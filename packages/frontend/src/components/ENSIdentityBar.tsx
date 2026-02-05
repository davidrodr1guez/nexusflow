import { Globe, ExternalLink } from 'lucide-react';

export function ENSIdentityBar() {
  return (
    <footer className="border-t border-nexus-border px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-nexus-accent" />
            <span className="text-xs font-mono text-nexus-accent">nexusflow.eth</span>
          </div>
          <span className="text-nexus-border">|</span>
          <div className="flex items-center gap-4 text-[10px] font-mono text-nexus-muted">
            <span>risk: <span className="text-nexus-warning">medium</span></span>
            <span>slippage: <span className="text-nexus-text">0.5%</span></span>
            <span>chains: <span className="text-nexus-text">ETH, ARB, OP, BASE</span></span>
          </div>
        </div>
        <div className="flex items-center gap-4">
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
