import { http } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import type { Chain } from 'wagmi/chains';

export const pepeUnchainedTestnet: Chain = {
  id: 97740,
  name: 'Pepe Unchained testnet',
  nativeCurrency: {
    name: 'PEPU',
    symbol: 'PEPU',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz'] },
    public: { http: ['https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz'] },
  },
  blockExplorers: {
    default: { name: 'PepeScan', url: 'https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz' },
  },
  testnet: true,
};

export const pepeUnchainedMainnet: Chain = {
  id: 97741,
  name: 'Pepe Unchained V2',
  nativeCurrency: {
    name: 'PEPU',
    symbol: 'PEPU',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'] },
    public: { http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'] },
  },
  blockExplorers: {
    default: { name: 'PepeScan', url: 'https://pepuscan.com/' },
  },
  testnet: false,
};

export const config = getDefaultConfig({
  appName: 'Springfield',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [pepeUnchainedMainnet],
  ssr: true,
  transports: {
    [pepeUnchainedMainnet.id]: http(),
  },
}); 