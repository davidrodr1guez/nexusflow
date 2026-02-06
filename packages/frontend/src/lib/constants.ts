/**
 * Constants and contract addresses for NexusFlow frontend.
 */

export const AGENT_API_URL = 'http://localhost:3001';

export const NEXUS_HOOK_ADDRESS = '0xA23275CC359aF643f81Ed6d557C1d479f6Dc90c0' as const;
export const AGENT_WALLET_ADDRESS = '0xDBe5C802df8656995646AD55d2306aB05b7fc2d4' as const;

export const SEPOLIA_CHAIN_ID = 11155111;

export const NEXUS_HOOK_ABI = [
  {
    inputs: [{ name: '', type: 'bytes32' }],
    name: 'swapCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'bytes32' }],
    name: 'cumulativeVolume',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'bytes32' }],
    name: 'privacyModeEnabled',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'bytes32' }],
    name: 'maxSwapSize',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'agent',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const ETHERSCAN_SEPOLIA = 'https://sepolia.etherscan.io';
