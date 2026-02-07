/**
 * Arc / Circle CCTP Protocol Adapter
 *
 * Implements real cross-chain USDC transfers using Circle's CCTP
 * (Cross-Chain Transfer Protocol). Burns USDC on source chain,
 * retrieves attestation from Circle API, mints on destination chain.
 *
 * Docs: https://developers.circle.com/cctp
 */

import type { IProtocolAdapter, ChainId, TransactionResult } from '../types.js';
import { createLogger } from '../utils/logger.js';
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, arbitrumSepolia, baseSepolia, optimismSepolia } from 'viem/chains';

const logger = createLogger('arc-adapter');

// CCTP Contract Addresses (Testnet)
const CCTP_CONTRACTS: Record<number, {
  usdc: `0x${string}`;
  tokenMessenger: `0x${string}`;
  messageTransmitter: `0x${string}`;
  domain: number;
}> = {
  11155111: {
    usdc: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    tokenMessenger: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
    domain: 0,
  },
  421614: {
    usdc: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d',
    tokenMessenger: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
    domain: 3,
  },
  84532: {
    usdc: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
    tokenMessenger: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
    domain: 6,
  },
  11155420: {
    usdc: '0x5fd84259d66cd46123540766be93dfe6d43130d7',
    tokenMessenger: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
    domain: 2,
  },
};

const CHAINS = {
  11155111: sepolia,
  421614: arbitrumSepolia,
  84532: baseSepolia,
  11155420: optimismSepolia,
} as const;

const ATTESTATION_API = 'https://iris-api-sandbox.circle.com/v2/messages';

interface AttestationMessage {
  message: string;
  attestation: string;
  status: string;
}

export interface CrossChainTransfer {
  transferId: string;
  fromChain: ChainId;
  toChain: ChainId;
  amount: bigint;
  status: 'pending' | 'attesting' | 'ready' | 'completed' | 'failed';
  burnTxHash?: string;
  mintTxHash?: string;
  createdAt: Date;
}

export class ArcAdapter implements IProtocolAdapter {
  readonly name = 'arc-circle';
  readonly supportedChains: readonly ChainId[] = [11155111, 421614, 84532, 11155420];

  private privateKey: `0x${string}`;
  private account: ReturnType<typeof privateKeyToAccount> | null = null;
  private transfers = new Map<string, CrossChainTransfer>();

