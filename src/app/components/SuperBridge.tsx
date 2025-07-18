"use client";
import React, { useEffect, useState } from "react";
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react'; // If not available, use a placeholder icon
import '@rainbow-me/rainbowkit/styles.css'; // Ensure RainbowKit styles are loaded

const MAX_POOL = 35009000; // 35,009,000 tokens
const DECIMALS = 18; // PEPU token decimals
const PEPU_CONTRACT = "0x93aA0ccD1e5628d3A841C4DbdF602D9eb04085d6";

const SUPERBRIDGE_CONTRACT = "0x3EEbd3c3F5Bf02923E14c6288C7d241C77D83ef7"; // Pepe testnet
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

// Helper to shorten address
function shortenAddress(addr: string) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function SuperBridge() {
  const [poolRaw, setPoolRaw] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const { data: nativeBalance, isLoading: isNativeBalanceLoading } = useBalance({
    address: address,
    chainId: 97740, // Pepe Unchained testnet
  });
  const availableBalance = isConnected && nativeBalance && !isNativeBalanceLoading ? Number(nativeBalance.formatted) : 0;
  const [inputWarning, setInputWarning] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [txError, setTxError] = useState<string | null>(null);
  const [isBridging, setIsBridging] = useState(false);
  const [successTx, setSuccessTx] = useState<{
    original: string;
    received: string;
    hash: string;
  } | null>(null);

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: 97740,
  });

  useEffect(() => {
    if (isTxSuccess && txHash) {
      setSuccessTx({
        original: sendAmount,
        received: (Number(sendAmount) * 0.95).toFixed(6),
        hash: txHash,
      });
      setSendAmount(''); // Clear input on success
      setTxHash(undefined);
      setIsBridging(false);
    }
  }, [isTxSuccess, txHash]);

  function handleDismissSuccess() {
    setSuccessTx(null);
    setSendAmount('');
    setIsBridging(false);
    setTxHash(undefined);
  }

  async function handleBridge() {
    setTxError(null);
    if (!isConnected || !address) {
      setTxError('Connect your wallet');
      return;
    }
    if (!sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0) {
      setTxError('Enter a valid amount');
      return;
    }
    setIsBridging(true);
    const value = BigInt(Math.floor(Number(sendAmount) * 10 ** DECIMALS));
    try {
      const data = await writeContract({
        address: SUPERBRIDGE_CONTRACT,
        abi: SUPERBRIDGE_ABI,
        functionName: 'bridge',
        chainId: 97740,
        value,
      });
      setTxHash((data as any)?.hash as `0x${string}`);
    } catch (err: any) {
      setTxError(err?.message || 'Transaction failed');
      setIsBridging(false);
    }
  }

  useEffect(() => setIsMounted(true), []);

  // Fetch PEPU balance for connected wallet
  const { data: pepuBalance } = useReadContract({
    address: PEPU_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  useEffect(() => {
    async function fetchPool() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/pool");
        const data = await res.json();
        if (data.balance) {
          setPoolRaw(data.balance);
        } else {
          setError("Error fetching pool");
        }
      } catch {
        setError("Error fetching pool");
      }
      setLoading(false);
    }
    fetchPool();
  }, []);

  const pool = poolRaw ? Number(poolRaw) / 10 ** DECIMALS : 0;
  const percent = Math.min((pool / MAX_POOL) * 100, 100);
  const formattedPool = formatTokenAmount(poolRaw);
  const formattedPepuBalance = isConnected ? formatTokenAmount(pepuBalance as bigint) : "0.000";

  const navLinks = [
    { label: 'About', href: '#about' },
    { label: 'Bridge', href: '#bridge' },
    { label: 'Pools', href: '#pools' },
    { label: 'Explorer', href: '#explorer' },
  ];
  const [selectedNav, setSelectedNav] = useState(navLinks[1]); // Default to Bridge

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
              <a
                key={link.label}
                href={link.href}
                className={`transition-colors ${selectedNav.label === link.label ? 'text-yellow-400 border-b-2 border-yellow-400 pb-1' : 'text-gray-300 hover:text-yellow-400'}`}
                onClick={() => setSelectedNav(link)}
              >
                {link.label}
              </a>
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
              {loading ? "..." : `${percent.toFixed(2)}%`}
            </span>
          </div>
          <div className="flex justify-between text-xs text-white mb-1">
            <span>0</span>
            <span>{MAX_POOL.toLocaleString()}</span>
          </div>
          <div className="text-center text-white text-sm mb-6">
            SuperBridge Pool: {loading ? <span className="font-bold">Loading...</span> : error ? <span className="font-bold text-red-500">Error</span> : <span className="font-bold">{formattedPool} PEPU</span>}
          </div>
          {/* You Send */}
          <div className="mb-2">
            <label className="block text-white text-sm mb-1">You Send</label>
            <div className={`${isConnected ? 'text-green-500' : 'text-red-500'} text-xs mb-1`}>
              {!isConnected ? 'Connect wallet to enter amount' : 'Enter amount to bridge'}
            </div>
            <input
              type="number"
              className="w-full bg-transparent border border-yellow-400 rounded-lg px-2 py-1 text-white text-base sm:text-lg focus:outline-none placeholder:text-xs"
              value={sendAmount}
              onChange={handleInputChange}
              min="0"
              step="any"
              disabled={!isConnected}
              placeholder="5000 PEPU"
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
          {/* Removed You Receive section with input field */}
          {/* Coming Soon Button */}
          <div className="relative w-full mb-4">
            <button
              className={`w-full font-bold text-sm sm:text-base py-1.5 sm:py-2 rounded-full border border-yellow-400 cursor-pointer transition-colors active:scale-95 ${isConnected ? 'bg-[#16a34a] text-yellow-400' : 'bg-[#14532d] text-yellow-400 cursor-not-allowed'}`}
              style={{
                boxShadow: '0 0 0 0 transparent',
              }}
              disabled={!isConnected || isBridging || !sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0}
              onClick={handleBridge}
            >
              {isBridging ? 'Bridging...' : isConnected ? 'Bridge Assets' : 'Connect Wallet'}
            </button>
          </div>
          {/* Transaction Details Section inside the main card */}
          {txError && <div className="text-red-500 text-xs mb-2 text-center">{txError}</div>}
          {isTxLoading && <div className="text-yellow-400 text-xs mb-2 text-center">Transaction pending...</div>}
          {successTx && (
            <div className="bg-green-900/80 border border-green-400 rounded-lg p-3 mb-2 text-green-200 text-xs text-center flex flex-col items-center">
              <div className="font-bold mb-1">Bridge Successful!</div>
              <div>Bridged: <span className="font-mono">{successTx.original}</span> PEPU</div>
              <div>Will receive: <span className="font-mono">{successTx.received}</span> PEPU on Ethereum</div>
              <div className="break-all mt-1">Tx: <a href={`https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz/address/${successTx.hash}`} target="_blank" rel="noopener noreferrer" className="underline text-yellow-300">{successTx.hash.slice(0, 10)}...{successTx.hash.slice(-6)}</a></div>
              <button onClick={handleDismissSuccess} className="mt-2 px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs">Dismiss</button>
            </div>
          )}
          {isConnected && (
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
          {/* Pointer hand placeholder (add your image here) */}
          <div className="absolute right-[-40px] top-1/2 transform -translate-y-1/2">
            {/* <img src="/pointer-hand.png" alt="Pointer Hand" className="w-16 h-16" /> */}
          </div>
        </div>
      </div>
    </div>
  );
} 