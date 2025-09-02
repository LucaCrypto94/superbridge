"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ExternalLink } from 'lucide-react';

const PENKMARKET_CONTRACT = "0x8a6134Bd33367ee152b4a1178652c9053eda6D57" as `0x${string}`;
const CORRECT_CHAIN_ID = 1; // Ethereum mainnet

// Contract ABI for refund functionality
const CONTRACT_ABI = [
  {
    "inputs": [{ "name": "user", "type": "address" }],
    "name": "getUserTransactions",
    "outputs": [{ "name": "", "type": "string[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "txid", "type": "string" }],
    "name": "getTransaction",
    "outputs": [
      {
        "components": [
          { "name": "user", "type": "address" },
          { "name": "tokenAddress", "type": "address" },
          { "name": "amount", "type": "uint256" },
          { "name": "timestamp", "type": "uint256" },
          { "name": "status", "type": "uint8" },
          { "name": "tokenType", "type": "string" }
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "txid", "type": "string" }],
    "name": "refundTransaction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

interface Transaction {
  user: string;
  tokenAddress: string;
  amount: bigint;
  timestamp: bigint;
  status: number; // 0: PENDING, 1: COMPLETED, 2: REFUNDED
  tokenType: string;
}

const STATUS_MAP = {
  0: { text: "Pending", color: "text-yellow-400", bg: "bg-yellow-900/30" },
  1: { text: "Completed", color: "text-green-400", bg: "bg-green-900/30" },
  2: { text: "Refunded", color: "text-blue-400", bg: "bg-blue-900/30" }
};

export default function RefundsPage() {
  const { address, isConnected } = useAccount();
  const [userTxIds, setUserTxIds] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refundingTx, setRefundingTx] = useState<string | null>(null);

  const { writeContract, isPending, data: writeData, error: writeError } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: writeData,
    chainId: CORRECT_CHAIN_ID,
  });

  // Get user's transaction IDs
  const { data: txIds, refetch: refetchTxIds } = useReadContract({
    address: PENKMARKET_CONTRACT,
    abi: CONTRACT_ABI,
    functionName: "getUserTransactions",
    args: address ? [address] : undefined,
    chainId: CORRECT_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  // Fetch transaction details for each ID
  useEffect(() => {
    if (txIds && Array.isArray(txIds) && txIds.length > 0) {
      setUserTxIds(txIds as string[]);
      fetchTransactionDetails(txIds as string[]);
    }
  }, [txIds]);

  const fetchTransactionDetails = async (txIds: string[]) => {
    setLoading(true);
    try {
      const txDetails = await Promise.all(
        txIds.map(async (txId) => {
          try {
            const response = await fetch('/api/get-transaction', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ txid: txId })
            });
            const data = await response.json();
            return data.success ? data.transaction : null;
          } catch (error) {
            console.error(`Error fetching transaction ${txId}:`, error);
            return null;
          }
        })
      );
      
      setTransactions(txDetails.filter(tx => tx !== null));
    } catch (error) {
      console.error('Error fetching transaction details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (txId: string) => {
    if (!address) return;
    
    setRefundingTx(txId);
    try {
      writeContract({
        address: PENKMARKET_CONTRACT,
        abi: CONTRACT_ABI,
        functionName: "refundTransaction",
        args: [txId],
        chainId: CORRECT_CHAIN_ID,
        gas: BigInt(300000),
      });
    } catch (error) {
      console.error('Refund error:', error);
      setRefundingTx(null);
    }
  };

  // Handle successful refund
  useEffect(() => {
    if (isTxSuccess && refundingTx) {
      setRefundingTx(null);
      // Refresh transactions
      refetchTxIds();
    }
  }, [isTxSuccess, refundingTx, refetchTxIds]);

  const formatAmount = (amount: bigint, tokenType: string) => {
    const decimals = tokenType === 'USDC' ? 6 : 18;
    return (Number(amount) / Math.pow(10, decimals)).toFixed(6);
  };

  const formatTimestamp = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-gray-300 mb-6">Connect your wallet to view and manage your transactions</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/penkmarket" 
              className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to PenkMarket
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white">Transaction History & Refunds</h1>
          <button
            onClick={() => refetchTxIds()}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Transactions List */}
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto"></div>
              <p className="text-gray-300 mt-4">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-300 text-lg">No transactions found</p>
              <p className="text-gray-400 mt-2">Your transaction history will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx, index) => {
                const status = STATUS_MAP[tx.status as keyof typeof STATUS_MAP];
                const canRefund = tx.status === 0; // Only pending transactions can be refunded
                
                return (
                  <div key={index} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">Transaction #{index + 1}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.text}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatTimestamp(tx.timestamp)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Token Type</p>
                        <p className="font-mono text-white">{tx.tokenType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Amount</p>
                        <p className="font-mono text-white">{formatAmount(tx.amount, tx.tokenType)} {tx.tokenType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Token Address</p>
                        <p className="font-mono text-xs text-gray-300 break-all">
                          {tx.tokenAddress === '0x0000000000000000000000000000000000000000' ? 'ETH' : tx.tokenAddress}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-400">
                        User: <span className="font-mono text-white">{tx.user}</span>
                      </div>
                      
                      {canRefund && (
                        <button
                          onClick={() => handleRefund(userTxIds[index])}
                          disabled={refundingTx === userTxIds[index] || isPending || isTxLoading}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                          {refundingTx === userTxIds[index] || isPending || isTxLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Processing...
                            </>
                          ) : (
                            'Request Refund'
                          )}
                        </button>
                      )}
                    </div>

                    {writeError && refundingTx === userTxIds[index] && (
                      <div className="mt-4 p-3 bg-red-900/30 border border-red-500 rounded-lg">
                        <p className="text-red-300 text-sm">
                          Error: {writeError.message}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="bg-blue-900/30 border border-blue-500 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-300 mb-3">About Refunds</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>• Only pending transactions can be refunded</li>
              <li>• Refunds are processed by the verifier</li>
              <li>• Completed transactions cannot be refunded</li>
              <li>• Refunded transactions will show as "Refunded" status</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
