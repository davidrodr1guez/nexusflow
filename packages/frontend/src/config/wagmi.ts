import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, arbitrum, optimism, base, sepolia } from 'wagmi/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'NexusFlow',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'nexusflow-dev',
  chains: [mainnet, arbitrum, optimism, base, sepolia],
  ssr: false,
});