  constructor(privateKey?: string) {
    this.privateKey = (privateKey ?? process.env.PRIVATE_KEY ?? '') as `0x${string}`;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Arc/Circle CCTP adapter...');

    if (!this.privateKey) {
      logger.decide('No PRIVATE_KEY set — Arc adapter disabled');
      return;
    }

    this.account = privateKeyToAccount(this.privateKey);

    const healthy = await this.healthCheck();
    if (!healthy) {
      logger.decide('Circle Attestation API unreachable — CCTP transfers may fail');
    }

    logger.execute('Arc/Circle CCTP adapter initialized', {
      address: this.account.address,
      chains: this.supportedChains,
      cctpDomains: Object.fromEntries(
        Object.entries(CCTP_CONTRACTS).map(([k, v]) => [k, v.domain]),
      ),
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${ATTESTATION_API}/0?transactionHash=0x0`);
      return response.status === 404 || response.ok;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    this.transfers.clear();
    logger.info('Arc/Circle CCTP adapter shut down');
  }

  /**
   * Get USDC balance on a specific chain.
   */
  async getUsdcBalance(chainId: number): Promise<bigint> {
    const contracts = CCTP_CONTRACTS[chainId];
    const chain = CHAINS[chainId as keyof typeof CHAINS];

    if (!contracts || !chain || !this.account) {
      return 0n;
    }

    try {
      const client = createPublicClient({ chain, transport: http() });
      const balance = await client.readContract({
        address: contracts.usdc,
        abi: [{
          type: 'function',
          name: 'balanceOf',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'balanceOf',
        args: [this.account.address],
      });

      return balance as bigint;
    } catch (error) {
      logger.error('Failed to get USDC balance', { chainId, error });
      return 0n;
    }
  }

  /**
   * Transfer USDC cross-chain using Circle CCTP.
   */
  async transferCrossChain(
    fromChain: number,
    toChain: number,
    amount: bigint,
    recipient?: `0x${string}`,
  ): Promise<CrossChainTransfer> {
    const sourceContracts = CCTP_CONTRACTS[fromChain];
    const destContracts = CCTP_CONTRACTS[toChain];
    const sourceChain = CHAINS[fromChain as keyof typeof CHAINS];
    const destChain = CHAINS[toChain as keyof typeof CHAINS];

    if (!sourceContracts || !destContracts || !sourceChain || !destChain) {
      throw new Error(`CCTP not supported for chain pair ${fromChain} -> ${toChain}`);
    }

    if (!this.account) {
      throw new Error('Account not initialized');
    }

    const destinationAddress = recipient ?? this.account.address;
    const transferId = `cctp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const transfer: CrossChainTransfer = {
      transferId,
      fromChain: fromChain as ChainId,
      toChain: toChain as ChainId,
      amount,
      status: 'pending',
      createdAt: new Date(),
    };
    this.transfers.set(transferId, transfer);

    logger.execute('Initiating CCTP cross-chain transfer', {
      transferId,
      from: fromChain,
      to: toChain,
      amount: amount.toString(),
    });

    try {
      const sourceWallet = createWalletClient({
        chain: sourceChain,
        transport: http(),
        account: this.account,
      });

      const destWallet = createWalletClient({
        chain: destChain,
        transport: http(),
        account: this.account,
      });

      const sourcePublic = createPublicClient({ chain: sourceChain, transport: http() });

      // Step 1: Approve USDC
      logger.monitor('Approving USDC...');
      const approveTx = await sourceWallet.sendTransaction({
        to: sourceContracts.usdc,
        data: encodeFunctionData({
          abi: [{
            type: 'function',
            name: 'approve',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          }],
          functionName: 'approve',
          args: [sourceContracts.tokenMessenger, amount],
        }),
      });
      await sourcePublic.waitForTransactionReceipt({ hash: approveTx });

      // Step 2: Burn USDC
      logger.monitor('Burning USDC...');
      const destAddressBytes32 = `0x000000000000000000000000${destinationAddress.slice(2)}` as `0x${string}`;
      const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

      const burnTx = await sourceWallet.sendTransaction({
        to: sourceContracts.tokenMessenger,
        data: encodeFunctionData({
          abi: [{
            type: 'function',
            name: 'depositForBurn',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'amount', type: 'uint256' },
              { name: 'destinationDomain', type: 'uint32' },
              { name: 'mintRecipient', type: 'bytes32' },
              { name: 'burnToken', type: 'address' },
              { name: 'destinationCaller', type: 'bytes32' },
              { name: 'maxFee', type: 'uint256' },
              { name: 'minFinalityThreshold', type: 'uint32' },
            ],
            outputs: [],
          }],
          functionName: 'depositForBurn',
          args: [amount, destContracts.domain, destAddressBytes32, sourceContracts.usdc, zeroBytes32, 500n, 1000],
        }),
      });

      transfer.burnTxHash = burnTx;
      transfer.status = 'attesting';
      await sourcePublic.waitForTransactionReceipt({ hash: burnTx });
      logger.execute('USDC burned', { txHash: burnTx });

      // Step 3: Get attestation
      logger.monitor('Waiting for attestation...');
      const attestation = await this.waitForAttestation(sourceContracts.domain, burnTx);
      transfer.status = 'ready';

      // Step 4: Mint on destination
      logger.monitor('Minting on destination...');
      const mintTx = await destWallet.sendTransaction({
        to: destContracts.messageTransmitter,
        data: encodeFunctionData({
          abi: [{
            type: 'function',
            name: 'receiveMessage',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'message', type: 'bytes' },
              { name: 'attestation', type: 'bytes' },
            ],
            outputs: [],
          }],
          functionName: 'receiveMessage',
          args: [attestation.message as `0x${string}`, attestation.attestation as `0x${string}`],
        }),
      });

      transfer.mintTxHash = mintTx;
      transfer.status = 'completed';
      logger.execute('CCTP transfer completed', { transferId, burnTx, mintTx });

      return transfer;
    } catch (error) {
      transfer.status = 'failed';
      throw error;
    }
  }

  private async waitForAttestation(sourceDomain: number, txHash: string, maxAttempts = 60): Promise<AttestationMessage> {
    const url = `${ATTESTATION_API}/${sourceDomain}?transactionHash=${txHash}`;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json() as { messages: AttestationMessage[] };
          if (data.messages?.[0]?.status === 'complete') {
            return data.messages[0];
          }
        }
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error('Attestation timeout');
  }

  getTransfer(id: string): CrossChainTransfer | undefined {
    return this.transfers.get(id);
  }
}
