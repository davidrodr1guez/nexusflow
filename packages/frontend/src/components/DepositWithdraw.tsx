import { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Loader2 } from 'lucide-react';
import { useAgentStore } from '../stores/agent-store';
import { AGENT_WALLET_ADDRESS, ETHERSCAN_SEPOLIA } from '../lib/constants';

type Mode = 'deposit' | 'withdraw';

export function DepositWithdraw() {
  const [mode, setMode] = useState<Mode>('deposit');
  const [amount, setAmount] = useState('');
  const [withdrawResult, setWithdrawResult] = useState<{ txHash?: string; error?: string } | null>(null);

  const { address, isConnected } = useAccount();
  const { withdraw } = useAgentStore();

  // Deposit: send ETH from user wallet to agent wallet
  const { sendTransaction, data: depositHash, isPending: isDepositing } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isDepositConfirmed } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    sendTransaction({
      to: AGENT_WALLET_ADDRESS,
      value: parseEther(amount),
    });
  };

  const handleWithdraw = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;
    setWithdrawResult(null);
    const result = await withdraw(address, amount);
    setWithdrawResult(result);
  };

  const isLoading = isDepositing || isConfirming;

  return (
    <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5">
      {/* Mode Toggle */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => { setMode('deposit'); setAmount(''); setWithdrawResult(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono rounded-lg transition-colors ${
            mode === 'deposit'
              ? 'bg-nexus-accent/20 text-nexus-accent border border-nexus-accent/30'
              : 'bg-nexus-bg text-nexus-muted border border-nexus-border hover:text-nexus-text'
          }`}
        >
          <ArrowDownToLine size={12} /> Deposit
        </button>
        <button
          onClick={() => { setMode('withdraw'); setAmount(''); setWithdrawResult(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono rounded-lg transition-colors ${
            mode === 'withdraw'
              ? 'bg-nexus-warning/20 text-nexus-warning border border-nexus-warning/30'
              : 'bg-nexus-bg text-nexus-muted border border-nexus-border hover:text-nexus-text'
          }`}
        >
          <ArrowUpFromLine size={12} /> Withdraw
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-3">
        <label className="text-[10px] font-mono text-nexus-muted block mb-1">
          Amount (ETH)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.001"
            min="0"
            placeholder="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 px-3 py-2 text-sm font-mono bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text placeholder:text-nexus-muted/50 focus:outline-none focus:border-nexus-accent/50"
          />
          <button
            onClick={() => setAmount('0.01')}
            className="px-2 py-1 text-[10px] font-mono text-nexus-muted bg-nexus-bg border border-nexus-border rounded-lg hover:text-nexus-text"
          >
            0.01
          </button>
          <button
            onClick={() => setAmount('0.05')}
            className="px-2 py-1 text-[10px] font-mono text-nexus-muted bg-nexus-bg border border-nexus-border rounded-lg hover:text-nexus-text"
          >
            0.05
          </button>
        </div>
      </div>

      {/* Agent Address */}
      {mode === 'deposit' && (
        <div className="mb-3 text-[10px] font-mono text-nexus-muted">
          Sending to agent: <span className="text-nexus-text">{AGENT_WALLET_ADDRESS.slice(0, 8)}...{AGENT_WALLET_ADDRESS.slice(-6)}</span>
        </div>
      )}

      {/* Action Button */}
      {mode === 'deposit' ? (
        <button
          onClick={handleDeposit}
          disabled={!isConnected || isLoading || !amount || parseFloat(amount) <= 0}
          className="w-full py-2.5 text-sm font-mono font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-nexus-accent text-nexus-bg hover:bg-nexus-accent-dim"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {isConfirming ? 'Confirming...' : 'Sending...'}
            </span>
          ) : (
            `Deposit ${amount || '...'} ETH`
          )}
        </button>
      ) : (
        <button
          onClick={handleWithdraw}
          disabled={!isConnected || !amount || parseFloat(amount) <= 0}
          className="w-full py-2.5 text-sm font-mono font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-nexus-warning text-nexus-bg hover:opacity-90"
        >
          Withdraw {amount || '...'} ETH
        </button>
      )}

      {/* Success Messages */}
      {isDepositConfirmed && depositHash && (
        <div className="mt-3 p-2 bg-nexus-accent/10 border border-nexus-accent/30 rounded-lg">
          <span className="text-[10px] font-mono text-nexus-accent flex items-center gap-1">
            Deposit confirmed!
            <a
              href={`${ETHERSCAN_SEPOLIA}/tx/${depositHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline flex items-center gap-0.5"
            >
              View on Etherscan <ExternalLink size={9} />
            </a>
          </span>
        </div>
      )}

      {withdrawResult?.txHash && (
        <div className="mt-3 p-2 bg-nexus-accent/10 border border-nexus-accent/30 rounded-lg">
          <span className="text-[10px] font-mono text-nexus-accent flex items-center gap-1">
            Withdrawal sent!
            <a
              href={`${ETHERSCAN_SEPOLIA}/tx/${withdrawResult.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline flex items-center gap-0.5"
            >
              View on Etherscan <ExternalLink size={9} />
            </a>
          </span>
        </div>
      )}

      {withdrawResult?.error && (
        <div className="mt-3 p-2 bg-nexus-error/10 border border-nexus-error/30 rounded-lg">
          <span className="text-[10px] font-mono text-nexus-error">
            {withdrawResult.error}
          </span>
        </div>
      )}

      {!isConnected && (
        <p className="mt-2 text-[10px] font-mono text-nexus-muted text-center">
          Connect wallet to deposit or withdraw
        </p>
      )}
    </div>
  );
}
