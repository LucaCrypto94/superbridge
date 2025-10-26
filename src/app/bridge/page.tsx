'use client'

import React, { useEffect, useState } from "react";
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useBalance, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import Link from 'next/link';
import '@rainbow-me/rainbowkit/styles.css';
import SidebarMenu from '../components/SidebarMenu';
import { FaBars } from 'react-icons/fa';

const MAX_POOL = 35009000; // 35,009,000 tokens
const DECIMALS = 18; // PEPU token decimals
const PEPU_CONTRACT = "0x93aA0ccD1e5628d3A841C4DbdF602D9eb04085d6"; // Ethereum mainnet PEPU token
const PENK_CONTRACT = "0x82144C93bd531E46F31033FE22D1055Af17A514c";
const PENK_MIN = 1000000;
const PENK_BUY_LINK = "https://www.geckoterminal.com/pepe-unchained/pools/0x71942200c579319c89c357b55a9d5C0E0aD2403e";
const CORRECT_CHAIN_ID = 97741; // Pepe Unchained V2 mainnet

const SUPERBRIDGE_CONTRACT = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS as `0x${string}`;
const L1_CONTRACT = process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS as `0x${string}`;
const SUPERBRIDGE_ABI = [
  {
    "inputs": [],
    "name": "bridge",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [
      { "name": "_owner", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [
      { "name": "balance", "type": "uint256" }
    ],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      { "name": "", "type": "uint8" }
    ],
    "type": "function"
  }
];

function formatTokenAmount(raw: string | bigint | undefined) {
  if (!raw) return "0.000";
  const num = typeof raw === 'bigint' ? Number(raw) / 10 ** DECIMALS : Number(raw) / 10 ** DECIMALS;
  return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function shortenAddress(addr: string) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function BridgePage() {
  const [error, setError] = useState("");
  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isMounted, setIsMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [inputWarning, setInputWarning] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [txError, setTxError] = useState<string | null>(null);
  const [isBridging, setIsBridging] = useState(false);
  const [successTx, setSuccessTx] = useState<{
    original: string;
    received: string;
    hash: string;
  } | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const { data: nativeBalance, isLoading: isNativeBalanceLoading } = useBalance({
    address: address,
    chainId: CORRECT_CHAIN_ID,
  });

  // Get PEPU token address from L1 contract
  const { data: pepuTokenAddress, error: tokenAddressError } = useReadContract({
    address: L1_CONTRACT,
    abi: [
      {
        "inputs": [],
        "name": "TOKEN",
        "outputs": [{ "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: "TOKEN",
    chainId: 1, // Ethereum mainnet
  });

  // L1 Contract PEPU Token Balance
  const { data: l1PoolBalance, isLoading: isL1PoolBalanceLoading, error: balanceError } = useReadContract({
    address: pepuTokenAddress as `0x${string}`,
    abi: [
      {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
      }
    ],
    functionName: "balanceOf",
    args: [L1_CONTRACT],
    chainId: 1, // Ethereum mainnet
    query: {
      enabled: !!pepuTokenAddress,
    },
  });

  // Read L2 contract fee percentage
  const { data: l2FeeBps } = useReadContract({
    address: SUPERBRIDGE_CONTRACT,
    abi: [
      {
        "inputs": [],
        "name": "feeBps",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: "feeBps",
    chainId: CORRECT_CHAIN_ID,
  });

  // Calculate fee percentage (feeBps is in basis points, so divide by 10000 to get decimal)
  const feePercentage = l2FeeBps ? Number(l2FeeBps) / 10000 : 0.05; // Default to 5% if not loaded
  const receivePercentage = 1 - feePercentage;

  const { writeContract, isPending, data: writeData, error: writeError } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: CORRECT_CHAIN_ID,
  });

  // Check if user is on correct network
  const isWrongNetwork = isConnected && chainId !== CORRECT_CHAIN_ID;

  // Handle writeContract data (transaction hash)
  useEffect(() => {
    if (writeData) {
      setTxHash(writeData);
    }
  }, [writeData]);

  // Handle writeContract errors
  useEffect(() => {
    if (writeError) {
      let friendlyError = writeError.message || 'Transaction failed';
      
      // Make chain mismatch errors more user-friendly
      if (writeError.message?.includes('chain') && writeError.message?.includes('does not match')) {
        friendlyError = 'Please switch to Pepe Unchained V2 mainnet to bridge your tokens';
      }
      
      setTxError(friendlyError);
      setIsBridging(false);
    }
  }, [writeError]);

  useEffect(() => {
    if (isTxSuccess && txHash) {
      // Calculate received amount using dynamic fee
      const originalAmount = sendAmount;
      const receivedAmount = (Number(originalAmount) * receivePercentage).toFixed(6);
      
      setSuccessTx({
        original: originalAmount,
        received: receivedAmount,
        hash: txHash
      });
      
      // Reset form
      setSendAmount('');
      setIsBridging(false);
      setTxHash(undefined);
      setTxError(null);
    }
  }, [isTxSuccess, txHash, sendAmount]);

  function handleDismissSuccess() {
    setSuccessTx(null);
    setSendAmount('');
    setIsBridging(false);
    setTxHash(undefined);
    setTxError(null);
  }

  function handleBridge() {
    if (!isConnected || !address) {
      setTxError('Please connect your wallet');
      return;
    }

    if (isWrongNetwork) {
      setTxError('Please switch to Pepe Unchained V2 network');
      return;
    }

    if (!sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0) {
      setTxError('Please enter a valid amount');
      return;
    }

    // Enforce minimum bridge amount
    if (Number(sendAmount) <= 0) {
      setTxError('Amount must be greater than 0');
      return;
    }

    // Check PENK balance for minimum requirement
    const penkBalanceNumber = penkBalance ? Number(penkBalance) / 10 ** DECIMALS : 0;
    if (penkBalanceNumber < PENK_MIN) {
      setTxError(`Minimum PENK hold to bridge: ${PENK_MIN.toLocaleString()}. Need more PENK? `);
      return;
    }

    // Check if amount exceeds available balance
    const availableBalance = nativeBalance ? Number(nativeBalance.formatted) : 0;
    if (Number(sendAmount) > availableBalance) {
      setTxError('Amount exceeds wallet balance');
      return;
    }

    // Check if L1 pool has sufficient balance for bridge amount
    const bridgeAmount = Number(sendAmount) * receivePercentage; // Dynamic fee calculation
    const l1PoolAmount = l1PoolBalance ? Number(l1PoolBalance) / 10 ** DECIMALS : 0;
    
    if (bridgeAmount > l1PoolAmount) {
      setTxError(`Insufficient pool funds. Please try a smaller amount or check back later.`);
      return;
    }

    setIsBridging(true);
    setTxError(null);

    const value = BigInt(Math.floor(Number(sendAmount) * 10 ** DECIMALS));
    
    writeContract({
      address: SUPERBRIDGE_CONTRACT,
      abi: SUPERBRIDGE_ABI,
      functionName: 'bridge',
      chainId: CORRECT_CHAIN_ID,
      value,
    });
  }

  useEffect(() => setIsMounted(true), []);

  // Fetch PEPU balance for connected wallet
  const { data: pepuBalance } = useReadContract({
    address: PEPU_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Fetch PENK balance for connected wallet
  const { data: penkBalance, isLoading: penkLoading } = useReadContract({
    address: PENK_CONTRACT as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CORRECT_CHAIN_ID, // Pepe Unchained V2 mainnet
  });

  const pool = l1PoolBalance ? Number(l1PoolBalance) / 10 ** DECIMALS : 0;
  const percent = Math.min((pool / MAX_POOL) * 100, 100);
  const formattedPool = l1PoolBalance ? formatTokenAmount(l1PoolBalance as bigint) : "0.000";
  const formattedPepuBalance = isConnected ? formatTokenAmount(pepuBalance as bigint) : "0.000";
  const availableBalance = isConnected && nativeBalance && !isNativeBalanceLoading ? Number(nativeBalance.formatted) : 0;
  
  // Format PENK balance
  const formattedPenkBalance = penkBalance 
    ? (Number(penkBalance as bigint) / 10 ** DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "0";
  
  // PENK balance color class
  const penkBalanceColorClass = penkBalance && Number(penkBalance as bigint) / 10 ** DECIMALS >= PENK_MIN ? 'text-green-400' : 'text-red-400';
  
  // PENK warning condition
  const showPenkWarning = isConnected && !isWrongNetwork && !penkLoading && penkBalance && Number(penkBalance as bigint) / 10 ** DECIMALS < PENK_MIN;

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val || isNaN(Number(val))) {
      setSendAmount(val);
      setInputWarning('');
      return;
    }
    const numVal = Number(val);
    if (numVal > availableBalance) {
      setSendAmount(availableBalance.toString());
      setInputWarning('Amount exceeds wallet balance');

    } else {
      setSendAmount(val);
      setInputWarning('');
    }
  }

  // Determine if bridge button should be disabled
  const bridgeAmount = sendAmount ? Number(sendAmount) * receivePercentage : 0; // Dynamic fee calculation
  const l1PoolAmount = l1PoolBalance ? Number(l1PoolBalance) / 10 ** DECIMALS : 0;
  const hasInsufficientL1Pool = bridgeAmount > l1PoolAmount && bridgeAmount > 0;
  const hasInsufficientPENK = penkBalance ? Number(penkBalance as bigint) / 10 ** DECIMALS < PENK_MIN : false;
  
  const isBridgeDisabled = !isConnected || isWrongNetwork || isBridging || isPending || isTxLoading || !sendAmount || Number(sendAmount) <= 0 || hasInsufficientL1Pool || hasInsufficientPENK;

  return (
    <div className="min-h-screen bg-[#0e0e0f]">
      {/* Sidebar */}
      <SidebarMenu onSelectItem={() => {}} />
      
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:fixed md:top-4 md:left-2 md:z-50 md:hidden bg-gradient-to-r from-orange-500 to-pink-500 text-white p-3 rounded-xl shadow-lg hover:scale-105 transition-all mb-4 ml-4 mt-2"
      >
        <FaBars size={18} />
      </button>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-80 h-full bg-gradient-to-b from-[#0e0e0f] to-[#0a0a0b] border-r border-[#23242b] overflow-y-auto scrollbar-hide">
            <SidebarMenu inSheet={true} onSelectItem={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="md:ml-20">
        {/* Content Area */}
        <div className="pt-4">
          <div className="relative min-h-[calc(100vh-80px)] bg-[#0e0e0f]">
            {/* Enhanced Glass Bubbles/Orbs Background */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Large purple orb - center top */}
              <div className="absolute top-[15%] left-[50%] transform -translate-x-1/2 w-[500px] h-[500px]">
                <div className="w-full h-full bg-gradient-to-br from-purple-500/40 to-pink-500/40 rounded-full blur-[90px] animate-float"></div>
              </div>
              
              {/* Orange orb - middle right */}
              <div className="absolute top-[25%] right-[20%] w-[350px] h-[350px]">
                <div className="w-full h-full bg-gradient-to-bl from-orange-400/35 to-red-400/35 rounded-full blur-[75px] animate-float-delayed"></div>
              </div>
              
              {/* Blue orb - middle left */}
              <div className="absolute top-[30%] left-[15%] w-[300px] h-[300px]">
                <div className="w-full h-full bg-gradient-to-tr from-blue-500/30 to-cyan-400/30 rounded-full blur-[65px] animate-float-slow"></div>
              </div>
              
              {/* Pink accent orb - center right */}
              <div className="absolute top-[40%] right-[25%] w-[250px] h-[250px]">
                <div className="w-full h-full bg-gradient-to-br from-pink-400/25 to-purple-400/25 rounded-full blur-[55px] animate-pulse-slow"></div>
              </div>
              
              {/* Violet orb - center left */}
              <div className="absolute top-[35%] left-[25%] w-[200px] h-[200px]">
                <div className="w-full h-full bg-gradient-to-tl from-violet-400/20 to-indigo-400/20 rounded-full blur-[45px] animate-float"></div>
              </div>
              
              {/* Rose orb - bottom center */}
              <div className="absolute top-[50%] left-[40%] w-[180px] h-[180px]">
                <div className="w-full h-full bg-gradient-to-tl from-rose-400/20 to-orange-400/20 rounded-full blur-[40px] animate-float-delayed"></div>
              </div>
              
              {/* Amber accent - upper center */}
              <div className="absolute top-[20%] left-[60%] w-[150px] h-[150px]">
                <div className="w-full h-full bg-gradient-to-br from-amber-400/15 to-pink-400/15 rounded-full blur-[35px] animate-pulse-slow"></div>
              </div>
            </div>

            {/* Content */}
            <div className="relative z-10 p-4 sm:p-8">
              {/* Main Bridge Card - GLASSMORPHISM */}
              <div className="max-w-md mx-auto">
                <div className="relative">
                  {/* White gradient overlay for glass effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.12] via-white/[0.05] to-transparent rounded-3xl pointer-events-none"></div>
                  
                  {/* Main card - GLASSMORPHISM */}
                  <div className="relative backdrop-blur-xl bg-white/[0.05] rounded-3xl shadow-2xl border border-white/[0.15] overflow-hidden">
                    {/* Card Header */}
                    <div className="relative p-6 border-b border-white/[0.12]">
                      <h1 className="text-3xl font-bold text-white text-center">SuperBridge</h1>
                      <p className="text-white/70 mt-1 text-center">Bridge PEPU from L2 → L1</p>
                    </div>

                    {/* Card Body */}
                    <div className="relative p-6">
                      {/* Wallet Connection Section */}
                      <div className="text-center py-4 mb-6">
                        <div className="backdrop-blur-sm bg-white/[0.03] rounded-2xl p-6 border border-white/[0.1] shadow-inner">
                          {!isConnected ? (
                            <>
                              <p className="text-white/80 mb-4">Connect your wallet to start bridging</p>
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
                                    className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold px-6 py-3 rounded-xl hover:scale-[1.02] shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center gap-2 mx-auto"
                                  >
                                    <Wallet className="w-5 h-5" />
                                    <span>Connect Wallet</span>
                                  </button>
                                )}
                              </ConnectButton.Custom>
                            </>
                          ) : (
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
                                  className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold px-6 py-3 rounded-xl hover:scale-[1.02] shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all flex items-center gap-2 mx-auto"
                                >
                                  <Wallet className="w-5 h-5" />
                                  <span>Disconnect</span>
                                </button>
                              )}
                            </ConnectButton.Custom>
                          )}
                        </div>
                      </div>

                      {/* Network Warning */}
                      {isWrongNetwork && (
                        <div className="backdrop-blur-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-red-200 text-xs text-center">
                          <div className="font-bold mb-1">⚠️ Wrong Network</div>
                      <div>Please switch to Pepe Unchained V2 network</div>
                        </div>
                      )}

                      {/* Copy Notification */}
                      {copyNotification && (
                        <div className="backdrop-blur-sm bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-4 text-green-200 text-xs text-center">
                          <div className="font-bold">✅ {copyNotification}</div>
                        </div>
                      )}

                      {/* Bridge Content - Only show when connected */}
                      {isConnected && (
                        <>
                      {/* Network Info */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <img src="/peuchain-logo.jpg" alt="Pepe Unchained V2" className="w-8 h-8 rounded-full" />
                          <span className="text-white text-sm">From <span className="font-bold">Pepe Unchained V2 Mainnet</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <img src="/ethereum-logo.png" alt="Ethereum" className="w-8 h-8 rounded-full" />
                          <span className="text-white text-sm">To <span className="font-bold">Ethereum Mainnet</span></span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-5 bg-black border border-white/[0.2] rounded-full mb-2 relative">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-700"
                          style={{ width: `${percent}%` }}
                        ></div>
                        <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
                          {isL1PoolBalanceLoading ? "..." : `${percent.toFixed(2)}%`}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-white mb-1">
                        <span>0</span>
                        <span>{MAX_POOL.toLocaleString()}</span>
                      </div>
                      <div className="text-center text-white text-sm mb-6">
                        SuperBridge Pool (v1): {
                          isL1PoolBalanceLoading ? 
                            <span className="font-bold">Loading...</span> : 
                          !L1_CONTRACT ? 
                            <span className="font-bold text-red-500">L1 Contract Not Set</span> : 
                          tokenAddressError ? 
                            <span className="font-bold text-red-500">Token Address Error</span> : 
                          !pepuTokenAddress ? 
                            <span className="font-bold text-yellow-500">Token Address Loading...</span> : 
                          balanceError ? 
                            <span className="font-bold text-red-500">Balance Error</span> : 
                            <span className="font-bold">{formattedPool} PEPU</span>
                        }
                      </div>

                      {/* Amount Input */}
                      <div className="mb-2">
                        <label className="block text-white text-sm mb-1">You Send</label>
                        <div className={`${isConnected && !isWrongNetwork ? 'text-green-500' : 'text-red-500'} text-xs mb-1`}>
                          {!isConnected ? 'Connect wallet to enter amount' : isWrongNetwork ? 'Switch to correct network' : 'Enter amount to bridge'}
                        </div>
                        <input
                          type="number"
                          className="w-full bg-white/[0.06] backdrop-blur-sm border border-white/[0.2] rounded-lg px-2 py-1 text-white text-base sm:text-lg focus:outline-none placeholder:text-xs focus:ring-2 focus:ring-white/20 focus:border-white/30"
                          value={sendAmount}
                          onChange={handleInputChange}
                          min="0"
                          step="any"
                          disabled={!isConnected || isWrongNetwork}
                          placeholder="Enter amount"
                        />
                        {inputWarning && (
                          <div className="text-red-500 text-xs mt-1">{inputWarning}</div>
                        )}
                        {hasInsufficientL1Pool && sendAmount && (
                          <div className="text-orange-400 text-xs mt-1">
                            ⚠️ Insufficient pool funds. Try a smaller amount.
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-gray-300 mt-1">
                          <span>Available:</span>
                          <span className="text-white">
                            {(!isConnected)
                              ? "0.000 PEPU"
                              : isNativeBalanceLoading
                                ? "Loading..."
                                : nativeBalance
                                  ? `${Number(nativeBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 3 })} PEPU`
                                  : "0.000 PEPU"}
                          </span>
                        </div>
                        {/* PENK Balance Display */}
                        {isConnected && !isWrongNetwork && (
                          <div className="flex justify-between text-xs text-gray-300 mt-2">
                            <span>PENK Balance:</span>
                            <span className={penkBalanceColorClass}>
                              {penkLoading 
                                ? "Loading..." 
                                : formattedPenkBalance}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bridge Button */}
                      <div className="relative w-full mb-4">
                        <button
                          className={`w-full font-bold text-sm sm:text-base py-1.5 sm:py-2 rounded-full border transition-colors ${
                            isBridgeDisabled 
                              ? 'bg-white/[0.05] text-white/30 cursor-not-allowed border-white/[0.08] backdrop-blur-sm' 
                              : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white hover:scale-[1.02] shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 border-transparent'
                          }`}
                          disabled={isBridgeDisabled}
                          onClick={handleBridge}
                        >
                          {isBridging || isPending || isTxLoading ? 'Bridging...' : 'Bridge Assets'}
                        </button>
                      </div>
                      
                      {/* Transaction Status Messages */}
                      {txError && (
                        <div className="text-red-400 text-sm mb-4 text-center">
                          {txError}
                          {txError.includes('Minimum PENK hold') && (
                            <a 
                              href={PENK_BUY_LINK} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-yellow-400 hover:text-yellow-300 underline ml-1"
                            >
                              Buy more PENK here
                            </a>
                          )}
                        </div>
                      )}
                      
                      {isTxLoading && txHash && (
                        <div className="backdrop-blur-sm bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4 text-blue-100 text-center">
                          <div className="flex items-center justify-center mb-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-2 animate-pulse">
                              <span className="text-white text-lg">⏳</span>
                            </div>
                            <div className="font-bold text-lg">Transaction Pending</div>
                          </div>
                          
                          <div className="text-sm mb-3">
                            Your bridge transaction is being processed on Pepe Unchained V2 mainnet...
                          </div>
                          
                          <div className="bg-black/40 rounded-lg p-2 mb-3">
                            <div className="text-xs text-gray-300 mb-1">Transaction Hash:</div>
                            <a 
                              href={`https://pepuscan.com/tx/${txHash}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="font-mono text-xs text-yellow-300 hover:text-yellow-200 underline break-all"
                            >
                              {txHash}
                            </a>
                          </div>
                          
                          <div className="text-xs text-gray-300">
                            🔄 Please wait while we confirm your transaction...
                          </div>
                        </div>
                      )}
                      
                      {successTx && (
                        <div className="backdrop-blur-sm bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4 text-green-100 text-center">
                          <div className="flex items-center justify-center mb-3">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
                              <span className="text-white text-lg">✓</span>
                            </div>
                            <div className="font-bold text-lg">Bridge Successful!</div>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                              <span className="text-sm">Amount Bridged:</span>
                              <span className="font-mono font-bold text-green-300">{successTx.original} PEPU</span>
                            </div>
                            <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                              <span className="text-sm">You'll Receive:</span>
                              <span className="font-mono font-bold text-yellow-300">{successTx.received} PEPU</span>
                            </div>
                            <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                              <span className="text-sm">Network Fee ({(feePercentage * 100).toFixed(1)}%):</span>
                              <span className="font-mono text-red-300">{(Number(successTx.original) * feePercentage).toFixed(6)} PEPU</span>
                            </div>
                          </div>
                          
                          <div className="bg-black/40 rounded-lg p-2 mb-3">
                            <div className="text-xs text-gray-300 mb-1">Transaction Hash:</div>
                            <a 
                              href={`https://pepuscan.com/tx/${successTx.hash}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="font-mono text-xs text-yellow-300 hover:text-yellow-200 underline break-all"
                            >
                              {successTx.hash}
                            </a>
                          </div>
                          
                          <div className="text-xs text-gray-300 mb-3">
                            ⏱️ Your tokens will arrive on Ethereum mainnet in approximately 30 seconds
                          </div>
                          
                          <button 
                            onClick={handleDismissSuccess} 
                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
                          >
                            Continue Bridging
                          </button>
                        </div>
                      )}
                      
                      {isConnected && !isWrongNetwork && (
                        <div className="backdrop-blur-sm bg-white/[0.03] border border-white/[0.1] rounded-lg p-4">
                          <div className="flex justify-between text-xs text-gray-300 mb-2">
                            <span>Recipient address</span>
                            <span className="text-white">{shortenAddress(address ? String(address) : '')}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-300 mb-2">
                            <span>Time spend</span>
                            <span className="text-white">≈ 30s</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-300 mb-2">
                            <span>You will receive</span>
                            <span className="text-white">
                              {sendAmount && !isNaN(Number(sendAmount)) ?
                                `${(Number(sendAmount) * receivePercentage).toLocaleString(undefined, { maximumFractionDigits: 6 })} PEPU`
                                : '0 PEPU'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-300">
                            <span>Fees ({(feePercentage * 100).toFixed(1)}%)</span>
                            <span className="text-white">
                              {sendAmount && !isNaN(Number(sendAmount)) ?
                                `${(Number(sendAmount) * feePercentage).toLocaleString(undefined, { maximumFractionDigits: 6 })} PEPU`
                                : '0 PEPU'}
                            </span>
                          </div>
                        </div>
                      )}
                        </>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="relative backdrop-blur-sm bg-white/[0.03] px-6 py-4 border-t border-white/[0.1]">
                      <p className="text-xs text-white/70 text-center">
                        Bridge fee: {(feePercentage * 100).toFixed(1)}% | Min PENK: {PENK_MIN.toLocaleString()} PENK
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0) scale(1);
          }
          33% {
            transform: translateY(-30px) translateX(10px) scale(1.05);
          }
          66% {
            transform: translateY(20px) translateX(-10px) scale(0.95);
          }
        }
        
        @keyframes float-delayed {
          0%, 100% {
            transform: translateY(0) translateX(0) scale(1);
          }
          33% {
            transform: translateY(40px) translateX(-20px) scale(0.95);
          }
          66% {
            transform: translateY(-20px) translateX(20px) scale(1.05);
          }
        }
        
        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-40px) translateX(30px);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
        
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 10s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 12s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
