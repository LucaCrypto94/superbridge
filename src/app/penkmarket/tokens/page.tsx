"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, ExternalLink, Wallet, RefreshCw } from 'lucide-react';
import { getAllTokens, getTokenNameByAddress } from '@/lib/token-utils';

const PENKMARKET_CONTRACT = "0x8a6134Bd33367ee152b4a1178652c9053eda6D57" as `0x${string}`;
const CORRECT_CHAIN_ID = 1; // Ethereum mainnet

// Contract ABI for token management
const CONTRACT_ABI = [
  {
    "inputs": [{ "name": "token", "type": "address" }],
    "name": "addToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "token", "type": "address" }],
    "name": "removeToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllowedTokens",
    "outputs": [{ "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "token", "type": "address" }],
    "name": "checkTokenAllowed",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  }
];

export default function TokenManagement() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const [allowedTokens, setAllowedTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(false);

  // Get all tokens from lib
  const libTokens = getAllTokens();

  const isCorrectChain = chainId === CORRECT_CHAIN_ID;

  const checkOwnerStatus = async () => {
    if (!address || !isConnected) return;
    
    setCheckingOwner(true);
    try {
      const response = await fetch('/api/check-owner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });
      const data = await response.json();
      
      if (data.success) {
        setIsOwner(data.isOwner);
      } else {
        console.error('Error checking owner status:', data.error);
        setIsOwner(false);
      }
    } catch (error) {
      console.error('Error checking owner status:', error);
      setIsOwner(false);
    } finally {
      setCheckingOwner(false);
    }
  };

  const fetchAllowedTokens = async () => {
    if (!address || !isConnected) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/get-allowed-tokens');
      const data = await response.json();
      
      if (data.success) {
        setAllowedTokens(data.allowedTokens);
      } else {
        console.error('Error fetching allowed tokens:', data.error);
      }
    } catch (error) {
      console.error('Error fetching allowed tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToken = async () => {
    if (!newTokenAddress || !isConnected || !isCorrectChain) return;
    
    try {
      writeContract({
        address: PENKMARKET_CONTRACT,
        abi: CONTRACT_ABI,
        functionName: 'addToken',
        args: [newTokenAddress as `0x${string}`],
      });
      setNewTokenAddress('');
    } catch (error) {
      console.error('Error adding token:', error);
    }
  };

  const removeToken = async (tokenAddress: string) => {
    if (!isConnected || !isCorrectChain) return;
    
    try {
      writeContract({
        address: PENKMARKET_CONTRACT,
        abi: CONTRACT_ABI,
        functionName: 'removeToken',
        args: [tokenAddress as `0x${string}`],
      });
    } catch (error) {
      console.error('Error removing token:', error);
    }
  };

  useEffect(() => {
    if (isConnected && isCorrectChain) {
      checkOwnerStatus();
      fetchAllowedTokens();
    }
  }, [address, isConnected, isCorrectChain]);

  useEffect(() => {
    if (isConfirmed) {
      fetchAllowedTokens();
    }
  }, [isConfirmed]);



  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navLinks = [
    { label: 'SuperBridge', href: '/' },
    { label: 'Penk Market', href: '/penkmarket' },
    { label: 'Transactions', href: '/penkmarket/refunds' },
    { label: 'Listings', href: '/penkmarket/listings' },
    { label: 'Admin', href: '/penkmarket/tokens' },
  ];
  const [selectedNav, setSelectedNav] = useState(navLinks[4]);

  return (
    <div className="min-h-screen bg-[#181818]">
      {/* Header */}
      <div className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
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
            {/* Right: Connect Button */}
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchAllowedTokens}
                disabled={loading}
                className="flex items-center px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
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
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {!isConnected ? (
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center">
            <Wallet className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to manage tokens</p>
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
                  className="bg-yellow-400 text-[#181818] font-bold px-6 py-3 rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2"
                >
                  <Wallet className="w-5 h-5" />
                  <span>{account ? account.displayName : 'Connect Wallet'}</span>
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        </div>
      ) : !isCorrectChain ? (
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Wrong Network</h2>
            <p className="text-gray-400 mb-6">Please switch to Ethereum Mainnet</p>
          </div>
        </div>
      ) : checkingOwner ? (
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center">
            <RefreshCw className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-white mb-4">Checking Permissions</h2>
            <p className="text-gray-400">Verifying owner status...</p>
          </div>
        </div>
      ) : !isOwner ? (
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
            <p className="text-gray-400 mb-6">Only the contract owner can access this page</p>
            <Link 
              href="/penkmarket/refunds"
              className="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Refunds
            </Link>
          </div>
        </div>
      ) : (

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-white">Token Management</h1>
            <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm font-semibold rounded-full">
              Admin Only
            </span>
          </div>
          <p className="text-gray-400 mt-2">Manage allowed tokens for PenkMarket transactions</p>
        </div>

        {/* Add New Token Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-green-400" />
            Add New Token
          </h2>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="0x..."
              value={newTokenAddress}
              onChange={(e) => setNewTokenAddress(e.target.value)}
              className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={addToken}
              disabled={!newTokenAddress || isPending || isConfirming}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center"
            >
              {isPending || isConfirming ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {isPending ? 'Adding...' : 'Confirming...'}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Token
                </>
              )}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-sm mt-2">{error.message}</p>
          )}
        </div>

        {/* Token Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Allowed Tokens */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Allowed Tokens</h2>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                <span className="ml-2 text-gray-400">Loading...</span>
              </div>
            ) : allowedTokens.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No allowed tokens found</p>
                <p className="text-sm text-gray-500 mt-1">Add tokens using the form above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allowedTokens.map((tokenAddress) => (
                  <div key={tokenAddress} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                        <span className="text-yellow-400 text-xs font-bold">
                          {getTokenNameByAddress(tokenAddress).charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{getTokenNameByAddress(tokenAddress)}</p>
                        <p className="text-xs text-gray-400 font-mono">{tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <a
                        href={`https://etherscan.io/token/${tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => removeToken(tokenAddress)}
                        disabled={isPending || isConfirming}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lib Tokens Reference */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Available Tokens (Lib)</h2>
            <div className="space-y-3">
              {libTokens.map((token) => (
                <div key={token.symbol} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-blue-400 text-xs font-bold">
                        {token.symbol.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{token.symbol}</p>
                      {token.address && (
                        <p className="text-xs text-gray-400 font-mono">{token.address.slice(0, 6)}...{token.address.slice(-4)}</p>
                      )}
                    </div>
                  </div>
                  {token.address && (
                    <a
                      href={`https://etherscan.io/token/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-blue-400 mb-2">About Token Management</h3>
          <div className="text-gray-300 space-y-2">
            <p>• <strong>Allowed Tokens:</strong> Tokens that can be used as output tokens in PenkMarket transactions</p>
            <p>• <strong>Add Token:</strong> Add a new token address to the whitelist (requires owner permissions)</p>
            <p>• <strong>Remove Token:</strong> Remove a token from the whitelist (requires owner permissions)</p>
            <p>• <strong>Lib Tokens:</strong> Reference list of known tokens from the token library</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
