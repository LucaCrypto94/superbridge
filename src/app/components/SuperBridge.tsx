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
const PEPU_CONTRACT = "0xaFD224042abbd3c51B82C9f43B681014c12649ca";
const PENK_CONTRACT = "0x82144C93bd531E46F31033FE22D1055Af17A514c";
const PENK_MIN = 38000;
const CORRECT_CHAIN_ID = 97740; // Pepe Unchained V2 testnet

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

  const { data: nativeBalance, isLoading: isNativeBalanceLoading } = useBalance({
    address: address,
    chainId: CORRECT_CHAIN_ID,
  });

  // L1 Contract Balance
  const { data: l1PoolBalance, isLoading: isL1PoolBalanceLoading } = useReadContract({
    address: L1_CONTRACT,
    abi: [
      {
        "inputs": [],
        "name": "getBalance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: "getBalance",
    chainId: 11155111, // Sepolia
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
        friendlyError = 'Please switch to Pepe Unchained V2 testnet to bridge your tokens';
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



    // Check if amount exceeds available balance
    const availableBalance = nativeBalance ? Number(nativeBalance.formatted) : 0;
    if (Number(sendAmount) > availableBalance) {
      setTxError('Amount exceeds wallet balance');
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
  const { data: penkBalance } = useReadContract({
    address: PENK_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });



  const pool = l1PoolBalance ? Number(l1PoolBalance) / 10 ** DECIMALS : 0;
  const percent = Math.min((pool / MAX_POOL) * 100, 100);
  const formattedPool = formatTokenAmount(l1PoolBalance as bigint);
  const formattedPepuBalance = isConnected ? formatTokenAmount(pepuBalance as bigint) : "0.000";
  const availableBalance = isConnected && nativeBalance && !isNativeBalanceLoading ? Number(nativeBalance.formatted) : 0;

  const navLinks = [
    { label: 'About', href: '#about' },
    { label: 'Bridge', href: '#bridge' },
    { label: 'Pools', href: '#pools' },
    { label: 'Transactions', href: '/transactions' },
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
  const isBridgeDisabled = !isConnected || isWrongNetwork || isBridging || isPending || isTxLoading || !sendAmount || Number(sendAmount) <= 0;

  // Debug logging
  console.log('Bridge button debug:', {
    isConnected,
    isWrongNetwork,
    isBridging,
    isPending,
    isTxLoading,
    sendAmount,
    sendAmountNumber: Number(sendAmount),
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

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <img src="/peuchain-logo.jpg" alt="Pepe Unchained V2" className="w-8 h-8 rounded-full" />
              <span className="text-white text-sm">From <span className="font-bold">Pepe Unchained V2</span></span>
            </div>
            <div className="flex items-center gap-2">
              <img src="/ethereum-logo.png" alt="Ethereum" className="w-8 h-8 rounded-full" />
              <span className="text-white text-sm">To <span className="font-bold">Ethereum</span></span>
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
            SuperBridge Pool (v1): {isL1PoolBalanceLoading ? <span className="font-bold">Loading...</span> : error ? <span className="font-bold text-red-500">Error</span> : <span className="font-bold">{formattedPool} PEPU</span>}
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
            <div className="bg-red-900/80 border border-red-400 rounded-lg p-3 mb-2 text-red-200 text-xs text-center">
              <div className="font-bold mb-1">❌ Error</div>
              <div>{txError}</div>
            </div>
          )}
          
          {isTxLoading && txHash && (
            <div className="bg-blue-900/80 border border-blue-400 rounded-lg p-3 mb-2 text-blue-200 text-xs text-center">
              <div className="font-bold mb-1">⏳ Transaction Pending</div>
                             <div className="break-all mt-1">
                 Tx: <a 
                   href={`https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz/tx/${txHash}`} 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   className="underline text-yellow-300"
                 >
                   {txHash.slice(0, 10)}...{txHash.slice(-6)}
                 </a>
               </div>
            </div>
          )}
          
          {successTx && (
            <div className="bg-green-900/80 border border-green-400 rounded-lg p-3 mb-2 text-green-200 text-xs text-center">
              <div className="font-bold mb-1">✅ Bridge Successful!</div>
              <div>Bridged: <span className="font-mono">{successTx.original}</span> PEPU</div>
              <div>Will receive: <span className="font-mono">{successTx.received}</span> PEPU on Ethereum</div>
                             <div className="break-all mt-1">
                 Tx: <a 
                   href={`https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz/tx/${successTx.hash}`} 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   className="underline text-yellow-300"
                 >
                   {successTx.hash.slice(0, 10)}...{successTx.hash.slice(-6)}
                 </a>
               </div>
              <button 
                onClick={handleDismissSuccess} 
                className="mt-2 px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs"
              >
                Dismiss
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
      </div>
    </div>
  );
} 