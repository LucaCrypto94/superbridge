"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ExternalLink, Wallet } from 'lucide-react';
import { getTokenNameByAddress } from '@/lib/token-utils';

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
  amount: string; // Changed from bigint to string for proper serialization
  timestamp: string; // Changed from bigint to string for proper serialization
  status: number; // 0: PENDING, 1: COMPLETED, 2: REFUNDED
  tokenType: string;
  transactionHash?: string; // Added transaction hash from API
  outputToken?: string; // Added output token from API
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navLinks = [
    { label: 'SuperBridge', href: '/' },
    { label: 'Penk Market', href: '/penkmarket' },
    { label: 'Transactions', href: '/penkmarket/refunds' },
    { label: 'Listings', href: '/penkmarket/listings' },
    { label: 'Admin', href: '/penkmarket/tokens' },
  ];
  const [selectedNav, setSelectedNav] = useState(navLinks[2]);

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

  // Function to refresh all data
  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Refetch transaction IDs
      const result = await refetchTxIds();
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        // Refetch transaction details
        await fetchTransactionDetails(result.data);
      } else {
        setTransactions([]);
        setUserTxIds([]);
      }
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle successful refund
  useEffect(() => {
    if (isTxSuccess && refundingTx) {
      setRefundingTx(null);
      // Refresh transactions
      handleRefresh();
    }
  }, [isTxSuccess, refundingTx]);

  const formatAmount = (amount: string, tokenType: string) => {
    const decimals = tokenType === 'USDC' ? 6 : 18;
    const numAmount = Number(amount);
    return (numAmount / Math.pow(10, decimals)).toFixed(6);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  return (
    <div>
      {/* Navbar/Header */}
      <nav className="fixed top-0 left-0 w-full bg-[#181818] border-b border-yellow-400 z-50 flex items-center justify-between px-3 sm:px-6 h-12 sm:h-14">
        {/* Left: Brand */}
        <div className="text-yellow-400 font-bold text-lg sm:text-xl">PenkMarket</div>
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
              <div id="mobile-nav-dropdown" className="absolute left-0 top-full mt-1 w-28 bg-[#232323] border border-gray-600 rounded shadow-lg z-10">
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
              type="button"
              className="bg-yellow-400 text-[#181818] font-bold px-3 py-2 sm:px-5 sm:py-2 rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 text-sm sm:text-base"
            >
              <Wallet className="w-4 h-4 sm:w-4 sm:h-4" />
              <span className="block sm:hidden">{account ? 'Connected' : 'Connect'}</span>
              <span className="hidden sm:block">{account ? account.displayName : 'Connect'}</span>
            </button>
          )}
        </ConnectButton.Custom>
      </nav>
      <div
        style={{
          paddingTop: '3.5rem', // h-14 equivalent
        }}
        className="min-h-screen bg-[#181818]"
      >
        <div className="container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div></div>
            <h1 className="text-3xl font-bold text-white">Transaction History & Refunds</h1>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

        {/* Transactions List */}
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-2">Loading Transactions</h3>
              <p className="text-gray-400">Fetching your PenkMarket transaction history...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-2">No Transactions Found</h3>
              <p className="text-gray-400 mb-2">No PenkMarket transactions found for this wallet</p>
              <p className="text-gray-500 text-sm">Bridge some assets from Ethereum to see your transaction history</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="bg-gradient-to-r from-[#232323] to-[#252525] px-6 py-4 border border-yellow-400/20 rounded-xl">
                  <p className="text-gray-400 text-sm">Found {transactions.length} PenkMarket transaction{transactions.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="space-y-4">
                {transactions.map((tx, index) => {
                const status = STATUS_MAP[tx.status as keyof typeof STATUS_MAP];
                const canRefund = tx.status === 0; // Only pending transactions can be refunded
                
                return (
                  <div key={index} className="bg-gradient-to-r from-[#181818] to-[#1a1a1a] border border-yellow-400/30 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">Transaction #{index + 1}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.text}
                        </span>
                        <span className="text-xs px-2 py-1 bg-purple-400/20 text-purple-400 rounded-full">
                          PenkMarket
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatTimestamp(tx.timestamp)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Token Type</p>
                        <p className="font-mono text-white text-lg font-semibold">{tx.tokenType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Amount</p>
                        <p className="font-mono text-white text-lg font-semibold">
                          {formatAmount(tx.amount, tx.tokenType)} {tx.tokenType}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Output Token</p>
                        <p className="font-semibold text-sm text-white">
                          {tx.outputToken ? getTokenNameByAddress(tx.outputToken) : 'Loading...'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">User Address</p>
                        <p className="font-mono text-xs text-gray-300 break-all">
                          {`${tx.user.slice(0, 6)}...${tx.user.slice(-4)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                      <div className="flex items-center gap-4">
                        {tx.transactionHash ? (
                          <a
                            href={`https://etherscan.io/tx/${tx.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 text-sm transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Transaction
                          </a>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1 text-gray-500 text-sm">
                              <ExternalLink className="w-4 h-4" />
                              Loading Transaction Hash...
                            </span>
                            <span className="text-xs text-gray-600 font-mono">
                              ID: {userTxIds[index]?.slice(0, 16)}...
                            </span>
                          </div>
                        )}
                        {tx.tokenAddress !== '0x0000000000000000000000000000000000000000' && (
                          <a
                            href={`https://etherscan.io/token/${tx.tokenAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Token
                          </a>
                        )}
                      </div>
                      
                      {canRefund && (
                        <button
                          onClick={() => handleRefund(userTxIds[index])}
                          disabled={refundingTx === userTxIds[index] || isPending || isTxLoading}
                          className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
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
            </>
          )}
        </div>

        {/* Info Box */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-400 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-300 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About PenkMarket Refunds
            </h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>• Only pending transactions can be refunded</li>
              <li>• Refunds are processed by the verifier on Ethereum</li>
              <li>• Completed transactions cannot be refunded</li>
              <li>• Refunded transactions will show as "Refunded" status</li>
              <li>• All transactions are viewable on Etherscan</li>
            </ul>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
