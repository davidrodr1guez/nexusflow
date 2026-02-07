/**
 * In-memory transaction store.
 * Shared between the agent brain (writes) and the HTTP server (reads).
 * Extracted to break the circular dependency between agent-brain and server.
 */

export interface TransactionRecord {
  txHash: string;
  type: 'deposit' | 'withdraw' | 'swap' | 'bridge' | 'hook';
  description: string;
  amount?: string;
  from?: string;
  to?: string;
  chainId: number;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  etherscanUrl: string;
}

const transactions: TransactionRecord[] = [];

export function addTransaction(tx: Omit<TransactionRecord, 'etherscanUrl'>): void {
  transactions.unshift({
    ...tx,
    etherscanUrl: `https://sepolia.etherscan.io/tx/${tx.txHash}`,
  });
  if (transactions.length > 200) {
    transactions.length = 200;
  }
}

export function getTransactions(): readonly TransactionRecord[] {
  return transactions;
}

export function findTransaction(txHash: string): TransactionRecord | undefined {
  return transactions.find((t) => t.txHash === txHash);
}
