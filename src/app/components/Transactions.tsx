"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useReadContract, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { Wallet, RefreshCw } from 'lucide-react';

const CORRECT_CHAIN_ID = 97740; // Pepe Unchained V2 testnet
const SUPERBRIDGE_CONTRACT = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS as `0x${string}`;

// ABI for the functions we need
const SUPERBRIDGE_ABI = [
  {
    "inputs": [{"name": "transferId", "type": "bytes32"}],
    "name": "getTransfer",
    "outputs": [
      {
        "components": [
          {"name": "user", "type": "address"},
          {"name": "originalAmount", "type": "uint256"},
          {"name": "bridgedAmount", "type": "uint256"},
          {"name": "timestamp", "type": "uint256"},
          {"name": "status", "type": "uint8"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "transferId", "type": "bytes32"}],
    "name": "refund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "transferId", "type": "bytes32"}],
    "name": "canRefund",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "transferId", "type": "bytes32"}],
    "name": "getRefundTime",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "user", "type": "address"},
      {"indexed": false, "name": "originalAmount", "type": "uint256"},
      {"indexed": false, "name": "bridgedAmount", "type": "uint256"},
      {"indexed": false, "name": "transferId", "type": "bytes32"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "BridgeInitiated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "transferId", "type": "bytes32"},
      {"indexed": false, "name": "user", "type": "address"},
      {"indexed": false, "name": "bridgedAmount", "type": "uint256"}
    ],
    "name": "BridgeCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "transferId", "type": "bytes32"},
      {"indexed": false, "name": "user", "type": "address"},
      {"indexed": false, "name": "amount", "type": "uint256"}
    ],
    "name": "Refunded",
    "type": "event"
  }
];

interface Transaction {
  transferId: string;
  originalAmount: string;
  bridgedAmount: string;
  timestamp: number;
  status: 'Pending' | 'Completed' | 'Refunded';
  txHash?: string;
  canRefund?: boolean;
  refundTime?: number;
}

