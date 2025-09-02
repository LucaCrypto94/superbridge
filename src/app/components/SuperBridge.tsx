"use client";
import React, { useEffect, useState } from "react";
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useBalance, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import Link from 'next/link';
import '@rainbow-me/rainbowkit/styles.css';

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

export default function SuperBridge() {
  const [error, setError] = useState("");
  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isMounted, setIsMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  // Debug logging
  console.log('L1 Pool Balance Debug:', {
    L1_CONTRACT,
    pepuTokenAddress,
    tokenAddressError,
    hasL1Contract: !!L1_CONTRACT
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

  // Debug logging for balance
  console.log('L1 Balance Debug:', {
    l1PoolBalance,
    balanceError,
    isL1PoolBalanceLoading
  });

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
      // Calculate received amount (95% of original)
      const originalAmount = sendAmount;
      const receivedAmount = (Number(originalAmount) * 0.95).toFixed(6);
      
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
    const bridgeAmount = Number(sendAmount) * 0.95; // 95% of original amount (5% fee)
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

  // Debug PENK balance
  console.log('PENK Balance Debug:', {
    PENK_CONTRACT,
    address,
    penkBalance,
    penkLoading,
    chainId: CORRECT_CHAIN_ID
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

  const navLinks = [
    { label: 'About', href: '#about' },
    { label: 'SuperBridge', href: '/' },
    { label: 'Penk Market', href: '/penkmarket' },
    { label: 'Pools', href: '#pools' },
    { label: 'Transactions', href: '/transactions' },
    { label: 'Admin', href: '/admin' },
    { label: 'Explorer', href: '#explorer' },
  ];
  const [selectedNav, setSelectedNav] = useState(navLinks[1]);

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
  const bridgeAmount = sendAmount ? Number(sendAmount) * 0.95 : 0; // 95% of original amount (5% fee)
  const l1PoolAmount = l1PoolBalance ? Number(l1PoolBalance) / 10 ** DECIMALS : 0;
  const hasInsufficientL1Pool = bridgeAmount > l1PoolAmount && bridgeAmount > 0;
  const hasInsufficientPENK = penkBalance ? Number(penkBalance as bigint) / 10 ** DECIMALS < PENK_MIN : false;
  
  const isBridgeDisabled = !isConnected || isWrongNetwork || isBridging || isPending || isTxLoading || !sendAmount || Number(sendAmount) <= 0 || hasInsufficientL1Pool || hasInsufficientPENK;

  // Debug logging
  console.log('Bridge button debug:', {
    isConnected,
    isWrongNetwork,
    isBridging,
    isPending,
    isTxLoading,
    sendAmount,
    sendAmountNumber: Number(sendAmount),
    penkBalance: penkBalance ? Number(penkBalance) / 10 ** DECIMALS : 0,
    penkMin: PENK_MIN,
    hasInsufficientPENK,
    isBridgeDisabled
  });

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
              <div id="mobile-nav-dropdown" className="absolute left-0 top-full mt-1 w-32 bg-[#232323] border border-gray-600 rounded shadow-lg z-10">
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
          backgroundImage: "url('/pepubank-site-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        className="min-h-screen overflow-y-auto flex flex-col items-center justify-center pt-24 sm:pt-40 relative"
      >
        {/* Dark overlay for background */}
        <div className="absolute inset-0 bg-black opacity-60 pointer-events-none z-0" />
        {/* Main Bridge Card */}
        <div className="bg-[#181818] border-2 border-yellow-400 rounded-xl p-2 sm:p-4 w-full max-w-xs sm:max-w-[370px] shadow-lg relative mt-4 mb-4 z-10 text-xs sm:text-base">
          <h2 className="text-center text-lg sm:text-2xl font-bold text-yellow-400 mb-4 sm:mb-6">SuperBridge</h2>
          
          {/* Network Warning */}
          {isWrongNetwork && (
            <div className="bg-red-900/80 border border-red-400 rounded-lg p-3 mb-4 text-red-200 text-xs text-center">
              <div className="font-bold mb-1">⚠️ Wrong Network</div>
              <div>Please switch to Pepe Unchained V2 network</div>
            </div>
          )}

          {/* Copy Notification */}
          {copyNotification && (
            <div className="bg-green-900/80 border border-green-400 rounded-lg p-3 mb-4 text-green-200 text-xs text-center">
              <div className="font-bold">✅ {copyNotification}</div>
            </div>
          )}

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
          <div className="w-full h-5 bg-black border border-yellow-400 rounded-full mb-2 relative">
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
          {/* You Send */}
          <div className="mb-2">
            <label className="block text-white text-sm mb-1">You Send</label>
            <div className={`${isConnected && !isWrongNetwork ? 'text-green-500' : 'text-red-500'} text-xs mb-1`}>
              {!isConnected ? 'Connect wallet to enter amount' : isWrongNetwork ? 'Switch to correct network' : 'Enter amount to bridge'}
            </div>
            <input
              type="number"
              className="w-full bg-transparent border border-yellow-400 rounded-lg px-2 py-1 text-white text-base sm:text-lg focus:outline-none placeholder:text-xs"
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
              className={`w-full font-bold text-sm sm:text-base py-1.5 sm:py-2 rounded-full border border-yellow-400 transition-colors ${
                isBridgeDisabled 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-[#16a34a] text-yellow-400 hover:bg-[#15803d] active:scale-95'
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
            <div className="bg-gradient-to-r from-blue-900/90 to-indigo-900/90 border-2 border-blue-400 rounded-xl p-4 mb-4 text-blue-100 text-center shadow-lg">
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
            <div className="bg-gradient-to-r from-green-900/90 to-emerald-900/90 border-2 border-green-400 rounded-xl p-4 mb-4 text-green-100 text-center shadow-lg">
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
                  <span className="text-sm">Network Fee (5%):</span>
                  <span className="font-mono text-red-300">{(Number(successTx.original) * 0.05).toFixed(6)} PEPU</span>
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
            <div className="bg-[#232323] border border-yellow-900/40 rounded-lg p-4">
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
                    `${(Number(sendAmount) * 0.95).toLocaleString(undefined, { maximumFractionDigits: 6 })} PEPU`
                    : '0 PEPU'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>Fees (5%)</span>
                <span className="text-white">
                  {sendAmount && !isNaN(Number(sendAmount)) ?
                    `${(Number(sendAmount) * 0.05).toLocaleString(undefined, { maximumFractionDigits: 6 })} PEPU`
                    : '0 PEPU'}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Contract Addresses Section */}
        <div className="mt-8 max-w-xs sm:max-w-[370px] mx-auto relative z-10">
          <div className="text-center text-white text-sm mb-4 font-semibold">Contract Addresses</div>
          <div className="space-y-3">
            <div className="bg-[#232323] rounded-lg p-3 border border-gray-700 shadow-lg">
              <div className="text-xs text-gray-400 mb-2">L2 Bridge Contract (Pepu Mainnet)</div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-yellow-300 font-mono break-all flex-1 bg-black/30 px-2 py-1 rounded">
                  {SUPERBRIDGE_CONTRACT}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(SUPERBRIDGE_CONTRACT);
                    setCopyNotification('L2 Contract copied!');
                    setTimeout(() => setCopyNotification(null), 2000);
                  }}
                  className="text-yellow-400 hover:text-yellow-300 text-xs px-3 py-1.5 rounded border border-yellow-400 hover:bg-yellow-400/10 transition-colors whitespace-nowrap font-medium"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div className="bg-[#232323] rounded-lg p-3 border border-gray-700 shadow-lg">
              <div className="text-xs text-gray-400 mb-2">L1 Bridge Contract (Ethereum Mainnet)</div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-yellow-300 font-mono break-all flex-1 bg-black/30 px-2 py-1 rounded">
                  {L1_CONTRACT}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(L1_CONTRACT);
                    setCopyNotification('L1 Contract copied!');
                    setTimeout(() => setCopyNotification(null), 2000);
                  }}
                  className="text-yellow-400 hover:text-yellow-300 text-xs px-3 py-1.5 rounded border border-yellow-400 hover:bg-yellow-400/10 transition-colors whitespace-nowrap font-medium"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 