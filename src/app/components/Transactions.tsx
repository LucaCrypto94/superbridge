"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useReadContract, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { Wallet, RefreshCw } from 'lucide-react';

const CORRECT_CHAIN_ID = 97741; // Pepe Unchained V2 mainnet
const SUPERBRIDGE_CONTRACT = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS as `0x${string}`;
const OLD_L2_CONTRACT = "0x0fE9dB3857408402a7C82Dd8b24fB536D5d0c38B" as `0x${string}`;

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
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refundTxHash, setRefundTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundingTransferId, setRefundingTransferId] = useState<string | null>(null);
  const [useOldContract, setUseOldContract] = useState(false);
  const [txIdInput, setTxIdInput] = useState('');
  const [txIdStatus, setTxIdStatus] = useState<{
    transferId: string;
    user: string;
    originalAmount: string;
    bridgedAmount: string;
    timestamp: number;
    status: 'Pending' | 'Completed' | 'Refunded';
    canRefund: boolean;
    refundTime?: number;
  } | null>(null);
  const [checkingTxId, setCheckingTxId] = useState(false);

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
    
    const contractAddress = useOldContract ? OLD_L2_CONTRACT : SUPERBRIDGE_CONTRACT;
    
    console.log('Attempting refund for transferId:', transferId);
    console.log('Contract address:', contractAddress);
    console.log('Using old contract:', useOldContract);
    console.log('Chain ID:', CORRECT_CHAIN_ID);
    
    setRefundError(null);
    setRefundingTransferId(transferId);
    
    writeContract({
      address: contractAddress,
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

  // Function to check specific transaction ID
  const checkTxId = async () => {
    if (!txIdInput.trim()) return;
    
    setCheckingTxId(true);
    setTxIdStatus(null);
    
    try {
      // Select contract based on toggle
      const contractAddress = useOldContract ? OLD_L2_CONTRACT : SUPERBRIDGE_CONTRACT;
      
      // Use fetch to call the contract directly
      const response = await fetch('/api/check-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress,
          transferId: txIdInput,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check transaction');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setTxIdStatus(data);

    } catch (error) {
      console.error('Error checking transaction ID:', error);
      setTxIdStatus(null);
    } finally {
      setCheckingTxId(false);
    }
  };

  // Function to fetch real transactions from the blockchain with batch processing
  const fetchTransactions = async () => {
    if (!address || !isConnected || useOldContract) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Create a provider to query events
      const { createPublicClient, http } = await import('viem');
      
      const client = createPublicClient({
        chain: {
          id: 97741,
          name: 'Pepe Unchained V2 Mainnet',
          network: 'pepu-v2-mainnet',
          nativeCurrency: {
            decimals: 18,
            name: 'PEPU',
            symbol: 'PEPU',
          },
          rpcUrls: {
            default: { http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'] },
            public: { http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'] },
          },
        },
        transport: http(),
      });

      // Get current block number
      const currentBlock = await client.getBlockNumber();
      
      // Select contract address based on toggle
      const contractAddress = useOldContract ? OLD_L2_CONTRACT : SUPERBRIDGE_CONTRACT;
      
      // Optimized batch processing: query only last 10,000 blocks (about 2-3 days)
      const MAX_BLOCKS_TO_QUERY = BigInt(10000);
      const BATCH_SIZE = BigInt(1000); // Larger batches for faster processing
      const DELAY_MS = 2000; // Reduced delay to 2 seconds
      
      let allBridgeInitiatedEvents: any[] = [];
      let allBridgeCompletedEvents: any[] = [];
      let allRefundedEvents: any[] = [];
      
      // Start from current block and go backwards, but limit to MAX_BLOCKS_TO_QUERY
      const startBlock = currentBlock > MAX_BLOCKS_TO_QUERY ? currentBlock - MAX_BLOCKS_TO_QUERY : BigInt(0);
      let fromBlock = currentBlock;
      let batchCount = 0;
      const estimatedBatches = Math.ceil(Number(currentBlock - startBlock) / Number(BATCH_SIZE));
      
      console.log(`🔄 Starting optimized batch query from block ${currentBlock} to ${startBlock}...`);
      console.log(`📊 Estimated ${estimatedBatches} batches to process`);
      console.log(`📋 Using contract: ${contractAddress} (${useOldContract ? 'Old L2' : 'Current L2'})`);
      
      while (fromBlock > startBlock) {
        const toBlock = fromBlock;
        fromBlock = fromBlock > BATCH_SIZE ? fromBlock - BATCH_SIZE : startBlock;
        
        batchCount++;
        console.log(`📦 Batch ${batchCount}: Querying blocks ${fromBlock} to ${toBlock}...`);
        
        // Update progress
        setBatchProgress({ current: batchCount, total: estimatedBatches });
        
        try {
          // Query BridgeInitiated events for this batch
      const bridgeInitiatedEvents = await client.getLogs({
        address: contractAddress,
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
            toBlock
      });

          // Query BridgeCompleted events for this batch
      const bridgeCompletedEvents = await client.getLogs({
        address: contractAddress,
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
            toBlock
      });

          // Query Refunded events for this batch
      const refundedEvents = await client.getLogs({
        address: contractAddress,
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
            toBlock
          });

          // Add events to our collection
          allBridgeInitiatedEvents.push(...bridgeInitiatedEvents);
          allBridgeCompletedEvents.push(...bridgeCompletedEvents);
          allRefundedEvents.push(...refundedEvents);
          
          console.log(`✅ Batch ${batchCount} completed: Found ${bridgeInitiatedEvents.length} bridge events`);
          
          // Add delay between batches (except for the last batch)
          if (fromBlock > startBlock) {
            console.log(`⏳ Waiting ${DELAY_MS/1000}s before next batch...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          }
          
        } catch (batchError) {
          console.error(`❌ Error in batch ${batchCount}:`, batchError);
          // Continue with next batch instead of failing completely
          if (fromBlock > startBlock) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          }
        }
      }
      
      console.log(`🎉 Batch query completed! Total events found: ${allBridgeInitiatedEvents.length} bridge, ${allBridgeCompletedEvents.length} completed, ${allRefundedEvents.length} refunded`);
      
      // Clear progress indicator
      setBatchProgress(null);
      
      // Use the collected events
      const bridgeInitiatedEvents = allBridgeInitiatedEvents;
      const bridgeCompletedEvents = allBridgeCompletedEvents;
      const refundedEvents = allRefundedEvents;

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
    if (isConnected && !isWrongNetwork && !useOldContract) {
      fetchTransactions();
    }
  }, [address, isConnected, isWrongNetwork, useOldContract]);

  // Handle refund success
  useEffect(() => {
    if (isRefundTxSuccess && refundTxHash) {
      setRefundingTransferId(null);
      setRefundTxHash(undefined);
      // Refresh transactions to update status (only for current contract)
      if (!useOldContract) {
        fetchTransactions();
      }
    }
  }, [isRefundTxSuccess, refundTxHash, useOldContract]);

  // Countdown timer for pending transactions
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update countdown timers
      setTransactions(prev => [...prev]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0e0f]">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content */}
      <div className="relative pt-4 px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-yellow-400 mb-2">Transaction History</h1>
            <p className="text-gray-400">View and manage your bridge transactions</p>
            
            {/* Contract Toggle Button */}
            <div className="mt-6 flex justify-center">
              <div className="backdrop-blur-sm bg-white/[0.03] rounded-2xl p-4 border border-white/[0.1] shadow-inner">
                <button
                  onClick={() => {
                    setUseOldContract(!useOldContract);
                    setTxIdStatus(null);
                    setTxIdInput('');
                  }}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                    useOldContract 
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600 shadow-lg shadow-orange-500/20' 
                      : 'bg-white/[0.05] text-white border border-white/[0.1] hover:bg-white/[0.08]'
                  }`}
                >
                  {useOldContract ? 'Old L2 Contract' : 'Current L2 Contract'}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {useOldContract 
                ? 'Enter a transaction ID to check refund status' 
                : 'Viewing transactions from the current L2 contract'
              }
            </p>
          </div>
          
          {/* Transaction ID Input for Old Contract */}
          {useOldContract && isConnected && !isWrongNetwork && (
            <div className="max-w-2xl mx-auto mb-8">
              <div className="backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-2xl p-6 shadow-inner">
                <h3 className="text-xl font-semibold text-yellow-400 mb-4">Check Old L2 Transaction</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Transaction ID
                    </label>
                    <input
                      type="text"
                      value={txIdInput}
                      onChange={(e) => setTxIdInput(e.target.value)}
                      placeholder="Enter transaction ID (0x...)"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={checkTxId}
                    disabled={!txIdInput.trim() || checkingTxId}
                    className="w-full bg-yellow-400 text-black font-medium py-3 px-4 rounded-lg hover:bg-yellow-300 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
                  >
                    {checkingTxId ? 'Checking...' : 'Check Transaction'}
                  </button>
                </div>
                
                {/* Transaction Status Display */}
                {txIdStatus && (
                  <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
                    <h4 className="text-lg font-semibold text-white mb-3">Transaction Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Transfer ID:</span>
                        <span className="text-white font-mono">{txIdStatus.transferId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">User:</span>
                        <span className="text-white font-mono">{txIdStatus.user}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Original Amount:</span>
                        <span className="text-white">{formatTokenAmount(txIdStatus.originalAmount)} PEPU</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Bridged Amount:</span>
                        <span className="text-white">{formatTokenAmount(txIdStatus.bridgedAmount)} PEPU</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className={`font-semibold ${getStatusColor(txIdStatus.status)}`}>
                          {txIdStatus.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Can Refund:</span>
                        <span className={`font-semibold ${txIdStatus.canRefund ? 'text-green-400' : 'text-red-400'}`}>
                          {txIdStatus.canRefund ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Refund Button */}
                    {txIdStatus.canRefund && txIdStatus.status === 'Pending' && (
                      <div className="mt-4 pt-4 border-t border-gray-600">
                        <button
                          onClick={() => handleRefund(txIdStatus.transferId)}
                          disabled={isRefundPending || refundingTransferId === txIdStatus.transferId}
                          className="w-full bg-green-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
                        >
                          {isRefundPending && refundingTransferId === txIdStatus.transferId 
                            ? 'Processing Refund...' 
                            : 'Claim Refund'
                          }
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {!isConnected && (
            <div className="backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-2xl p-8 text-center shadow-inner">
              <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400 mb-6">Please connect your wallet to view transaction history</p>
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
                    className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold px-6 py-3 rounded-xl hover:scale-[1.02] shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center gap-2 mx-auto"
                  >
                    <Wallet className="w-5 h-5" />
                    <span>Connect Wallet</span>
                  </button>
                )}
              </ConnectButton.Custom>
            </div>
          )}

          {isWrongNetwork && (
            <div className="backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-2xl p-8 text-center shadow-inner">
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
              {/* Transaction ID Input for Current Contract */}
              {!useOldContract && (
                <div className="max-w-2xl mx-auto mb-8">
                  <div className="backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-2xl p-6 shadow-inner">
                    <h3 className="text-xl font-semibold text-yellow-400 mb-4">Check Specific Transaction</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Transaction ID (Optional)
                        </label>
                        <input
                          type="text"
                          value={txIdInput}
                          onChange={(e) => setTxIdInput(e.target.value)}
                          placeholder="Enter transaction ID to check refund status (0x...)"
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-yellow-400 focus:outline-none"
                        />
                      </div>
                      {txIdInput.trim() && (
                        <button
                          onClick={checkTxId}
                          disabled={checkingTxId}
                          className="w-full bg-yellow-400 text-black font-medium py-3 px-4 rounded-lg hover:bg-yellow-300 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
                        >
                          {checkingTxId ? 'Checking...' : 'Check Transaction'}
                        </button>
                      )}
                    </div>
                    
                    {/* Transaction Status Display */}
                    {txIdStatus && (
                      <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
                        <h4 className="text-lg font-semibold text-white mb-3">Transaction Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Transfer ID:</span>
                            <span className="text-white font-mono">{txIdStatus.transferId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">User:</span>
                            <span className="text-white font-mono">{txIdStatus.user}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Original Amount:</span>
                            <span className="text-white">{formatTokenAmount(txIdStatus.originalAmount)} PEPU</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Bridged Amount:</span>
                            <span className="text-white">{formatTokenAmount(txIdStatus.bridgedAmount)} PEPU</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Status:</span>
                            <span className={`font-semibold ${getStatusColor(txIdStatus.status)}`}>
                              {txIdStatus.status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Can Refund:</span>
                            <span className={`font-semibold ${txIdStatus.canRefund ? 'text-green-400' : 'text-red-400'}`}>
                              {txIdStatus.canRefund ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Refund Button */}
                        {txIdStatus.canRefund && txIdStatus.status === 'Pending' && (
                          <div className="mt-4 pt-4 border-t border-gray-600">
                            <button
                              onClick={() => handleRefund(txIdStatus.transferId)}
                              disabled={isRefundPending || refundingTransferId === txIdStatus.transferId}
                              className="w-full bg-green-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
                            >
                              {isRefundPending && refundingTransferId === txIdStatus.transferId 
                                ? 'Processing Refund...' 
                                : 'Claim Refund'
                              }
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {loading && (
                <div className="backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-2xl p-8 text-center shadow-inner">
                  <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
                  </div>
                  <h3 className="text-xl font-semibold text-yellow-400 mb-2">Loading Transactions</h3>
                  <p className="text-gray-400">Fetching your transaction history...</p>
                  {batchProgress && (
                    <div className="mt-4">
                      <div className="text-sm text-gray-400 mb-2">
                        Batch {batchProgress.current} of {batchProgress.total}
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-yellow-400 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Processing blocks in batches to avoid RPC overload...
                      </div>
                    </div>
                  )}
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
                <div className="bg-gradient-to-r from-red-900/90 to-pink-900/90 border-2 border-red-400 rounded-xl p-4 mb-4 text-red-100 text-center shadow-lg">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center mr-2">
                      <span className="text-white text-lg">❌</span>
                    </div>
                    <div className="font-bold text-lg">Refund Failed</div>
                  </div>
                  
                  <div className="text-sm mb-3 bg-black/30 rounded-lg p-2">
                    {refundError}
                  </div>
                  
                  <button 
                    onClick={() => setRefundError(null)} 
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              {isRefundTxLoading && refundTxHash && (
                <div className="bg-gradient-to-r from-blue-900/90 to-indigo-900/90 border-2 border-blue-400 rounded-xl p-4 mb-4 text-blue-100 text-center shadow-lg">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-2 animate-pulse">
                      <span className="text-white text-lg">⏳</span>
                    </div>
                    <div className="font-bold text-lg">Refund Transaction Pending</div>
                  </div>
                  
                  <div className="text-sm mb-3">
                    Your refund transaction is being processed on Pepe Unchained V2 mainnet...
                  </div>
                  
                  <div className="bg-black/40 rounded-lg p-2 mb-3">
                    <div className="text-xs text-gray-300 mb-1">Transaction Hash:</div>
                    <a 
                      href={`https://pepuscan.com/tx/${refundTxHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="font-mono text-xs text-yellow-300 hover:text-yellow-200 underline break-all"
                    >
                      {refundTxHash}
                    </a>
                  </div>
                  
                  <div className="text-xs text-gray-300">
                    🔄 Please wait while we confirm your refund...
                  </div>
                </div>
              )}
              
              {isRefundTxSuccess && refundTxHash && (
                <div className="bg-gradient-to-r from-green-900/90 to-emerald-900/90 border-2 border-green-400 rounded-xl p-4 mb-4 text-green-100 text-center shadow-lg">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
                      <span className="text-white text-lg">✓</span>
                    </div>
                    <div className="font-bold text-lg">Refund Successful!</div>
                  </div>
                  
                  <div className="text-sm mb-3">
                    Your refund has been processed successfully on Pepe Unchained V2 mainnet.
                  </div>
                  
                  <div className="bg-black/40 rounded-lg p-2 mb-3">
                    <div className="text-xs text-gray-300 mb-1">Transaction Hash:</div>
                    <a 
                      href={`https://pepuscan.com/tx/${refundTxHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="font-mono text-xs text-yellow-300 hover:text-yellow-200 underline break-all"
                    >
                      {refundTxHash}
                    </a>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setRefundTxHash(undefined);
                      fetchTransactions();
                    }} 
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
                  >
                    View Updated Transactions
                  </button>
                </div>
              )}

              {!loading && !error && transactions.length === 0 && (
                <div className="backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-2xl p-8 text-center shadow-inner">
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
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-2xl overflow-hidden shadow-inner">
                    <div className="backdrop-blur-sm bg-white/[0.05] px-6 py-4 border-b border-white/[0.1]">
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
                                  <div className="font-mono text-sm backdrop-blur-sm bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1 inline-block w-fit">
                                    {tx.transferId.slice(0, 8)}...{tx.transferId.slice(-6)}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {formatTimestamp(tx.timestamp)}
                                  </div>
                                  {tx.txHash && (
                                    <a
                                      href={`https://pepuscan.com/tx/${tx.txHash}`}
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

                  {/* Mobile Card View */}
                  <div className="md:hidden">
                    <div className="text-center mb-4">
                      <p className="text-gray-400 text-sm">Found {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="space-y-2">
                      {transactions.map((tx, index) => (
                        <div key={tx.transferId} className="backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-2xl p-3">
                          <div className="flex items-center justify-between">
                            {/* Left: ID and Amount */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-mono text-xs backdrop-blur-sm bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1">
                                  {tx.transferId.slice(0, 4)}...{tx.transferId.slice(-4)}
                                </div>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                                  {tx.status === 'Pending' && <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-1 animate-pulse"></div>}
                                  {tx.status === 'Completed' && <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></div>}
                                  {tx.status === 'Refunded' && <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1"></div>}
                                  {tx.status}
                                </span>
                              </div>
                              <div className="text-sm font-medium text-white">
                                {formatTokenAmount(tx.originalAmount)} → {formatTokenAmount(tx.bridgedAmount)} PEPU
                              </div>
                              <div className="text-xs text-gray-400">
                                {formatTimestamp(tx.timestamp)}
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex flex-col items-end gap-1 ml-2">
                              {tx.status === 'Pending' && (
                                <>
                                  <div className="text-xs text-gray-400 text-right">
                                    {isRefundAvailable(tx.timestamp) ? 'Ready' : formatCountdown(tx.timestamp)}
                                  </div>
                                  <button
                                    className={`text-xs px-3 py-1.5 rounded border transition-all duration-200 ${
                                      isRefundAvailable(tx.timestamp) && refundingTransferId !== tx.transferId
                                        ? 'bg-[#16a34a] text-yellow-400 border-yellow-400 hover:bg-[#15803d]'
                                        : 'bg-gray-600 text-gray-400 border-gray-600 cursor-not-allowed'
                                    }`}
                                    disabled={!isRefundAvailable(tx.timestamp) || refundingTransferId === tx.transferId || isRefundPending}
                                    onClick={() => handleRefund(tx.transferId)}
                                  >
                                    {refundingTransferId === tx.transferId || isRefundPending ? '...' : 'Refund'}
                                  </button>
                                </>
                              )}
                              {tx.status === 'Completed' && (
                                <span className="inline-flex items-center text-green-400 text-xs bg-green-400/10 rounded px-2 py-1">
                                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></div>
                                  ✓ Done
                                </span>
                              )}
                              {tx.status === 'Refunded' && (
                                <span className="inline-flex items-center text-red-400 text-xs bg-red-400/10 rounded px-2 py-1">
                                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1"></div>
                                  ↩ Done
                                </span>
                              )}
                              {tx.txHash && (
                                <a
                                  href={`https://pepuscan.com/tx/${tx.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-yellow-400 hover:text-yellow-300 underline text-xs"
                                >
                                  Explorer
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

                      <div className="mt-8 text-center">
                        <button
                          onClick={() => {
                            if (!useOldContract) {
                              fetchTransactions();
                            }
                          }}
                          disabled={loading || useOldContract}
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