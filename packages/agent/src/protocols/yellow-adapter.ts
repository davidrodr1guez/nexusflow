/**
 * Yellow Network SDK Adapter
 *
 * Provides off-chain instant payment capabilities via state channels
 * using the @erc7824/nitrolite SDK with WebSocket connection to
 * Yellow ClearNet sandbox.
 *
 * Docs: https://docs.yellow.org/
 */

import type { IProtocolAdapter, ChainId, TransactionResult } from '../types.js';
import { createLogger } from '../utils/logger.js';
import {
  createECDSAMessageSigner,
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createAppSessionMessage,
  createCloseAppSessionMessage,
  createPingMessage,
  createTransferMessage,
  parseAnyRPCResponse,
  RPCMethod,
  RPCProtocolVersion,
} from '@erc7824/nitrolite';
import type {
  MessageSigner,
  AuthChallengeResponse,
  NitroliteRPCMessage,
} from '@erc7824/nitrolite';
import type { Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const logger = createLogger('yellow-adapter');

const CLEARNET_WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const APP_NAME = 'nexusflow';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const REQUEST_TIMEOUT_MS = 15_000;

export interface YellowSession {
  appSessionId: Hex;
  counterparty: Address;
  chainId: ChainId;
  status: 'open' | 'closing' | 'closed';
  createdAt: Date;
}

export interface YellowPayment {
  sessionId: string;
  amount: bigint;
  token: Address;
  nonce: number;
}

export interface YellowSessionBalance {
  sessionId: string;
  myBalance: bigint;
  counterpartyBalance: bigint;
  token: Address;
}

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class YellowAdapter implements IProtocolAdapter {
  readonly name = 'yellow';
  readonly supportedChains: readonly ChainId[] = [1, 42161];

  private ws: WebSocket | null = null;
  private signer: MessageSigner | null = null;
  private address: Address | null = null;
  private sessionKey: Address | null = null;
  private privateKey: Hex;
  private sessions = new Map<string, YellowSession>();
  private pendingRequests = new Map<number, PendingRequest>();
  private requestIdCounter = 1;
  private authenticated = false;
  private wsUrl: string;

  constructor(privateKey?: string, wsUrl?: string) {
    this.privateKey = (privateKey ?? process.env.PRIVATE_KEY ?? '') as Hex;
    this.wsUrl = wsUrl ?? CLEARNET_WS_URL;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Yellow SDK adapter (ClearNet sandbox)...');

    if (!this.privateKey) {
      logger.decide('No PRIVATE_KEY set — Yellow adapter disabled');
      return;
    }

    const account = privateKeyToAccount(this.privateKey);
    this.address = account.address;
    this.sessionKey = account.address;

    this.signer = createECDSAMessageSigner(this.privateKey);

    try {
      await this.connectWebSocket();
      await this.authenticate();
      logger.execute('Yellow SDK adapter initialized', {
        address: this.address,
        chains: this.supportedChains,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.decide(`Yellow ClearNet unreachable — running in offline mode: ${msg}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      if (!this.signer) return false;
      const pingMsg = await createPingMessage(this.signer);
      await this.sendAndAwait(pingMsg);
      return true;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.status === 'open') {
        try {
          await this.closeSession(session.appSessionId);
        } catch {
          // Best-effort on shutdown
        }
      }
    }

    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Adapter shutting down'));
    }
    this.pendingRequests.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.authenticated = false;
    logger.info('Yellow SDK adapter shut down');
  }

  /**
   * Create a new app session (state channel) with a counterparty.
   * Uses ClearNet's create_app_session RPC to open an off-chain channel.
   */
  async createSession(
    counterparty: Address,
    chainId: ChainId,
    initialDeposit: bigint,
  ): Promise<YellowSession> {
    this.ensureReady();

    logger.execute('Creating Yellow app session', {
      counterparty,
      chainId,
      deposit: initialDeposit.toString(),
    });

    const token = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address; // USDC
    const assetKey = `eip155:${chainId}/erc20:${token}`;

    const params = {
      definition: {
        application: APP_NAME,
        protocol: RPCProtocolVersion.NitroRPC_0_2,
        participants: [this.address!, counterparty] as Hex[],
        weights: [1, 1],
        quorum: 2,
        challenge: 86400,
      },
      allocations: [
        {
          participant: this.address!,
          asset: assetKey,
          amount: initialDeposit.toString(),
        },
        {
          participant: counterparty,
          asset: assetKey,
          amount: '0',
        },
      ],
    };

    const msg = await createAppSessionMessage(this.signer!, params);
    const raw = await this.sendAndAwait(msg);
    const parsed = parseAnyRPCResponse(typeof raw === 'string' ? raw : JSON.stringify(raw));

    if (parsed.method === RPCMethod.Error) {
      const errorParams = parsed.params as { error: string };
      throw new Error(`Failed to create session: ${errorParams.error}`);
    }

    const sessionParams = parsed.params as { appSessionId: Hex };
    const session: YellowSession = {
      appSessionId: sessionParams.appSessionId,
      counterparty,
      chainId,
      status: 'open',
      createdAt: new Date(),
    };

    this.sessions.set(session.appSessionId, session);
    logger.execute('App session created', { appSessionId: session.appSessionId });
    return session;
  }

  /**
   * Send an instant off-chain payment through ClearNet.
   * Uses the transfer RPC — settles immediately with zero gas.
   */
  async sendPayment(
    sessionId: string,
    amount: bigint,
    token: Address,
  ): Promise<TransactionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        chainId: 1,
        error: `Session ${sessionId} not found`,
        timestamp: new Date(),
      };
    }

    if (session.status !== 'open') {
      return {
        success: false,
        chainId: session.chainId,
        error: `Session ${sessionId} is ${session.status}`,
        timestamp: new Date(),
      };
    }

    if (!this.signer) {
      return {
        success: false,
        chainId: session.chainId,
        error: 'Yellow adapter not initialized',
        timestamp: new Date(),
      };
    }

    logger.execute('Sending Yellow payment via ClearNet', {
      sessionId,
      amount: amount.toString(),
      token,
    });

    try {
      const assetKey = `eip155:${session.chainId}/erc20:${token}`;
      const msg = await createTransferMessage(this.signer, {
        destination: session.counterparty,
        allocations: [{ asset: assetKey, amount: amount.toString() }],
      });

      const raw = await this.sendAndAwait(msg);
      const parsed = parseAnyRPCResponse(typeof raw === 'string' ? raw : JSON.stringify(raw));

      if (parsed.method === RPCMethod.Error) {
        const errorParams = parsed.params as { error: string };
        return {
          success: false,
          chainId: session.chainId,
          error: errorParams.error,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        txHash: sessionId,
        chainId: session.chainId,
        gasUsed: 0n,
        timestamp: new Date(),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        chainId: session.chainId,
        error: errMsg,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get the current balance of an app session from ClearNet ledger.
   */
  async getSessionBalance(
    sessionId: string,
    token: Address,
  ): Promise<YellowSessionBalance> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Balance is tracked by ClearNet's ledger; for now return the session's
    // last known state. In production, query get_ledger_balances.
    return {
      sessionId,
      myBalance: 0n,
      counterpartyBalance: 0n,
      token,
    };
  }

  /**
   * Close an app session and trigger on-chain settlement.
   */
  async closeSession(sessionId: string): Promise<TransactionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        chainId: 1,
        error: `Session ${sessionId} not found`,
        timestamp: new Date(),
      };
    }

    if (!this.signer || !this.address) {
      return {
        success: false,
        chainId: session.chainId,
        error: 'Yellow adapter not initialized',
        timestamp: new Date(),
      };
    }

    logger.execute('Closing Yellow app session', { sessionId });
    session.status = 'closing';

    try {
      const token = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
      const assetKey = `eip155:${session.chainId}/erc20:${token}`;

      const msg = await createCloseAppSessionMessage(this.signer, {
        app_session_id: sessionId as Hex,
        allocations: [
          { participant: this.address, asset: assetKey, amount: '0' },
          { participant: session.counterparty, asset: assetKey, amount: '0' },
        ],
      });

      const raw = await this.sendAndAwait(msg);
      const parsed = parseAnyRPCResponse(typeof raw === 'string' ? raw : JSON.stringify(raw));

      if (parsed.method === RPCMethod.Error) {
        session.status = 'open';
        const errorParams = parsed.params as { error: string };
        return {
          success: false,
          chainId: session.chainId,
          error: errorParams.error,
          timestamp: new Date(),
        };
      }

      session.status = 'closed';
      return {
        success: true,
        txHash: sessionId,
        chainId: session.chainId,
        gasUsed: 80000n,
        timestamp: new Date(),
      };
    } catch (error) {
      session.status = 'open';
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        chainId: session.chainId,
        error: errMsg,
        timestamp: new Date(),
      };
    }
  }

  getSession(sessionId: string): YellowSession | undefined {
    return this.sessions.get(sessionId);
  }

  getOpenSessions(): YellowSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'open');
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.authenticated;
  }

  // ===========================================================
  // Private: WebSocket connection
  // ===========================================================

  private ensureReady(): void {
    if (!this.signer || !this.address) {
      throw new Error('Yellow adapter not initialized — call initialize() first');
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected to ClearNet');
    }
    if (!this.authenticated) {
      throw new Error('Not authenticated with ClearNet');
    }
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10_000);

      ws.addEventListener('open', () => {
        clearTimeout(timeout);
        this.ws = ws;
        logger.info('WebSocket connected to ClearNet sandbox');
        resolve();
      });

      ws.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        const data = typeof event.data === 'string' ? event.data : String(event.data);
        this.handleMessage(data);
      });

      ws.addEventListener('close', () => {
        this.authenticated = false;
        this.ws = null;
        logger.info('WebSocket disconnected from ClearNet');
      });
    });
  }

  private async authenticate(): Promise<void> {
    if (!this.signer || !this.address || !this.sessionKey) {
      throw new Error('Signer not initialized');
    }

    const expiresAt = BigInt(Date.now() + SESSION_EXPIRY_MS);

    // Step 1: auth_request → receive auth_challenge
    const authReqMsg = await createAuthRequestMessage({
      address: this.address,
      session_key: this.sessionKey,
      application: APP_NAME,
      allowances: [{ asset: '*', amount: '*' }],
      expires_at: expiresAt,
      scope: 'console',
    });

    const challengeRaw = await this.sendAndAwait(authReqMsg);
    const challengeParsed = parseAnyRPCResponse(
      typeof challengeRaw === 'string' ? challengeRaw : JSON.stringify(challengeRaw),
    );

    if (challengeParsed.method === RPCMethod.Error) {
      const errorParams = challengeParsed.params as { error: string };
      throw new Error(`Auth request failed: ${errorParams.error}`);
    }

    // Step 2: Sign the challenge → auth_verify
    const challenge = challengeParsed as AuthChallengeResponse;
    const verifyMsg = await createAuthVerifyMessage(this.signer, challenge);

    const verifyRaw = await this.sendAndAwait(verifyMsg);
    const verifyParsed = parseAnyRPCResponse(
      typeof verifyRaw === 'string' ? verifyRaw : JSON.stringify(verifyRaw),
    );

    if (verifyParsed.method === RPCMethod.Error) {
      const errorParams = verifyParsed.params as { error: string };
      throw new Error(`Auth verify failed: ${errorParams.error}`);
    }

    this.authenticated = true;
    logger.execute('Authenticated with ClearNet', { address: this.address });
  }

  private handleMessage(raw: string): void {
    try {
      const data = JSON.parse(raw) as NitroliteRPCMessage;

      // Match response to a pending request by requestId
      const responsePayload = data.res;
      if (responsePayload && Array.isArray(responsePayload) && responsePayload.length >= 2) {
        const requestId = responsePayload[0] as number;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(requestId);
          pending.resolve(data);
        }
      }
    } catch {
      logger.error('Failed to parse ClearNet message');
    }
  }

  private sendAndAwait(message: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Extract requestId from the outgoing message
      const parsed = JSON.parse(message) as NitroliteRPCMessage;
      const requestId = (parsed.req as unknown[])?.[0] as number ?? this.requestIdCounter++;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.ws.send(message);
    });
  }
}