function formatTokenAmount(raw: string | bigint) {
  if (!raw) return "0.000";
  const num = typeof raw === 'bigint' ? Number(raw) / 10 ** 18 : Number(raw) / 10 ** 18;
  return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Pending':
      return 'text-yellow-400';
    case 'Completed':
      return 'text-green-400';
    case 'Refunded':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export default function Transactions() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refundTxHash, setRefundTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundingTransferId, setRefundingTransferId] = useState<string | null>(null);

  const { writeContract, isPending: isRefundPending, data: writeData, error: writeError } = useWriteContract();
  const { isLoading: isRefundTxLoading, isSuccess: isRefundTxSuccess } = useWaitForTransactionReceipt({
    hash: refundTxHash,
    chainId: CORRECT_CHAIN_ID,
  });

  const isWrongNetwork = isConnected && chainId !== CORRECT_CHAIN_ID;

  // Handle writeContract data (transaction hash)
  useEffect(() => {
    if (writeData) {
      console.log('Refund transaction hash:', writeData);
      setRefundTxHash(writeData);
    }
  }, [writeData]);

  // Handle writeContract errors
  useEffect(() => {
    if (writeError) {
      console.error('WriteContract error:', writeError);
      setRefundError(writeError.message || 'Failed to initiate refund transaction');
      setRefundingTransferId(null);
    }
  }, [writeError]);

  // Function to handle refund
  const handleRefund = (transferId: string) => {
    if (!address || !isConnected) {
      console.error('Wallet not connected');
      return;
    }
    
    console.log('Attempting refund for transferId:', transferId);
    console.log('Contract address:', SUPERBRIDGE_CONTRACT);
    console.log('Chain ID:', CORRECT_CHAIN_ID);
    
    setRefundError(null);
    setRefundingTransferId(transferId);
    
    writeContract({
      address: SUPERBRIDGE_CONTRACT,
      abi: SUPERBRIDGE_ABI,
      functionName: 'refund',
      args: [transferId as `0x${string}`],
      chainId: CORRECT_CHAIN_ID,
    });
  };

  // Function to format countdown timer
  const formatCountdown = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const refundTime = timestamp + 30 * 60; // 30 minutes timeout
    const timeLeft = refundTime - now;
    
    if (timeLeft <= 0) return 'Ready to refund';
    
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Function to check if refund is available
  const isRefundAvailable = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const refundTime = timestamp + 30 * 60; // 30 minutes timeout
    return now >= refundTime;
  };

  const navLinks = [
    { label: 'About', href: '#about' },
    { label: 'Bridge', href: '/#bridge' },
    { label: 'Pools', href: '#pools' },
    { label: 'Transactions', href: '/transactions' },
    { label: 'Explorer', href: '#explorer' },
  ];
  const [selectedNav, setSelectedNav] = useState(navLinks[3]); // Transactions is selected

  // Function to fetch real transactions from the blockchain
  const fetchTransactions = async () => {
    if (!address || !isConnected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Create a provider to query events
      const { createPublicClient, http } = await import('viem');
      
      const client = createPublicClient({
        chain: {
          id: 97740,
          name: 'Pepe Unchained V2 Testnet',
          network: 'pepu-v2-testnet-vn4qxxp9og',
          nativeCurrency: {
            decimals: 18,
            name: 'PEPU',
            symbol: 'PEPU',
          },
          rpcUrls: {
            default: { http: ['https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz'] },
            public: { http: ['https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz'] },
          },
        },
        transport: http(),
      });

      // Get current block number
      const currentBlock = await client.getBlockNumber();
      
      // Query BridgeInitiated events for the user (last 1000 blocks)
      const fromBlock = currentBlock - BigInt(1000);
      
      const bridgeInitiatedEvents = await client.getLogs({
        address: SUPERBRIDGE_CONTRACT,
        event: {
          type: 'event',
          name: 'BridgeInitiated',
          inputs: [
            { type: 'address', name: 'user', indexed: true },
            { type: 'uint256', name: 'originalAmount', indexed: false },
            { type: 'uint256', name: 'bridgedAmount', indexed: false },
            { type: 'bytes32', name: 'transferId', indexed: false },
            { type: 'uint256', name: 'timestamp', indexed: false }
          ]
        },
        args: {
          user: address
        },
        fromBlock,
        toBlock: currentBlock
      });

      const bridgeCompletedEvents = await client.getLogs({
        address: SUPERBRIDGE_CONTRACT,
        event: {
          type: 'event',
          name: 'BridgeCompleted',
          inputs: [
            { type: 'bytes32', name: 'transferId', indexed: true },
            { type: 'address', name: 'user', indexed: false },
            { type: 'uint256', name: 'bridgedAmount', indexed: false }
          ]
        },
        fromBlock,
        toBlock: currentBlock
      });

      const refundedEvents = await client.getLogs({
        address: SUPERBRIDGE_CONTRACT,
        event: {
          type: 'event',
          name: 'Refunded',
          inputs: [
            { type: 'bytes32', name: 'transferId', indexed: true },
            { type: 'address', name: 'user', indexed: false },
            { type: 'uint256', name: 'amount', indexed: false }
          ]
        },
        fromBlock,
        toBlock: currentBlock
      });

      // Process events and create transaction objects
      const txMap = new Map<string, Transaction>();

      // Process BridgeInitiated events
      bridgeInitiatedEvents.forEach(event => {
        const transferId = event.args.transferId as string;
        txMap.set(transferId, {
          transferId,
          originalAmount: event.args.originalAmount?.toString() || '0',
          bridgedAmount: event.args.bridgedAmount?.toString() || '0',
          timestamp: Number(event.args.timestamp) || 0,
          status: 'Pending',
          txHash: event.transactionHash
        });
      });

      // Update status for completed transactions
      bridgeCompletedEvents.forEach(event => {
        const transferId = event.args.transferId as string;
        const tx = txMap.get(transferId);
        if (tx) {
          tx.status = 'Completed';
        }
      });

      // Update status for refunded transactions
      refundedEvents.forEach(event => {
        const transferId = event.args.transferId as string;
        const tx = txMap.get(transferId);
        if (tx) {
          tx.status = 'Refunded';
        }
      });

      // Convert map to array and sort by timestamp (newest first)
      const txArray = Array.from(txMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(txArray);

    } catch (err) {
      setError('Failed to fetch transactions');
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && !isWrongNetwork) {
      fetchTransactions();
    }
  }, [address, isConnected, isWrongNetwork]);

  // Handle refund success
  useEffect(() => {
    if (isRefundTxSuccess && refundTxHash) {
      setRefundingTransferId(null);
      setRefundTxHash(undefined);
      // Refresh transactions to update status
      fetchTransactions();
    }
  }, [isRefundTxSuccess, refundTxHash]);

  // Countdown timer for pending transactions
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update countdown timers
      setTransactions(prev => [...prev]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Navbar/Header */}
      <nav className="fixed top-0 left-0 w-full bg-[#181818] border-b border-yellow-400 z-50 flex items-center justify-between px-3 sm:px-6 h-12 sm:h-14">
        {/* Left: Brand */}
        <div className="text-yellow-400 font-bold text-lg sm:text-xl">SuperBridge</div>
        {/* Center: Nav Links or Dropdown */}
        <div className="mx-auto">
          {/* Desktop Nav */}
          <div className="hidden sm:flex gap-3 sm:gap-6 text-xs sm:text-sm font-medium">
            {navLinks.map((link) => (
              link.href.startsWith('/') ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`transition-colors ${selectedNav.label === link.label ? 'text-yellow-400 border-b-2 border-yellow-400 pb-1' : 'text-gray-300 hover:text-yellow-400'}`}
                  onClick={() => setSelectedNav(link)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className={`transition-colors ${selectedNav.label === link.label ? 'text-yellow-400 border-b-2 border-yellow-400 pb-1' : 'text-gray-300 hover:text-yellow-400'}`}
                  onClick={() => setSelectedNav(link)}
                >
                  {link.label}
                </a>
              )
            ))}
          </div>
          {/* Mobile Dropdown */}
          <div className="relative flex sm:hidden">
            <button
              className="flex items-center gap-2 text-sm font-medium text-yellow-400 bg-[#181818] rounded px-3 py-2"
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-dropdown"
            >
              {selectedNav.label}
              <svg className={`w-4 h-4 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {mobileNavOpen && (
              <div id="mobile-nav-dropdown" className="absolute left-0 top-full mt-1 w-32 bg-[#232323] border border-yellow-400 rounded shadow-lg z-10">
                {navLinks.map((link) => (
                  link.href.startsWith('/') ? (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`block px-4 py-2 text-sm ${selectedNav.label === link.label ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                      onClick={() => {
                        setSelectedNav(link);
                        setMobileNavOpen(false);
                      }}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.label}
                      href={link.href}
                      className={`block px-4 py-2 text-sm ${selectedNav.label === link.label ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                      onClick={() => {
                        setSelectedNav(link);
                        setMobileNavOpen(false);
                      }}
                    >
                      {link.label}
                    </a>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Right: Custom Connect Button */}
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, mounted }) => (
            <button
              onClick={
                !mounted
                  ? undefined
                  : !account || !chain
                  ? openConnectModal
                  : openAccountModal
              }
              className="flex items-center gap-2 bg-yellow-400 text-black font-medium text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-yellow-300 transition-colors"
            >
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />
              {!mounted
                ? 'Connect'
                : !account || !chain
                ? 'Connect Wallet'
                : account.displayName}
            </button>
          )}
        </ConnectButton.Custom>
      </nav>

      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white pt-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-yellow-400 mb-2">Transaction History</h1>
            <p className="text-gray-400">View and manage your bridge transactions</p>
          </div>
          
          {!isConnected && (
            <div className="bg-gradient-to-r from-[#181818] to-[#1a1a1a] border border-yellow-400 rounded-xl p-8 text-center shadow-lg">
              <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400">Please connect your wallet to view transaction history</p>
            </div>
          )}

          {isWrongNetwork && (
            <div className="bg-gradient-to-r from-[#181818] to-[#1a1a1a] border border-red-400 rounded-xl p-8 text-center shadow-lg">
              <div className="w-16 h-16 bg-red-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-red-400 mb-2">Wrong Network</h3>
              <p className="text-red-400">Please switch to Pepe Unchained V2 network to view transactions</p>
            </div>
          )}

          {isConnected && !isWrongNetwork && (
            <>
              {loading && (
                <div className="bg-gradient-to-r from-[#181818] to-[#1a1a1a] border border-yellow-400 rounded-xl p-8 text-center shadow-lg">
                  <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
                  </div>
                  <h3 className="text-xl font-semibold text-yellow-400 mb-2">Loading Transactions</h3>
                  <p className="text-gray-400">Fetching your transaction history...</p>
                </div>
              )}

              {error && (
                <div className="bg-gradient-to-r from-[#181818] to-[#1a1a1a] border border-red-400 rounded-xl p-8 text-center mb-6 shadow-lg">
                  <div className="w-16 h-16 bg-red-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-red-400 mb-2">Error Loading Transactions</h3>
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {/* Refund Transaction Status Messages */}
              {refundError && (
                <div className="bg-red-900/80 border border-red-400 rounded-lg p-3 mb-2 text-red-200 text-xs text-center">
                  <div className="font-bold mb-1">❌ Refund Error</div>
                  <div>{refundError}</div>
                </div>
              )}
              
              {isRefundTxLoading && refundTxHash && (
                <div className="bg-blue-900/80 border border-blue-400 rounded-lg p-3 mb-2 text-blue-200 text-xs text-center">
                  <div className="font-bold mb-1">⏳ Refund Transaction Pending</div>
                  <div className="break-all mt-1">
                    Tx: <a 
                      href={`https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz/tx/${refundTxHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="underline text-yellow-300"
                    >
                      {refundTxHash.slice(0, 10)}...{refundTxHash.slice(-6)}
                    </a>
                  </div>
                </div>
              )}
              
              {isRefundTxSuccess && refundTxHash && (
                <div className="bg-green-900/80 border border-green-400 rounded-lg p-3 mb-2 text-green-200 text-xs text-center">
                  <div className="font-bold mb-1">✅ Refund Successful!</div>
                  <div className="break-all mt-1">
                    Tx: <a 
                      href={`https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz/tx/${refundTxHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="underline text-yellow-300"
                    >
                      {refundTxHash.slice(0, 10)}...{refundTxHash.slice(-6)}
                    </a>
                  </div>
                </div>
              )}

              {!loading && !error && transactions.length === 0 && (
                <div className="bg-gradient-to-r from-[#181818] to-[#1a1a1a] border border-yellow-400 rounded-xl p-8 text-center shadow-lg">
                  <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-yellow-400 mb-2">No Transactions Found</h3>
                  <p className="text-gray-400 mb-2">No transactions found for this wallet</p>
                  <p className="text-gray-500 text-sm">Bridge some assets to see your transaction history</p>
                </div>
              )}

              {!loading && !error && transactions.length > 0 && (
                <div className="bg-gradient-to-r from-[#181818] to-[#1a1a1a] border border-yellow-400 rounded-xl overflow-hidden shadow-lg">
                  <div className="bg-gradient-to-r from-[#232323] to-[#252525] px-6 py-4 border-b border-yellow-400/20">
                    <p className="text-gray-400 text-sm">Found {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-[#1f1f1f] to-[#212121]">
                        <tr>
                          <th className="px-4 py-3 text-left text-yellow-400 font-semibold text-sm uppercase tracking-wider">Transaction</th>
                          <th className="px-4 py-3 text-left text-yellow-400 font-semibold text-sm uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-3 text-left text-yellow-400 font-semibold text-sm uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-yellow-400 font-semibold text-sm uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx, index) => (
                          <tr key={tx.transferId} className={`border-t border-gray-700/50 hover:bg-[#1f1f1f]/50 transition-colors ${index % 2 === 0 ? 'bg-[#181818]/50' : 'bg-[#1a1a1a]/50'}`}>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <div className="font-mono text-sm bg-[#232323] rounded-lg px-3 py-1 inline-block w-fit">
                                  {tx.transferId.slice(0, 8)}...{tx.transferId.slice(-6)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {formatTimestamp(tx.timestamp)}
                                </div>
                                {tx.txHash && (
                                  <a
                                    href={`https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz/tx/${tx.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-yellow-400 hover:text-yellow-300 underline text-xs mt-1 inline-block"
                                  >
                                    View on Explorer
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <div className="font-semibold text-white">
                                  {formatTokenAmount(tx.originalAmount)} → {formatTokenAmount(tx.bridgedAmount)}
                                </div>
                                <div className="text-xs text-gray-400">PEPU</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                                {tx.status === 'Pending' && (
                                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
                                )}
                                {tx.status === 'Completed' && (
                                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                                )}
                                {tx.status === 'Refunded' && (
                                  <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                                )}
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {tx.status === 'Pending' && (
                                <div className="flex flex-col gap-2">
                                  <div className="text-xs text-gray-400">
                                    {isRefundAvailable(tx.timestamp) ? 'Ready to refund' : `Refund in: ${formatCountdown(tx.timestamp)}`}
                                  </div>
                                  <button
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                                      isRefundAvailable(tx.timestamp) && refundingTransferId !== tx.transferId
                                        ? 'bg-[#16a34a] text-yellow-400 border-yellow-400 hover:bg-[#15803d] hover:scale-105 active:scale-95'
                                        : 'bg-gray-600 text-gray-400 border-gray-600 cursor-not-allowed'
                                    }`}
                                    disabled={!isRefundAvailable(tx.timestamp) || refundingTransferId === tx.transferId || isRefundPending}
                                    onClick={() => handleRefund(tx.transferId)}
                                  >
                                    {refundingTransferId === tx.transferId || isRefundPending ? 'Refunding...' : 'Claim Refund'}
                                  </button>
                                </div>
                              )}
                              {tx.status === 'Completed' && (
                                <span className="inline-flex items-center text-green-400 text-xs bg-green-400/10 rounded-lg px-2 py-1">
                                  <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                                  ✓ Done
                                </span>
                              )}
                              {tx.status === 'Refunded' && (
                                <span className="inline-flex items-center text-red-400 text-xs bg-red-400/10 rounded-lg px-2 py-1">
                                  <div className="w-2 h-2 bg-red-400 rounded-full mr-1"></div>
                                  ↩ Refunded
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

                      <div className="mt-8 text-center">
                        <button
                          onClick={fetchTransactions}
                          disabled={loading}
                          className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-semibold rounded-xl hover:from-yellow-300 hover:to-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed mx-auto shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                          {loading ? 'Refreshing...' : 'Refresh Transactions'}
                        </button>
                      </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 