import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { Shield, BarChart3, ExternalLink, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { NEXUS_HOOK_ADDRESS, NEXUS_HOOK_ABI, AGENT_WALLET_ADDRESS, ETHERSCAN_SEPOLIA } from '../lib/constants';

// Example pool ID (keccak256 of a PoolKey - would be set during deployment)
const DEMO_POOL_ID = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

export function HookDemo() {
  const [selectedPoolId] = useState<`0x${string}`>(DEMO_POOL_ID);

  // Read hook state
  const { data: agentAddress } = useReadContract({
    address: NEXUS_HOOK_ADDRESS,
    abi: NEXUS_HOOK_ABI,
    functionName: 'agent',
  });

  const { data: swapCount } = useReadContract({
    address: NEXUS_HOOK_ADDRESS,
    abi: NEXUS_HOOK_ABI,
    functionName: 'swapCount',
    args: [selectedPoolId],
  });

  const { data: volume } = useReadContract({
    address: NEXUS_HOOK_ADDRESS,
    abi: NEXUS_HOOK_ABI,
    functionName: 'cumulativeVolume',
    args: [selectedPoolId],
  });

  const { data: privacyEnabled } = useReadContract({
    address: NEXUS_HOOK_ADDRESS,
    abi: NEXUS_HOOK_ABI,
    functionName: 'privacyModeEnabled',
    args: [selectedPoolId],
  });

  const { data: maxSize } = useReadContract({
    address: NEXUS_HOOK_ADDRESS,
    abi: NEXUS_HOOK_ABI,
    functionName: 'maxSwapSize',
    args: [selectedPoolId],
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-nexus-muted">Uniswap v4 NexusHook</h2>
          <p className="text-[10px] font-mono text-nexus-muted mt-1">
            Privacy-preserving swap validation + agent analytics on Sepolia
          </p>
        </div>
        <a
          href={`${ETHERSCAN_SEPOLIA}/address/${NEXUS_HOOK_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-mono text-nexus-accent hover:underline"
        >
          View Contract <ExternalLink size={12} />
        </a>
      </div>

      {/* Hook Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-nexus-surface border border-nexus-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-nexus-accent" />
            <span className="text-[10px] font-mono text-nexus-muted">HOOK ADDRESS</span>
          </div>
          <span className="text-xs font-mono text-nexus-text break-all">
            {NEXUS_HOOK_ADDRESS.slice(0, 12)}...{NEXUS_HOOK_ADDRESS.slice(-8)}
          </span>
        </div>

        <div className="bg-nexus-surface border border-nexus-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-nexus-blue" />
            <span className="text-[10px] font-mono text-nexus-muted">AGENT</span>
          </div>
          <span className="text-xs font-mono text-nexus-text">
            {agentAddress ? `${String(agentAddress).slice(0, 10)}...` : 'Loading...'}
          </span>
          {agentAddress && String(agentAddress).toLowerCase() === AGENT_WALLET_ADDRESS.toLowerCase() && (
            <span className="text-[9px] font-mono text-nexus-accent block mt-1">Matches our agent</span>
          )}
        </div>

        <div className="bg-nexus-surface border border-nexus-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            {privacyEnabled ? (
              <Lock size={14} className="text-nexus-accent" />
            ) : (
              <Unlock size={14} className="text-nexus-muted" />
            )}
            <span className="text-[10px] font-mono text-nexus-muted">PRIVACY MODE</span>
          </div>
          <span className={`text-sm font-mono font-semibold ${privacyEnabled ? 'text-nexus-accent' : 'text-nexus-muted'}`}>
            {privacyEnabled === undefined ? 'Loading...' : privacyEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>

        <div className="bg-nexus-surface border border-nexus-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-nexus-warning" />
            <span className="text-[10px] font-mono text-nexus-muted">MAX SWAP SIZE</span>
          </div>
          <span className="text-sm font-mono font-semibold text-nexus-text">
            {maxSize !== undefined
              ? maxSize === BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
                ? 'Unlimited'
                : maxSize.toString()
              : 'Loading...'}
          </span>
        </div>
      </div>

      {/* Pool Analytics */}
      <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-nexus-muted mb-4">Pool Analytics (from Hook)</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <span className="text-[10px] font-mono text-nexus-muted block mb-1">Total Swaps</span>
            <span className="text-3xl font-mono font-semibold text-nexus-accent">
              {swapCount !== undefined ? swapCount.toString() : '—'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-nexus-muted block mb-1">Cumulative Volume</span>
            <span className="text-3xl font-mono font-semibold text-nexus-text">
              {volume !== undefined ? volume.toString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-nexus-muted mb-4">How NexusHook Works</h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-nexus-accent/20 text-nexus-accent flex items-center justify-center text-[10px] font-mono font-bold shrink-0">1</div>
            <div>
              <span className="text-xs font-semibold text-nexus-text">beforeSwap: Privacy Validation</span>
              <p className="text-[11px] text-nexus-muted mt-0.5">
                When privacy mode is enabled, the hook enforces maximum swap sizes to prevent large information-leaking trades. Swaps exceeding the limit are reverted with <code className="text-nexus-accent">SwapTooLarge</code>.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-nexus-accent/20 text-nexus-accent flex items-center justify-center text-[10px] font-mono font-bold shrink-0">2</div>
            <div>
              <span className="text-xs font-semibold text-nexus-text">afterSwap: Agent Analytics</span>
              <p className="text-[11px] text-nexus-muted mt-0.5">
                Every swap is logged on-chain: swap count, cumulative volume, and swap events. The off-chain agent brain reads these analytics to optimize its strategies.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-nexus-accent/20 text-nexus-accent flex items-center justify-center text-[10px] font-mono font-bold shrink-0">3</div>
            <div>
              <span className="text-xs font-semibold text-nexus-text">Agent-Controlled Configuration</span>
              <p className="text-[11px] text-nexus-muted mt-0.5">
                Only the designated agent wallet can toggle privacy mode and set max swap sizes. This ensures the AI agent maintains full control over pool parameters based on market conditions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Details */}
      <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-nexus-muted mb-3">Contract Details</h3>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-nexus-muted">Network</span>
            <span className="text-nexus-text">Sepolia (11155111)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-nexus-muted">Hook Address</span>
            <a
              href={`${ETHERSCAN_SEPOLIA}/address/${NEXUS_HOOK_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-nexus-accent hover:underline flex items-center gap-1"
            >
              {NEXUS_HOOK_ADDRESS.slice(0, 14)}... <ExternalLink size={10} />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-nexus-muted">Agent Address</span>
            <a
              href={`${ETHERSCAN_SEPOLIA}/address/${AGENT_WALLET_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-nexus-accent hover:underline flex items-center gap-1"
            >
              {AGENT_WALLET_ADDRESS.slice(0, 14)}... <ExternalLink size={10} />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-nexus-muted">Hook Permissions</span>
            <span className="text-nexus-text">beforeSwap, afterSwap, afterInitialize</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-nexus-muted">Solidity Version</span>
            <span className="text-nexus-text">0.8.26</span>
          </div>
        </div>
      </div>
    </div>
  );
}
